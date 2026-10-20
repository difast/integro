import { describe, expect, it } from "vitest";
import { botTexts } from "@/config/chat-bot";
import { runScenario, type BotContext, type BotInput, type FlowState } from "@/lib/chat/scenario";

let counter = 0;
const ctx = (hasConsent = false): BotContext => ({ hasConsent, newKey: () => `key-${++counter}` });
const payloads = (buttons?: { type: string; payload?: string; text: string }[][]) =>
  (buttons ?? []).flat().map((b) => b.payload ?? b.type);

function run(steps: BotInput[], context = ctx(), initial: unknown = {}) {
  let state: unknown = initial;
  let last = runScenario(state, steps[0]!, context);
  state = last.state;
  for (const step of steps.slice(1)) {
    last = runScenario(state, step, context);
    state = last.state;
  }
  return last;
}

describe("чат-бот MAX: сценарий", () => {
  it("первый запуск: приветствие от имени компании, описание и меню из пяти пунктов", () => {
    const result = runScenario({}, { type: "start" }, ctx());
    expect(result.replies).toHaveLength(1);
    expect(result.replies[0]!.text).toContain("ООО «Интегро»");
    expect(result.replies[0]!.text).toContain("оценкой имущества");
    expect(result.replies[0]!.buttons!.flat().map((b) => b.text)).toEqual([
      "Оценка имущества",
      "Судебная экспертиза",
      "Экспертные исследования",
      "Оставить заявку",
      "Связаться со специалистом",
    ]);
  });

  it("разделы: оценка (объекты и цели), судебная экспертиза, исследования", () => {
    const ocenka = runScenario({ step: "menu" }, { type: "callback", payload: "sec:ocenka" }, ctx());
    for (const item of ["недвижимое имущество", "транспортные средства и спецтехника", "машины и оборудование", "бизнес, доли и акции", "права требования", "ущерб"]) {
      expect(ocenka.replies[0]!.text).toContain(item);
    }
    expect(payloads(ocenka.replies[0]!.buttons)).toContain("sec:ocenka:goals");
    const goals = runScenario({ step: "menu" }, { type: "callback", payload: "sec:ocenka:goals" }, ctx());
    for (const item of ["купли-продажи", "наследство", "залога", "разделе имущества", "судебных спорах", "корпоративных процедурах"]) {
      expect(goals.replies[0]!.text).toContain(item);
    }
    const sudeb = runScenario({ step: "menu" }, { type: "callback", payload: "sec:sudeb" }, ctx());
    for (const item of ["оценочная (стоимостная)", "строительно-техническая", "землеустроительная", "автотехническая", "товароведческая"]) {
      expect(sudeb.replies[0]!.text).toContain(item);
    }
    const issled = runScenario({ step: "menu" }, { type: "callback", payload: "sec:issled" }, ctx());
    for (const item of ["досудебной претензии", "расчётов и выводов", "рецензирование", "позиции к судебному процессу"]) {
      expect(issled.replies[0]!.text).toContain(item);
    }
  });

  it("тексты не содержат цен и обещаний", () => {
    const all = JSON.stringify(botTexts);
    expect(all).not.toMatch(/руб|₽|гарант|100%|лиценз/i);
  });

  it("заявка: согласие → имя → направление → описание → телефон → время → проверка → отправка", () => {
    const context = ctx();
    let r = runScenario({ step: "menu" }, { type: "callback", payload: "apply" }, context);
    expect(r.state.step).toBe("consent");
    expect(r.replies[0]!.text).toContain("не отправляйте");
    expect(r.replies[0]!.text).toContain("паспортные данные");
    r = runScenario(r.state, { type: "callback", payload: "consent:yes" }, context);
    expect(r.consentGiven).toBe(true);
    expect(r.state.step).toBe("name");
    r = runScenario(r.state, { type: "text", text: "Анна" }, context);
    expect(r.state.step).toBe("direction");
    r = runScenario(r.state, { type: "callback", payload: "dir:sudeb" }, context);
    expect(r.state.step).toBe("description");
    r = runScenario(r.state, { type: "text", text: "Нужна экспертиза по делу о заливе квартиры" }, context);
    expect(r.state.step).toBe("phone");
    expect(r.replies[0]!.buttons!.flat()[0]).toEqual({ type: "request_contact", text: "Отправить мой номер" });
    r = runScenario(r.state, { type: "contact", phone: "+79001234567" }, context);
    expect(r.phone).toBe("+79001234567");
    expect(r.state.step).toBe("contact_time");
    r = runScenario(r.state, { type: "text", text: "после 15:00" }, context);
    expect(r.state.step).toBe("confirm");
    expect(r.replies[0]!.text).toContain("Имя: Анна");
    expect(r.replies[0]!.text).toContain("Направление: Судебная экспертиза");
    expect(r.replies[0]!.text).toContain("Телефон: +79001234567");
    const confirmState = r.state;
    r = runScenario(confirmState, { type: "callback", payload: "confirm" }, context);
    expect(r.submit).toMatchObject({ name: "Анна", direction: "sudeb", phone: "+79001234567", contactTime: "после 15:00" });
    expect(r.submit!.key).toBe(confirmState.draft!.key);
    expect(r.state.step).toBe("menu");
    expect(r.needsReply).toBe(true);
  });

  it("согласие, данное ранее в действующей редакции, повторно не запрашивается", () => {
    const r = runScenario({ step: "menu" }, { type: "callback", payload: "apply" }, ctx(true));
    expect(r.state.step).toBe("name");
  });

  it("необязательные поля можно пропустить; телефон проверяется", () => {
    const context = ctx(true);
    const r = run(
      [
        { type: "callback", payload: "apply" },
        { type: "text", text: "Иван" },
        { type: "callback", payload: "dir:other" },
        { type: "text", text: "Короткое описание задачи" },
        { type: "text", text: "123" },
      ],
      context,
    );
    expect(r.state.step).toBe("phone");
    expect(r.replies[0]!.text).toBe(botTexts.errors.phone);
    const skipped = runScenario(r.state, { type: "callback", payload: "skip" }, context);
    const confirm = runScenario(skipped.state, { type: "callback", payload: "skip" }, context);
    expect(confirm.state.step).toBe("confirm");
    expect(confirm.replies[0]!.text).toContain("Телефон: не указан");
  });

  it("проверка полей: короткое имя и описание", () => {
    const context = ctx(true);
    const name = run([{ type: "callback", payload: "apply" }, { type: "text", text: "А" }], context);
    expect(name.replies[0]!.text).toBe(botTexts.errors.nameShort);
    expect(name.state.step).toBe("name");
  });

  it("исправление поля возвращает к проверке заявки", () => {
    const context = ctx(true);
    const confirm = run(
      [
        { type: "callback", payload: "apply" },
        { type: "text", text: "Иван" },
        { type: "callback", payload: "dir:ocenka" },
        { type: "text", text: "Оценка квартиры для нотариуса" },
        { type: "callback", payload: "skip" },
        { type: "callback", payload: "skip" },
      ],
      context,
    );
    let r = runScenario(confirm.state, { type: "callback", payload: "edit" }, context);
    r = runScenario(r.state, { type: "callback", payload: "edit:name" }, context);
    expect(r.state).toMatchObject({ step: "name", editing: true });
    r = runScenario(r.state, { type: "text", text: "Иван Петров" }, context);
    expect(r.state.step).toBe("confirm");
    expect(r.replies[0]!.text).toContain("Имя: Иван Петров");
  });

  it("устаревшая кнопка шага не меняет состояние", () => {
    const state: FlowState = { step: "name", draft: { key: "k" } };
    const r = runScenario(state, { type: "callback", payload: "confirm" }, ctx());
    expect(r.replies[0]!.text).toBe(botTexts.staleButton);
    expect(r.state).toEqual(state);
    expect(r.submit).toBeUndefined();
  });

  it("«меню» посреди заявки отменяет её", () => {
    const r = runScenario({ step: "description", draft: { key: "k", name: "Иван" } }, { type: "text", text: "Меню" }, ctx());
    expect(r.state.step).toBe("menu");
    expect(r.replies[0]!.text).toBe(botTexts.cancelled);
  });

  it("неизвестный вопрос: бот не выдумывает ответ и предлагает специалиста", () => {
    const r = runScenario({ step: "menu" }, { type: "text", text: "Работаете ли вы в выходные в Твери?" }, ctx());
    expect(r.replies[0]!.text).toBe(botTexts.unknown);
    expect(payloads(r.replies[0]!.buttons)).toContain("specialist");
  });

  it("вопрос о цене или сроках: без цифр, предложение связаться со специалистом", () => {
    for (const text of ["Сколько стоит рецензия?", "Какая цена оценки квартиры", "Какие сроки экспертизы"]) {
      const r = runScenario({ step: "menu" }, { type: "text", text }, ctx());
      expect(r.replies[0]!.text).toBe(botTexts.priceQuestion);
      expect(r.replies[0]!.text).not.toMatch(/\d/);
      expect(payloads(r.replies[0]!.buttons)).toContain("specialist");
    }
  });

  it("вопрос о документах: перечни с сайта и предупреждение не присылать документы в чат", () => {
    const r = runScenario({ step: "menu" }, { type: "text", text: "Подскажите, какие документы нужны?" }, ctx());
    expect(r.replies[0]!.text).toBe(botTexts.documents);
    expect(r.replies[0]!.text).toContain("Документы в этот чат не отправляйте");
  });

  it("ключевые слова ведут в разделы", () => {
    expect(runScenario({ step: "menu" }, { type: "text", text: "нужна рецензия на отчёт" }, ctx()).replies[0]!.text).toBe(botTexts.issled);
    expect(runScenario({ step: "menu" }, { type: "text", text: "судебная экспертиза" }, ctx()).replies[0]!.text).toBe(botTexts.sudeb);
    expect(runScenario({ step: "menu" }, { type: "text", text: "оценка дома" }, ctx()).replies[0]!.text).toBe(botTexts.ocenka);
  });

  it("связаться со специалистом: отметка «нужен ответ», подтверждение пересылки — один раз", () => {
    const first = runScenario({ step: "menu" }, { type: "callback", payload: "specialist" }, ctx());
    expect(first.needsReply).toBe(true);
    const msg1 = runScenario(first.state, { type: "text", text: "Вопрос по делу" }, ctx());
    expect(msg1.replies[0]!.text).toBe(botTexts.forwarded);
    const msg2 = runScenario(msg1.state, { type: "text", text: "Ещё вопрос" }, ctx());
    expect(msg2.replies).toHaveLength(0);
    expect(msg2.needsReply).toBe(true);
  });

  it("вложение: предупреждение о конфиденциальных документах", () => {
    const r = runScenario({ step: "menu" }, { type: "attachment" }, ctx());
    expect(r.replies[0]!.text).toBe(botTexts.attachment);
  });

  it("повреждённое состояние восстанавливается в главное меню", () => {
    const r = runScenario({ step: "confirm" }, { type: "callback", payload: "confirm" }, ctx());
    expect(r.submit).toBeUndefined();
    expect(r.state.step).toBe("menu");
  });

  it("«Назад» возвращает на предыдущий шаг, с первого шага — отмена", () => {
    const context = ctx(true);
    const atDescription = run(
      [
        { type: "callback", payload: "apply" },
        { type: "text", text: "Иван" },
        { type: "callback", payload: "dir:ocenka" },
      ],
      context,
    );
    expect(atDescription.state.step).toBe("description");
    const back = runScenario(atDescription.state, { type: "callback", payload: "back" }, context);
    expect(back.state.step).toBe("direction");
    expect(back.state.draft?.name).toBe("Иван");
    const fromName = runScenario({ step: "name", draft: { key: "k" } }, { type: "callback", payload: "back" }, context);
    expect(fromName.state.step).toBe("menu");
  });

  it("при исправлении поля «Назад» возвращает к проверке", () => {
    const r = runScenario({ step: "phone", draft: { key: "k", name: "Иван", description: "Описание задачи" }, editing: true }, { type: "callback", payload: "back" }, ctx());
    expect(r.state.step).toBe("confirm");
  });

  it("команды /help, /cancel и неизвестная команда", () => {
    const help = runScenario({ step: "menu" }, { type: "text", text: "/help" }, ctx());
    expect(help.replies[0]!.text).toBe(botTexts.help);
    const cancel = runScenario({ step: "description", draft: { key: "k", name: "Иван" } }, { type: "text", text: "/cancel" }, ctx());
    expect(cancel.state.step).toBe("menu");
    expect(cancel.replies[0]!.text).toBe(botTexts.cancelled);
    const unknown = runScenario({ step: "menu" }, { type: "text", text: "/price" }, ctx());
    expect(unknown.replies[0]!.text).toContain(botTexts.unknownCommand);
    expect(runScenario({ step: "menu" }, { type: "text", text: "/start@integro_bot" }, ctx()).replies[0]!.text).toBe(botTexts.greeting);
  });

  it("подпись кнопки, присланная текстом (обычная клавиатура Telegram), работает как нажатие", () => {
    const state: FlowState = { step: "phone", draft: { key: "k", name: "Иван", description: "Описание задачи" } };
    expect(runScenario(state, { type: "text", text: "Пропустить" }, ctx()).state.step).toBe("contact_time");
    expect(runScenario(state, { type: "text", text: "Назад" }, ctx()).state.step).toBe("description");
    expect(runScenario(state, { type: "text", text: "Отменить" }, ctx()).state.step).toBe("menu");
  });

  it("номер, присланный не на шаге телефона, сохраняется в заявке", () => {
    const state: FlowState = { step: "contact_time", draft: { key: "k", name: "Иван", description: "Описание задачи" } };
    const r = runScenario(state, { type: "contact", phone: "+79001112233" }, ctx());
    expect(r.phone).toBe("+79001112233");
    expect(r.state).toMatchObject({ step: "contact_time", draft: { phone: "+79001112233" } });
  });

  it("тексты не привязаны к одному мессенджеру", () => {
    expect(JSON.stringify(botTexts)).not.toMatch(/MAX|Telegram/);
  });
});

