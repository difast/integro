import { botButtons, botDirections, botKeywords, botTexts } from "@/config/max-bot";
import { isValidPhone, limits } from "@/lib/request-form";
import type { MaxButton } from "./types";

/**
 * Сценарий чат-бота: чистая функция «состояние диалога + ввод клиента → ответы и действия».
 * Ничего не отправляет и не сохраняет — это делает src/lib/max/processor.ts.
 */

export type Step =
  | "menu"
  | "consent"
  | "name"
  | "direction"
  | "description"
  | "phone"
  | "contact_time"
  | "confirm"
  | "edit"
  | "specialist";

export type Draft = {
  /** Ключ заявки: повторное подтверждение той же заявки не создаёт дубликат. */
  key: string;
  name?: string;
  direction?: (typeof botDirections)[number]["payload"];
  description?: string;
  phone?: string;
  contactTime?: string;
};

export type FlowState = { step: Step; draft?: Draft; editing?: boolean; forwarded?: boolean };

export type BotInput =
  | { type: "start" }
  | { type: "text"; text: string }
  | { type: "callback"; payload: string }
  | { type: "contact"; phone: string | null }
  | { type: "attachment" };

export type BotReply = { text: string; buttons?: MaxButton[][] };

export type BotResult = {
  state: FlowState;
  replies: BotReply[];
  /** Диалогу нужен ответ специалиста. */
  needsReply?: boolean;
  /** Клиент дал согласие на обработку персональных данных. */
  consentGiven?: boolean;
  /** Клиент сам указал телефон. */
  phone?: string;
  /** Подтверждённая заявка — сохранить. */
  submit?: Required<Pick<Draft, "key" | "name" | "description">> & Draft;
};

export type BotContext = {
  /** Согласие уже получено в действующей редакции — повторно не запрашивается. */
  hasConsent: boolean;
  newKey: () => string;
};

const CONTACT_TIME_MAX = 200;

const cb = (text: string, payload: string): MaxButton => ({ type: "callback", text, payload });

export const keyboards = {
  menu: (): MaxButton[][] => [
    [cb(botButtons.ocenka, "sec:ocenka")],
    [cb(botButtons.sudeb, "sec:sudeb")],
    [cb(botButtons.issled, "sec:issled")],
    [cb(botButtons.apply, "apply")],
    [cb(botButtons.specialist, "specialist")],
  ],
  section: (extra: MaxButton[] = []): MaxButton[][] => [
    ...extra.map((button) => [button]),
    [cb(botButtons.apply, "apply")],
    [cb(botButtons.specialist, "specialist")],
    [cb(botButtons.menu, "menu")],
  ],
  afterSpecialist: (): MaxButton[][] => [[cb(botButtons.apply, "apply")], [cb(botButtons.menu, "menu")]],
  unknown: (): MaxButton[][] => [[cb(botButtons.specialist, "specialist")], [cb(botButtons.menu, "menu")]],
  consent: (): MaxButton[][] => [[cb(botButtons.consentYes, "consent:yes")], [cb(botButtons.cancel, "cancel")]],
  cancel: (): MaxButton[][] => [[cb(botButtons.cancel, "cancel")]],
  direction: (): MaxButton[][] => [...botDirections.map((d) => [cb(d.label, `dir:${d.payload}`)]), [cb(botButtons.cancel, "cancel")]],
  phone: (): MaxButton[][] => [
    [{ type: "request_contact", text: botButtons.shareContact }],
    [cb(botButtons.skip, "skip")],
    [cb(botButtons.cancel, "cancel")],
  ],
  skip: (): MaxButton[][] => [[cb(botButtons.skip, "skip")], [cb(botButtons.cancel, "cancel")]],
  confirm: (): MaxButton[][] => [
    [cb(botButtons.confirm, "confirm")],
    [cb(botButtons.edit, "edit")],
    [cb(botButtons.cancel, "cancel")],
  ],
  edit: (): MaxButton[][] => [
    [cb(botButtons.editName, "edit:name"), cb(botButtons.editDirection, "edit:direction")],
    [cb(botButtons.editDescription, "edit:description"), cb(botButtons.editPhone, "edit:phone")],
    [cb(botButtons.editContactTime, "edit:contact_time")],
    [cb(botButtons.backToSummary, "summary")],
  ],
};

export function directionLabel(direction: Draft["direction"]): string {
  return botDirections.find((d) => d.payload === direction)?.label ?? botDirections[3].label;
}

export function summaryText(draft: Draft): string {
  const l = botTexts.summaryLabels;
  return botTexts.summary([
    `${l.name}: ${draft.name ?? ""}`,
    `${l.direction}: ${directionLabel(draft.direction)}`,
    `${l.description}: ${draft.description ?? ""}`,
    `${l.phone}: ${draft.phone || l.notSpecified}`,
    `${l.contactTime}: ${draft.contactTime || l.notSpecifiedTime}`,
  ]);
}

const menuReply = (text: string = botTexts.menu): BotReply => ({ text, buttons: keyboards.menu() });

