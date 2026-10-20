import "server-only";
import { maxAdapter } from "@/lib/max/adapter";
import { telegramAdapter } from "@/lib/telegram/adapter";
import type { ChannelAdapter } from "./adapter";
import type { Channel } from "./types";

/** Подключённые каналы. Новый канал — адаптер и строка здесь. */
const adapters: Record<Channel, ChannelAdapter> = {
  max: maxAdapter,
  telegram: telegramAdapter,
};

export function getAdapter(channel: Channel): ChannelAdapter {
  return adapters[channel];
}
