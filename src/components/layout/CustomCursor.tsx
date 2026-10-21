"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Кастомный курсор публичной части сайта: точка точно под указателем и кольцо, догоняющее её с лёгкой инерцией.
 *
 * Модальные окна (<dialog>) показываются в верхнем слое браузера поверх любого z-index, поэтому в них
 * кастомный курсор скрывается и действует системный.
 *
 * Включается только на устройствах с мышью (hover: hover, pointer: fine) и без prefers-reduced-motion,
 * и только после первого реального движения мыши. Системный курсор скрывается классом на <html>, пока
 * кастомный активен; в полях ввода, списках, видео и iframe возвращается системный курсор (с текстовой кареткой),
 * а кастомный плавно скрывается.
 *
 * React не перерисовывается при движении: позиция пишется в transform через requestAnimationFrame, цикл
 * останавливается, когда кольцо догнало указатель. Состояния (hover, card, click, тёмный фон) меняются
 * data-атрибутами только при смене элемента под курсором (pointerover), а не на каждое движение.
 */

const ACTIVE_CLASS = "has-custom-cursor";
const INTERACTIVE = 'a[href], button, [role="button"], [role="tab"], [role="link"], summary, label, input[type="checkbox"], input[type="radio"], input[type="submit"], input[type="button"], [data-cursor="hover"]';
const NATIVE = 'input:not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]), textarea, select, [contenteditable=""], [contenteditable="true"], video[controls], iframe, dialog, [data-cursor="native"]';
// Тёмные поверхности сайта: на них курсор светлый.
const DARK = ".bg-dark, .bg-dark-800, .bg-dark-950, .bg-navy-900, .bg-navy-950, [data-cursor-theme='dark']";
// Кликабельная карточка: крупная ссылка или кнопка.
const CARD_MIN_WIDTH = 220;
const CARD_MIN_HEIGHT = 120;
// Время сглаживания кольца, мс (чем больше — тем заметнее инерция).
const RING_LAG_MS = 85;

export function CustomCursor() {
  const rootRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const root = rootRef.current;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!root || !dot || !ring) return;

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const html = document.documentElement;

    let enabled = false;
    let visible = false;
    let frame = 0;
    let last = 0;
    const target = { x: 0, y: 0 };
    const pos = { x: 0, y: 0 };

    const place = () => {
      dot.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
      ring.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    };

    const tick = (now: number) => {
      const dt = Math.min(64, now - (last || now));
      last = now;
      const k = 1 - Math.exp(-dt / RING_LAG_MS);
      pos.x += (target.x - pos.x) * k;
      pos.y += (target.y - pos.y) * k;
      place();
      if (Math.abs(target.x - pos.x) < 0.1 && Math.abs(target.y - pos.y) < 0.1) {
        pos.x = target.x;
        pos.y = target.y;
        place();
        frame = 0;
        last = 0;
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const show = (value: boolean) => {
      if (visible === value) return;
      visible = value;
      root.dataset.visible = value ? "true" : "false";
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      target.x = event.clientX;
      target.y = event.clientY;
      if (!visible && root.dataset.state !== "native") {
        // Первая позиция: кольцо появляется сразу на месте указателя, без «прилёта» из угла.
        if (!html.classList.contains(ACTIVE_CLASS)) {
          pos.x = target.x;
          pos.y = target.y;
          html.classList.add(ACTIVE_CLASS);
        }
        place();
        show(true);
      }
      schedule();
    };

    const onOver = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const el = event.target instanceof Element ? event.target : null;
      if (!el) return;
      root.dataset.theme = el.closest(DARK) ? "dark" : "light";
      if (el.closest(NATIVE)) {
        root.dataset.state = "native";
        show(false);
        return;
      }
      const interactive = el.closest(INTERACTIVE);
      if (interactive && !interactive.matches(':disabled, [aria-disabled="true"]')) {
        const rect = interactive.getBoundingClientRect();
        root.dataset.state = rect.width >= CARD_MIN_WIDTH && rect.height >= CARD_MIN_HEIGHT ? "card" : "hover";
      } else {
        root.dataset.state = "default";
      }
      if (html.classList.contains(ACTIVE_CLASS)) show(true);
    };

    const onDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse") root.dataset.pressed = "true";
      // Ноутбук с сенсорным экраном: касание скрывает курсор до следующего движения мыши.
      else show(false);
    };
    const onUp = () => {
      root.dataset.pressed = "false";
    };
    // Указатель ушёл за пределы окна (в том числе в адресную строку или другое окно).
    const onLeave = (event: MouseEvent) => {
      if (!event.relatedTarget) show(false);
    };
    const onBlur = () => {
      show(false);
      root.dataset.pressed = "false";
    };

    const listeners: [EventTarget, string, EventListener, AddEventListenerOptions?][] = [
      [window, "pointermove", onMove as EventListener, { passive: true }],
      [document, "pointerover", onOver as EventListener, { passive: true }],
      [window, "pointerdown", onDown as EventListener, { passive: true }],
      [window, "pointerup", onUp as EventListener, { passive: true }],
      // Перетаскивание ссылки или картинки завершается без pointerup.
      [window, "pointercancel", onUp as EventListener, { passive: true }],
      [window, "dragend", onUp as EventListener, { passive: true }],
      [document, "mouseout", onLeave as EventListener, { passive: true }],
      [window, "blur", onBlur as EventListener],
    ];

    const enable = () => {
      if (enabled) return;
      enabled = true;
      for (const [t, type, fn, opts] of listeners) t.addEventListener(type, fn, opts);
    };
    const disable = () => {
      if (!enabled) return;
      enabled = false;
      for (const [t, type, fn] of listeners) t.removeEventListener(type, fn);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      show(false);
      html.classList.remove(ACTIVE_CLASS);
    };
    const update = () => (finePointer.matches && !reducedMotion.matches ? enable() : disable());

    update();
    finePointer.addEventListener("change", update);
    reducedMotion.addEventListener("change", update);
    return () => {
      finePointer.removeEventListener("change", update);
      reducedMotion.removeEventListener("change", update);
      disable();
    };
  }, []);

  // Смена страницы: элемент под курсором заменился — возвращаем обычное состояние до следующего наведения.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.dataset.state = "default";
    root.dataset.pressed = "false";
  }, [pathname]);

  return (
    <div ref={rootRef} className="custom-cursor" aria-hidden="true" data-visible="false" data-state="default" data-theme="light" data-pressed="false">
      <div ref={ringRef} className="custom-cursor__ring">
        <span className="custom-cursor__ring-shape" />
      </div>
      <div ref={dotRef} className="custom-cursor__dot">
        <span className="custom-cursor__dot-shape" />
      </div>
    </div>
  );
}
