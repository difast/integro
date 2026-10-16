import type {Node} from "@motion-canvas/2d";
import {all, easeInCubic, easeOutCubic, waitFor, type ThreadGenerator} from "@motion-canvas/core";
import {scenes, sceneStart} from "../timeline";

/** Время начала реплики относительно начала сцены — визуал следует за озвучкой. */
export function cueAt(sceneId: string, index: number): number {
  const scene = scenes.find((s) => s.id === sceneId);
  const cue = scene?.cues[index];
  if (!scene || !cue) throw new Error(`No cue ${sceneId}[${index}]`);
  return cue.start - sceneStart(sceneId);
}

export function durationOf(sceneId: string): number {
  const scene = scenes.find((s) => s.id === sceneId);
  if (!scene) throw new Error(`No scene ${sceneId}`);
  return scene.duration;
}

/** Затухание сцены: начинается за EXIT_LEAD до конца и перекрывается со входом следующей. */
export const EXIT_LEAD = 0.45;
export const EXIT_TIME = 0.8;

export function* fadeIn(node: Node, time = 0.8, dy = 24): ThreadGenerator {
  node.opacity(0);
  node.y(node.y() + dy);
  yield* all(node.opacity(1, time, easeOutCubic), node.y(node.y() - dy, time, easeOutCubic));
}

export function* exitScene(group: Node): ThreadGenerator {
  yield* all(group.opacity(0, EXIT_TIME, easeInCubic), group.scale(1.03, EXIT_TIME, easeInCubic));
  group.remove();
}

/** Выполнить анимации сцены и удерживать её до момента выхода. */
export function* runScene(sceneId: string, group: Node, ...tasks: ThreadGenerator[]): ThreadGenerator {
  yield* all(waitFor(durationOf(sceneId) - EXIT_LEAD), ...tasks);
  yield* exitScene(group);
}
