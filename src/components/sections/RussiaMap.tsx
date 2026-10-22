import { RUSSIA_VIEWBOX, russiaRegions } from "@/data/russia-regions";
import { SectionHead } from "@/components/ui/SectionHead";
import { RussiaMapInteractive } from "./RussiaMapInteractive";

/**
 * Блок «География» на главной: карта 89 субъектов РФ. Контуры рисуются на сервере (SVG), клиентская часть —
 * только анимация появления и выбор региона. Анимация показывает охват территории, из которой принимаются
 * обращения, а не филиалы или количество работ.
 */
export function RussiaMap() {
  const options = russiaRegions
    .map((r) => ({ id: r.id, name: r.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  return (
    <section aria-labelledby="geography-title" className="container-page mt-20 lg:mt-28">
      <div className="panel bg-white px-6 py-12 sm:px-10 lg:px-14 lg:py-16">
        <SectionHead
          id="geography-title"
          eyebrow="География"
          title="Работаем с заказчиками по всей России"
          lead="Принимаем обращения из любого субъекта Российской Федерации и выезжаем на осмотр по всей России. Выберите свой регион — и оставьте заявку."
        />
        <RussiaMapInteractive regions={options}>
          <svg viewBox={RUSSIA_VIEWBOX} className="block h-auto w-full" role="img" aria-label="Карта России: 89 субъектов Российской Федерации">
            {russiaRegions.map((region, index) => (
              <path key={region.id} d={region.d} data-id={region.id} data-name={region.name} style={{ "--i": index } as React.CSSProperties} />
            ))}
          </svg>
        </RussiaMapInteractive>
      </div>
    </section>
  );
}
