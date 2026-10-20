"use client";

import { useEffect } from "react";
import { captureAttribution } from "@/lib/requests/attribution";

/** Запоминает источник первого захода во вкладке (см. src/lib/requests/attribution.ts). */
export function AttributionCapture() {
  useEffect(() => captureAttribution(), []);
  return null;
}
