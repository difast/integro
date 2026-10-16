import { ArrowRight } from "lucide-react";
import { company } from "@/config/company";
import { phoneHref } from "@/lib/site";
import { ButtonLink, buttonClass } from "@/components/ui/Button";

type CtaBandProps = {
  title?: string;
  text?: string;
  /** slug услуги для предзаполнения формы */
  service?: string;
};

export function CtaBand({
  title = "Опишите задачу — подскажем, какой документ вам нужен",
  text = "После предварительного анализа сообщим, возможно ли решение задачи, какие материалы потребуются, а также сроки и стоимость работ.",
  service,
}: CtaBandProps) {
  const { phone } = company.contacts;
  const href = service ? `/kontakty?usluga=${service}#zayavka` : "/kontakty#zayavka";

  return (
    <section aria-labelledby="cta-title" className="container-page py-16 lg:py-20">
      <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-navy-900 px-6 py-12 sm:px-12 lg:px-16 lg:py-16">
        <div
          aria-hidden="true"
          className="absolute top-0 right-0 h-full w-2 bg-accent sm:w-3"
        />
        <div className="grid items-end gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <h2 id="cta-title" className="text-[1.75rem] leading-[1.15] font-extrabold tracking-[-0.02em] text-white sm:text-[2.3rem]">
              {title}
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-navy-200">{text}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch xl:flex-row xl:justify-end">
            <ButtonLink href={href} variant="primary">
              Оставить заявку
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </ButtonLink>
            {phone ? (
              <a href={phoneHref(phone)} className={buttonClass("outline-light")}>
                {phone}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
