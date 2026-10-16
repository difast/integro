/**
 * Единый источник таймингов ролика.
 *
 * Из этого файла берутся:
 *  - длительность каждой сцены (src/scenes/main.tsx);
 *  - субтитры, которые вшиваются в видео;
 *  - текст озвучки с таймкодами (npm run voiceover → VOICEOVER.md).
 *
 * Когда будет готова запись голоса, достаточно поправить `start` у реплик
 * и `duration` у сцен под фактическую запись и перерендерить ролик.
 */

export type Cue = {
  /** Начало реплики, секунды от начала ролика */
  start: number;
  /** Конец реплики, секунды от начала ролика */
  end: number;
  text: string;
};

export type SceneTiming = {
  id: string;
  title: string;
  /** Длительность сцены, секунды */
  duration: number;
  cues: Cue[];
};

export const FPS = 30;

export const scenes: SceneTiming[] = [
  {
    id: "problem",
    title: "Проблема",
    duration: 8.4,
    cues: [
      {start: 0.6, end: 3.5, text: "Сколько на самом деле стоит имущество?"},
      {start: 4.0, end: 7.9, text: "Кто прав в споре, где у каждой стороны свои расчёты?"},
    ],
  },
  {
    id: "stakes",
    title: "Что на кону",
    duration: 7.8,
    cues: [
      {start: 8.9, end: 12.6, text: "В сделке, в споре, в суде нужен не просто ответ,"},
      {start: 12.9, end: 16.1, text: "а обоснованный вывод, оформленный документом."},
    ],
  },
  {
    id: "solution",
    title: "Решение",
    duration: 8,
    cues: [
      {start: 16.8, end: 19.1, text: "«Интегро» помогает разобраться:"},
      {start: 19.4, end: 24.0, text: "оценка имущества, судебная экспертиза, экспертные исследования."},
    ],
  },
  {
    id: "basis",
    title: "На чём основана работа",
    duration: 5.6,
    cues: [{start: 24.7, end: 29.0, text: "В основе — анализ, специальные знания и требования закона."}],
  },
  {
    id: "process",
    title: "Как мы работаем",
    duration: 15.6,
    cues: [
      {start: 30.3, end: 31.7, text: "Как мы работаем."},
      {start: 32.2, end: 33.8, text: "Вы описываете задачу."},
      {start: 34.8, end: 36.8, text: "Мы изучаем её и материалы,"},
      {start: 37.8, end: 41.0, text: "проводим необходимые исследования и расчёты"},
      {start: 41.6, end: 44.8, text: "и готовим результат — отчёт или заключение."},
    ],
  },
  {
    id: "value",
    title: "Ценность",
    duration: 7.8,
    cues: [
      {start: 45.9, end: 49.3, text: "Вы получаете ясность, аргументированные выводы"},
      {start: 49.6, end: 53.0, text: "и документ, который помогает решать вашу задачу."},
    ],
  },
  {
    id: "cta",
    title: "Призыв к действию",
    duration: 6.4,
    cues: [
      {start: 53.7, end: 55.9, text: "Расскажите о своей ситуации —"},
      {start: 56.1, end: 58.7, text: "оставьте заявку на сайте «Интегро»."},
    ],
  },
];

export const totalDuration = scenes.reduce((sum, scene) => sum + scene.duration, 0);

/** Начало сцены, секунды от начала ролика. */
export function sceneStart(id: string): number {
  let t = 0;
  for (const scene of scenes) {
    if (scene.id === id) return t;
    t += scene.duration;
  }
  throw new Error(`Unknown scene ${id}`);
}

export const allCues: Cue[] = scenes.flatMap((scene) => scene.cues);
