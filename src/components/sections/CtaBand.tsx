import { ArrowRight } from "lucide-react";
import { company } from "@/config/company";
import { phoneHref, workingHoursInline } from "@/lib/site";
import { ButtonLink, buttonClass } from "@/components/ui/Button";

type CtaBandProps = {
  title?: string;
  text?: string;
  /** slug услуги для предзаполнения формы */
  service?: string;
};

export function CtaBand({
  title = "Опишите задачу — сообщим, какой документ вам нужен",
  text = "После предварительного анализа ответим, возможно ли решение задачи, какие материалы потребуются, а также каковы сроки и стоимость работ.",
  service,
}: CtaBandProps) {
  const { phone, workingHours } = company.contacts;
  const href = service ? `/kontakty?usluga=${service}#zayavka` : "/kontakty#zayavka";

  return (
    <section aria-labelledby="cta-title" className="bg-navy-900 text-white">
      <div className="container-page grid gap-10 py-16 lg:grid-cols-12 lg:gap-8 lg:py-20">
        <div className="lg:col-span-7 lg:col-start-4">
          <h2 id="cta-title" className="h-section text-white">
            {title}
          </h2>
          <p className="mt-5 max-w-[38rem] text-[1.0625rem] leading-relaxed text-navy-300">{text}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <ButtonLink href={href} variant="light">
              Оставить заявку
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </ButtonLink>
            {phone ? (
              <a href={phoneHref(phone)} className={buttonClass("outline-light")}>
                {phone}
              </a>
            ) : null}
          </div>
          {workingHours ? <p className="mt-6 text-[0.875rem] text-navy-300">Часы связи: {workingHoursInline()}</p> : null}
        </div>
      </div>
    </section>
  );
}