/** Вопрос для текущего шага заявки. */
function prompt(state: FlowState): BotReply {
  switch (state.step) {
    case "consent":
      return { text: botTexts.consent, buttons: keyboards.consent() };
    case "name":
      return { text: botTexts.askName, buttons: keyboards.cancel() };
    case "direction":
      return { text: botTexts.askDirection, buttons: keyboards.direction() };
    case "description":
      return { text: botTexts.askDescription, buttons: keyboards.cancel() };
    case "phone":
      return { text: botTexts.askPhone, buttons: keyboards.phone() };
    case "contact_time":
      return { text: botTexts.askContactTime, buttons: keyboards.skip() };
    case "confirm":
      return { text: summaryText(state.draft ?? { key: "" }), buttons: keyboards.confirm() };
    case "edit":
      return { text: botTexts.editChoose, buttons: keyboards.edit() };
    case "specialist":
      return { text: botTexts.specialist, buttons: keyboards.afterSpecialist() };
    default:
      return menuReply();
  }
}

/** Следующий шаг после ввода поля: при исправлении — снова проверка заявки. */
function advance(state: FlowState, draft: Draft, next: Step): BotResult {
  const step: Step = state.editing ? "confirm" : next;
  const nextState: FlowState = { step, draft };
  return { state: nextState, replies: [prompt(nextState)] };
}

function startApplication(context: BotContext): BotResult {
  const draft: Draft = { key: context.newKey() };
  const state: FlowState = { step: context.hasConsent ? "name" : "consent", draft };
  return { state, replies: [prompt(state)] };
}

function section(payload: string): BotReply | null {
  if (payload === "sec:ocenka") return { text: botTexts.ocenka, buttons: keyboards.section([cb(botButtons.ocenkaGoals, "sec:ocenka:goals")]) };
  if (payload === "sec:ocenka:goals") return { text: botTexts.ocenkaGoals, buttons: keyboards.section() };
  if (payload === "sec:sudeb") return { text: botTexts.sudeb, buttons: keyboards.section() };
  if (payload === "sec:issled") return { text: botTexts.issled, buttons: keyboards.section() };
  return null;
}

const isApplicationStep = (step: Step) =>
  step === "consent" || step === "name" || step === "direction" || step === "description" || step === "phone" || step === "contact_time" || step === "confirm" || step === "edit";

function matches(text: string, words: readonly string[]): boolean {
  return words.some((word) => text.includes(word));
}

/** Свободный текст вне заявки: команды и ключевые слова, иначе — предложение связаться со специалистом. */
function freeText(text: string, state: FlowState, context: BotContext): BotResult {
  const lower = text.toLowerCase();
  if (state.step === "specialist") {
    // Клиент ждёт специалиста: сообщения передаются ему, подтверждение — один раз.
    if (state.forwarded) return { state, replies: [], needsReply: true };
    return { state: { ...state, forwarded: true }, replies: [{ text: botTexts.forwarded }], needsReply: true };
  }
  if (matches(`${lower} `, botKeywords.price)) {
    return { state: { step: "menu" }, replies: [{ text: botTexts.priceQuestion, buttons: keyboards.unknown() }] };
  }
  if (matches(lower, botKeywords.documents)) {
    return { state: { step: "menu" }, replies: [{ text: botTexts.documents, buttons: keyboards.section() }] };
  }
  if (matches(lower, botKeywords.apply)) return startApplication(context);
  if (matches(lower, botKeywords.specialist)) return toSpecialist();
  for (const key of ["issled", "sudeb", "ocenka"] as const) {
    if (matches(lower, botKeywords[key])) return { state: { step: "menu" }, replies: [section(`sec:${key}`)!] };
  }
  return { state: { step: "menu" }, replies: [{ text: botTexts.unknown, buttons: keyboards.unknown() }] };
}

function toSpecialist(): BotResult {
  const state: FlowState = { step: "specialist" };
  return { state, replies: [prompt(state)], needsReply: true };
}

function handleField(state: FlowState, draft: Draft, text: string): BotResult {
  const value = text.trim();
  const e = botTexts.errors;
  const retry = (message: string): BotResult => ({ state, replies: [{ text: message }, prompt(state)] });

  switch (state.step) {
    case "name":
      if (value.length < 2) return retry(e.nameShort);
      if (value.length > limits.name) return retry(e.nameLong);
      return advance(state, { ...draft, name: value }, draft.direction ? "description" : "direction");
    case "description":
      if (value.length < 10) return retry(e.descriptionShort);
      if (value.length > limits.message) return retry(e.descriptionLong);
      return advance(state, { ...draft, description: value }, "phone");
    case "phone": {
      if (!isValidPhone(value)) return retry(e.phone);
      const result = advance(state, { ...draft, phone: value }, "contact_time");
      return { ...result, phone: value };
    }
    case "contact_time":
      if (value.length > CONTACT_TIME_MAX) return retry(e.contactTimeLong);
      return advance(state, { ...draft, contactTime: value }, "confirm");
    case "direction":
    case "consent":
    case "confirm":
    case "edit":
      // Здесь ожидается нажатие кнопки.
      return { state, replies: [prompt(state)] };
    default:
      return { state, replies: [prompt(state)] };
  }
}

