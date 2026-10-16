import Link from "next/link";
import { company } from "@/config/company";
import { pageMetadata } from "@/lib/metadata";
import { operatorContactText, operatorDescription } from "@/lib/operator";
import { PageHeader } from "@/components/layout/PageHeader";
import { LegalBody, LegalSection } from "@/components/legal/LegalDocument";

export const metadata = pageMetadata({
  title: "Согласие на обработку персональных данных",
  description: "Текст согласия на обработку персональных данных при отправке обращения через сайт ООО «Интегро».",
  path: "/soglasie-na-obrabotku",
});

export default function ConsentPage() {
  return (
    <>
      <PageHeader
        title="Согласие на обработку персональных данных"
        crumbs={[{ label: "Согласие на обработку персональных данных" }]}
        lead={`Редакция от ${company.privacyPolicyDate}`}
      />
      <LegalBody>
        <LegalSection title="Текст согласия">
          <p>
            Отправляя обращение через форму на сайте, я свободно, своей волей и в своём интересе даю согласие{" "}
            {operatorDescription()} (далее — Оператор) на обработку моих персональных данных: имени, номера телефона,
            адреса электронной почты и сведений, указанных мной в тексте обращения.
          </p>
          <p>
            Цель обработки: рассмотрение обращения, связь со мной для ответа на него, а также подготовка к заключению
            договора на оказание услуг.
          </p>
          <p>
            Я согласен на совершение с персональными данными следующих действий: сбор, запись, систематизация,
            накопление, хранение, уточнение, использование, удаление и уничтожение — с использованием средств
            автоматизации и без них.
          </p>
          <p>
            Согласие действует до достижения цели обработки либо до его отзыва. Согласие может быть отозвано путём
            направления Оператору заявления {operatorContactText()}.
          </p>
          <p>
            Порядок обработки персональных данных определён{" "}
            <Link href="/politika-konfidencialnosti" className="link-underline text-ink">
              политикой обработки персональных данных
            </Link>
            .
          </p>
        </LegalSection>
      </LegalBody>
    </>
  );
}
