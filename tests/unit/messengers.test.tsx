import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getMessengers, MessengerLinks } from "@/components/ui/MessengerLinks";
import { company } from "@/config/company";

describe("контакты", () => {
  it("телефон и мессенджеры заданы", () => {
    expect(company.contacts.phone).toBe("+7 (936) 313-32-02");
    const items = getMessengers();
    expect(items.map((i) => i.key)).toEqual(["whatsapp", "telegram", "max"]);
    expect(items[0]!.href).toBe("https://wa.me/79363133202");
    expect(items[2]!.href).toBe("https://web.max.ru/");
    expect(renderToStaticMarkup(<MessengerLinks items={[]} />)).toBe("");
  });

  it("кнопка появляется, как только задана ссылка", () => {
    const html = renderToStaticMarkup(
      <MessengerLinks
        items={[
          { key: "telegram", label: "Telegram", href: "https://t.me/example" },
          { key: "max", label: "MAX", href: "https://max.ru/example" },
        ]}
      />,
    );
    expect(html).toContain('href="https://t.me/example"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain(">Telegram<");
    expect(html).toContain(">MAX<");
    expect(html).not.toContain("WhatsApp");
  });

  it("в компактном варианте у значков есть подписи для экранных дикторов", () => {
    const html = renderToStaticMarkup(
      <MessengerLinks variant="compact" items={[{ key: "whatsapp", label: "WhatsApp", href: "https://wa.me/79363133202" }]} />,
    );
    expect(html).toContain('aria-label="Написать в WhatsApp"');
  });
});