function handleCallback(payload: string, state: FlowState, context: BotContext): BotResult {
  const draft = state.draft;
  const stale = (): BotResult => ({ state, replies: [{ text: botTexts.staleButton }, prompt(state)] });

  // Кнопки, которые работают в любом состоянии.
  if (payload === "menu") {
    const replies = isApplicationStep(state.step) ? [{ text: botTexts.cancelled }, menuReply()] : [menuReply()];
    return { state: { step: "menu" }, replies };
  }
  const info = section(payload);
  if (info) {
    if (isApplicationStep(state.step)) return stale();
    return { state: { step: "menu" }, replies: [info] };
  }
  if (payload === "apply") {
    if (isApplicationStep(state.step)) return { state, replies: [prompt(state)] };
    return startApplication(context);
  }
  if (payload === "specialist") return toSpecialist();
  if (payload === "cancel") {
    if (!isApplicationStep(state.step)) return { state: { step: "menu" }, replies: [menuReply()] };
    return { state: { step: "menu" }, replies: [{ text: botTexts.cancelled }, menuReply()] };
  }

  // Кнопки шагов заявки — действуют только на своём шаге.
  if (!draft) return stale();
  if (payload === "consent:yes" && state.step === "consent") {
    const next: FlowState = { step: "name", draft };
    return { state: next, replies: [prompt(next)], consentGiven: true };
  }
  if (payload.startsWith("dir:") && state.step === "direction") {
    const direction = botDirections.find((d) => `dir:${d.payload}` === payload)?.payload;
    if (!direction) return stale();
    return advance(state, { ...draft, direction }, draft.description ? "phone" : "description");
  }
  if (payload === "skip" && state.step === "phone") return advance(state, { ...draft, phone: "" }, "contact_time");
  if (payload === "skip" && state.step === "contact_time") return advance(state, { ...draft, contactTime: "" }, "confirm");
  if (payload === "edit" && state.step === "confirm") return { state: { step: "edit", draft }, replies: [prompt({ step: "edit", draft })] };
  if (payload === "summary" && state.step === "edit") return { state: { step: "confirm", draft }, replies: [prompt({ step: "confirm", draft })] };
  if (payload.startsWith("edit:") && state.step === "edit") {
    const field = payload.slice(5);
    const steps: Record<string, Step> = { name: "name", direction: "direction", description: "description", phone: "phone", contact_time: "contact_time" };
    const step = steps[field];
    if (!step) return stale();
    const next: FlowState = { step, draft, editing: true };
    return { state: next, replies: [prompt(next)] };
  }
  if (payload === "confirm" && state.step === "confirm") {
    if (!draft.name || !draft.description) return stale();
    return {
      state: { step: "menu" },
      replies: [],
      submit: { ...draft, name: draft.name, description: draft.description },
      needsReply: true,
    };
  }
  return stale();
}

/** Нормализация сохранённого состояния: неизвестное — главное меню. */
export function readState(raw: unknown): FlowState {
  if (!raw || typeof raw !== "object") return { step: "menu" };
  const state = raw as FlowState;
  const steps: Step[] = ["menu", "consent", "name", "direction", "description", "phone", "contact_time", "confirm", "edit", "specialist"];
  if (!steps.includes(state.step)) return { step: "menu" };
  if (isApplicationStep(state.step) && (!state.draft || typeof state.draft.key !== "string")) return { step: "menu" };
  return state;
}

export function runScenario(stateRaw: unknown, input: BotInput, context: BotContext): BotResult {
  const state = readState(stateRaw);

  if (input.type === "start") return { state: { step: "menu" }, replies: [menuReply(botTexts.greeting)] };

  if (input.type === "callback") return handleCallback(input.payload, state, context);

  if (input.type === "contact") {
    if (state.step === "phone" && state.draft && input.phone) {
      const result = advance(state, { ...state.draft, phone: input.phone }, "contact_time");
      return { ...result, phone: input.phone };
    }
    if (state.step === "phone") return { state, replies: [{ text: botTexts.errors.phone }, prompt(state)] };
    return freeText("", state, context);
  }

  if (input.type === "attachment") {
    if (isApplicationStep(state.step)) return { state, replies: [{ text: botTexts.attachment }, prompt(state)] };
    if (state.step === "specialist") return freeText("", state, context);
    return { state: { step: "menu" }, replies: [{ text: botTexts.attachment, buttons: keyboards.unknown() }] };
  }

  const text = input.text.trim();
  const lower = text.toLowerCase();
  // Команды меню действуют везде, в том числе посреди заявки.
  if (botKeywords.menu.includes(lower as (typeof botKeywords.menu)[number])) {
    const replies = isApplicationStep(state.step) ? [{ text: botTexts.cancelled }, menuReply()] : [menuReply(botTexts.greeting)];
    return { state: { step: "menu" }, replies };
  }
  if (!text) return isApplicationStep(state.step) ? { state, replies: [{ text: botTexts.errors.needText }, prompt(state)] } : freeText("", state, context);
  if (isApplicationStep(state.step) && state.draft) return handleField(state, state.draft, text);
  return freeText(text, state, context);
}
