/// <reference types="@motion-canvas/core/project" />
import {makeProject} from "@motion-canvas/core";
import "./fonts.css";
import main from "./scenes/main?scene";

// Шрифт должен быть загружен до первого измерения текста.
await Promise.all(
  [400, 500, 600].map((weight) => document.fonts.load(`${weight} 40px "IBM Plex Sans"`, "Интегро Aa")),
);

export default makeProject({
  scenes: [main],
  // Когда будет готова запись голоса, положите её в audio/voiceover.wav и раскомментируйте:
  // audio: voiceover,
});
