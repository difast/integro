"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing, Loader2 } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";

type Status = "checking" | "unsupported" | "denied" | "off" | "on" | "busy";

function base64ToUint8Array(value: string): Uint8Array {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function post(body: unknown): Promise<boolean> {
  const response = await fetch("/api/admin/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return response.ok;
}

/**
 * Включение браузерных push-уведомлений на этом устройстве. Разрешение запрашивается только по нажатию
 * кнопки. Доставка не гарантирована: зависит от браузера, системы и их настроек.
 */
export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!publicKey) return setStatus("unsupported");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setStatus("unsupported");
      if (Notification.permission === "denied") return setStatus("denied");
      const registration = await navigator.serviceWorker.getRegistration("/admin/");
      const subscription = await registration?.pushManager.getSubscription();
      setStatus(subscription ? "on" : "off");
      // Подписка есть в браузере — обновить её на сервере (например, после смены ключей браузером).
      if (subscription) void post({ action: "subscribe", subscription: subscription.toJSON(), label: navigator.platform });
    })().catch(() => setStatus("unsupported"));
  }, [publicKey]);

  async function enable() {
    if (!publicKey) return;
    setStatus("busy");
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.register("/admin-sw.js", { scope: "/admin/" });
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToUint8Array(publicKey) as BufferSource }));
      if (!(await post({ action: "subscribe", subscription: subscription.toJSON(), label: navigator.platform }))) throw new Error("server");
      setStatus("on");
      setMessage("Push-уведомления включены на этом устройстве.");
    } catch {
      setStatus("off");
      setMessage("Не удалось включить push-уведомления. Проверьте разрешения браузера и попробуйте ещё раз.");
    }
  }

  async function disable() {
    setStatus("busy");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/admin/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await post({ action: "unsubscribe", subscription: subscription.toJSON() });
        await subscription.unsubscribe();
      }
      setStatus("off");
      setMessage("Push-уведомления на этом устройстве отключены.");
    } catch {
      setStatus("on");
      setMessage("Не удалось отключить. Попробуйте ещё раз.");
    }
  }

  return (
    <div className="space-y-3">
      {status === "unsupported" ? (
        <p className="text-[0.9375rem] text-muted">
          {publicKey ? "Этот браузер не поддерживает push-уведомления (на iPhone — только для сайта, добавленного на экран «Домой», iOS 16.4+)." : "Push не настроен на сервере: задайте VAPID_PUBLIC_KEY и VAPID_PRIVATE_KEY."}
        </p>
      ) : status === "denied" ? (
        <p className="text-[0.9375rem] text-muted">Уведомления для этого сайта запрещены в настройках браузера. Разрешите их там и обновите страницу.</p>
      ) : status === "on" ? (
        <button type="button" onClick={disable} className={buttonClass("outline", "min-h-11 bg-white px-5")}>
          <BellOff aria-hidden="true" className="h-4 w-4" />
          Отключить на этом устройстве
        </button>
      ) : (
        <button type="button" onClick={enable} disabled={status !== "off"} className={buttonClass("primary", "min-h-11 px-5")}>
          {status === "busy" || status === "checking" ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <BellRing aria-hidden="true" className="h-4 w-4" />}
          Включить push-уведомления
        </button>
      )}
      {message ? <p role="status" className="text-[0.875rem] text-ink">{message}</p> : null}
    </div>
  );
}
