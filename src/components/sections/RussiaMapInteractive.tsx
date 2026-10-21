"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, MapPin } from "lucide-react";
import { RequestTrigger } from "@/components/request/RequestModal";
import { buttonClass } from "@/components/ui/Button";

/**
 * Интерактивная часть карты субъектов РФ. Обработчики — на контейнере (делегирование), состояние контуров
 * меняется атрибутами без перерисовки 89 элементов. Состояния появления (data-reveal):
 * static — без JavaScript и при первой отрисовке: регионы сразу закрашены;
 * pending → in — блок ещё не виден, при появлении регионы закрашиваются с запада на восток;
 * done — анимация закончилась (или не нужна: блок уже был на экране, prefers-reduced-motion).
 */

const STEP_MS = 18;
const FILL_MS = 600;

export function RussiaMapInteractive({ regions, children }: { regions: { id: string; name: string }[]; children: ReactNode }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

  // Анимация появления: только один раз; при повторном попадании блока в экран карта уже закрашена.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rect = map.getBoundingClientRect();
    const visibleNow = rect.top < window.innerHeight && rect.bottom > 0;
    if (reduce || visibleNow || !("IntersectionObserver" in window)) {
      map.dataset.reveal = "done";
      return;
    }
    map.dataset.reveal = "pending";
    let timer = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        map.dataset.reveal = "in";
        timer = window.setTimeout(() => (map.dataset.reveal = "done"), regions.length * STEP_MS + FILL_MS + 100);
      },
      { threshold: 0.3 },
    );
    observer.observe(map);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      map.dataset.reveal = "done";
    };
  }, [regions.length]);

  // Выделение выбранного контура — атрибутом, без перерисовки карты.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.querySelector("path[data-selected]")?.removeAttribute("data-selected");
    if (selected) map.querySelector(`path[data-id="${selected.id}"]`)?.setAttribute("data-selected", "");
  }, [selected]);

  const regionAt = (target: EventTarget | null) => {
    const path = target instanceof Element ? target.closest("path[data-id]") : null;
    return path ? { id: path.getAttribute("data-id")!, name: path.getAttribute("data-name")! } : null;
  };

  // Подсказка с названием — только для мыши; на сенсорных экранах название показывается после нажатия.
  const moveTip = (event: React.PointerEvent) => {
    const tip = tipRef.current;
    const map = mapRef.current;
    if (!tip || !map || event.pointerType !== "mouse") return;
    const region = regionAt(event.target);
    if (!region) {
      tip.hidden = true;
      return;
    }
    const box = map.getBoundingClientRect();
    tip.textContent = region.name;
    tip.hidden = false;
    const x = Math.min(event.clientX - box.left + 14, box.width - tip.offsetWidth - 4);
    tip.style.transform = `translate(${Math.max(4, x)}px, ${event.clientY - box.top + 16}px)`;
  };

  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-start lg:gap-10">
      <div className="min-w-0 lg:col-span-8">
        <div>
          <div
            ref={mapRef}
            className="russia-map relative"
            data-reveal="static"
            onPointerMove={moveTip}
            onPointerLeave={() => tipRef.current && (tipRef.current.hidden = true)}
            onClick={(event) => {
              const region = regionAt(event.target);
              if (region) setSelected(region);
            }}
            data-testid="russia-map"
          >
            {children}
            <div
              ref={tipRef}
              hidden
              role="tooltip"
              className="pointer-events-none absolute top-0 left-0 z-10 max-w-[16rem] rounded-[var(--radius-control)] bg-dark px-3 py-1.5 text-[0.8125rem] font-medium text-white shadow-md"
            />
          </div>
        </div>
        <p className="mt-2 text-[0.75rem] text-muted sm:hidden">Небольшие регионы удобнее выбрать в списке ниже.</p>
      </div>

      <div className="lg:col-span-4">
        <label htmlFor="region-select" className="block text-[0.875rem] font-medium text-ink">
          Ваш регион
        </label>
        <select
          id="region-select"
          value={selected?.id ?? ""}
          onChange={(e) => {
            const region = regions.find((r) => r.id === e.target.value);
            setSelected(region ?? null);
          }}
          className="mt-1.5 block w-full rounded-[var(--radius-control)] border border-line-strong bg-white px-3.5 py-2.5 text-[0.9375rem] text-ink focus:border-dark focus:outline-none"
        >
          <option value="">Выберите субъект РФ…</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        <div aria-live="polite" className="mt-5 rounded-[var(--radius-card)] bg-mist px-5 py-5" data-testid="russia-map-info">
          {selected ? (
            <>
              <p className="flex items-start gap-2 text-[1.0625rem] font-medium text-ink">
                <MapPin aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-bronze-deep" />
                {selected.name}
              </p>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
                Из этого региона можно обратиться за оценкой, судебной экспертизой или экспертным исследованием. Опишите
                задачу — специалист ответит и уточнит порядок работы.
              </p>
              <RequestTrigger href={`/kontakty?region=${selected.id}#zayavka`} className={buttonClass("primary", "mt-4 min-h-11 px-5")}>
                Оставить заявку
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </RequestTrigger>
            </>
          ) : (
            <p className="text-[0.9375rem] leading-relaxed text-muted">
              Нажмите на регион на карте или выберите его в списке, чтобы оставить заявку из вашего субъекта.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
