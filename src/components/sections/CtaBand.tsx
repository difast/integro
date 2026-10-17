import { ArrowRight } from "lucide-react";
import { company } from "@/config/company";
import { ButtonLink } from "@/components/ui/Button";

type CtaBandProps = {
  title?: string;
  text?: string;
  /** slug услуги для предзаполнения формы */
  service?: string;
};

/** Призыв к обращению: тёмная панель с бронзовой линией и кнопкой. */
export function CtaBand({
  title = "Опишите задачу — сообщим, какой документ вам нужен",
  text = "После предварительного анализа ответим, возможно ли решение задачи, какие материалы потребуются, а также каковы сроки и стоимость работ.",
  service,
}: CtaBandProps) {
  const { email, workingHours } = company.contacts;
  const href = service ? `/kontakty?usluga=${service}#zayavka` : "/kontakty#zayavka";

  return (
    <section aria-labelledby="cta-title" className="container-page mt-20 lg:mt-28">
      <div className="panel relative overflow-hidden bg-dark px-6 py-12 sm:px-12 lg:px-16 lg:py-16">
        <span aria-hidden="true" className="absolute top-0 left-6 h-[3px] w-24 bg-bronze sm:left-12 lg:left-16" />
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <h2 id="cta-title" className="h-section text-white">
              {title}
            </h2>
            <p className="mt-5 max-w-[38rem] text-[1.0625rem] leading-relaxed text-on-dark">{text}</p>
          </div>
          <div className="lg:col-span-5 lg:justify-self-end">
            <ButtonLink href={href} variant="bronze" className="w-full sm:w-auto">
              Оставить заявку
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </ButtonLink>
            {email || workingHours ? (
              <p className="mt-5 text-[0.875rem] text-on-dark">
                {email ? (
                  <a href={`mailto:${email}`} className="text-white underline decoration-bronze underline-offset-4">
                    {email}
                  </a>
                ) : null}
                {email && workingHours ? <br /> : null}
                {workingHours}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
