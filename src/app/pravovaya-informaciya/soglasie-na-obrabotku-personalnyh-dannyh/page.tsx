import Link from "next/link";
import { legalDocuments } from "@/config/legal";
import { pageMetadata } from "@/lib/metadata";
import { ConsentBody } from "@/content/legal/consent";
import { Clause, Items, LegalDocument, type LegalSectionData } from "@/components/legal/LegalDocument";

const doc = legalDocuments.consent;

export const metadata = pageMetadata({
  title: doc.title,
  description:
    "Текст согласия на обработку персональных данных, которое даёт посетитель сайта ООО «Интегро» при отправке заявки, порядок его получения и отзыва.",
  path: doc.href,
});

export default function ConsentPage() {
  const sections: LegalSectionData[] = [
    {
      id: "tekst",
      title: "Текст согласия",
      content: <ConsentBody />,
    },
    {
      id: "kak-daetsya",
      title: "Как даётся согласие",
      content: (
        <>
          <Clause n="2.1.">
            <p>Согласие даётся при отправке формы заявки на странице «Контакты»:</p>
            <Items>
              <li>
                в форме есть отдельное поле согласия, которое изначально не отмечено; отметить его может только сам
                посетитель;
              </li>
              <li>полный текст согласия можно раскрыть непосредственно в форме до её отправки;</li>
              <li>
                поле согласия не объединено с другими подтверждениями: в форме нет иных отметок, которые посетитель
                должен поставить, а рекламные рассылки через форму не оформляются;
              </li>
              <li>без отметки согласия заявка не отправляется — это проверяется на сервере Сайта.</li>
            </Items>
          </Clause>
          <Clause n="2.2.">
            <p>
              В письме с заявкой, которое получает оператор, указываются дата и время отправки и дата редакции
              согласия, действовавшей в этот момент.
            </p>
          </Clause>
          <Clause n="2.3.">
            <p>
              Порядок обработки персональных данных описан в документе{" "}
              <Link href={legalDocuments.policy.href} className="text-link">
                «{legalDocuments.policy.title}»
              </Link>
              .
            </p>
          </Clause>
        </>
      ),
    },
  ];

  return (
    <LegalDocument
      title={doc.title}
      lead="Согласие, которое даёт посетитель сайта при отправке заявки через форму."
      sections={sections}
    />
  );
}
