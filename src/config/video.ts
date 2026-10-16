import transcript from "@/content/video-transcript.json";

/**
 * Ролик о компании (исходники — папка video/, Motion Canvas).
 * Расшифровка генерируется из video/src/timeline.ts командой `npm run voiceover` в папке video.
 */
export const companyVideo = {
  title: "ООО «Интегро»: как мы помогаем разобраться в вашем вопросе",
  webm: "/video/integro.webm",
  mp4: "/video/integro.mp4",
  poster: "/video/integro-poster.jpg",
  width: 1920,
  height: 1080,
  /**
   * Есть ли в ролике озвучка. Пока запись не добавлена, кнопка звука не показывается,
   * чтобы не обещать то, чего нет. После добавления озвучки (video/audio/) — true.
   */
  hasAudio: false,
  transcript,
};
