/**
 * Генерирует из src/timeline.ts: VOICEOVER.md (текст озвучки с таймкодами),
 * субтитры WebVTT и расшифровку для сайта (src/content/video-transcript.json),
 * а также проверяет темп речи.
 * Запуск: npm run voiceover
 */
import {writeFileSync} from "node:fs";
import {allCues, scenes, totalDuration} from "../src/timeline.ts";

// Комфортный темп дикторской речи на русском — до ~15 символов в секунду.
const MAX_CPS = 15;

const tc = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${String(m).padStart(1, "0")}:${sec.toFixed(1).padStart(4, "0")}`;
};
const vtt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `00:${String(m).padStart(2, "0")}:${sec.toFixed(3).padStart(6, "0")}`;
};

const lines: string[] = [];
const warnings: string[] = [];
lines.push("# Текст озвучки ролика ООО «Интегро»", "");
lines.push(
  `Длительность ролика: ${totalDuration.toFixed(1)} с. Темп — спокойный, деловой.`,
  "Каждая реплика должна звучать в своём интервале: начало — по таймкоду, паузы между репликами сохранить.",
  "Удобнее всего записать одним дублем под воспроизведение ролика без звука.",
  "",
  "Файл генерируется из `src/timeline.ts` командой `npm run voiceover` — не редактируйте его вручную.",
  "",
);

let sceneStart = 0;
for (const scene of scenes) {
  lines.push(`## ${scene.title} (${tc(sceneStart)}–${tc(sceneStart + scene.duration)})`, "");
  for (const cue of scene.cues) {
    const len = cue.text.replace(/\s+/g, " ").length;
    const cps = len / (cue.end - cue.start);
    if (cps > MAX_CPS) warnings.push(`${tc(cue.start)} «${cue.text}» — ${cps.toFixed(1)} симв./с`);
    lines.push(`- **${tc(cue.start)}–${tc(cue.end)}** — ${cue.text}`);
  }
  lines.push("");
  sceneStart += scene.duration;
}

lines.push("## Текст целиком", "", allCues.map((c) => c.text).join(" "), "");
writeFileSync(new URL("../VOICEOVER.md", import.meta.url), lines.join("\n"));

const vttBody = ["WEBVTT", ""];
allCues.forEach((cue, i) => vttBody.push(String(i + 1), `${vtt(cue.start)} --> ${vtt(cue.end)}`, cue.text, ""));
writeFileSync(new URL("../output/integro-video.ru.vtt", import.meta.url), vttBody.join("\n"));

// Расшифровка для сайта (блок «Текст ролика» рядом с видео).
const transcript = {
  duration: Number(totalDuration.toFixed(1)),
  cues: allCues.map(({start, end, text}) => ({start, end, text})),
};
writeFileSync(
  new URL("../../src/content/video-transcript.json", import.meta.url),
  JSON.stringify(transcript, null, 2) + "\n",
);

const words = allCues.map((c) => c.text).join(" ").split(/\s+/).filter((w) => /[\p{L}\d]/u.test(w)).length;
console.log(`Длительность: ${totalDuration} с, реплик: ${allCues.length}, слов: ${words}`);
for (const cue of allCues) {
  const cps = cue.text.length / (cue.end - cue.start);
  console.log(`${tc(cue.start)}  ${cps.toFixed(1).padStart(4)} симв./с  ${cue.text}`);
}
if (warnings.length) {
  console.log("\nСлишком быстрый темп:\n" + warnings.join("\n"));
  process.exitCode = 1;
}
