/* Service Worker панели заявок ООО «Интегро»: показывает push-уведомления и открывает нужную страницу.
   В уведомлениях нет персональных данных клиентов — только тип события и ссылка в админку. */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" ? data.title : "Уведомление ООО «Интегро»";
  const url = typeof data.url === "string" && data.url.startsWith("/admin") ? data.url : "/admin/uvedomleniya";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      tag: typeof data.tag === "string" ? data.tag : undefined,
      icon: "/icon.png",
      badge: "/icon.png",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin/uvedomleniya";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes("/admin") && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

self.addEventListener("pushsubscriptionchange", () => {
  // Браузер сменил подписку: новая будет сохранена при следующем открытии настроек уведомлений.
});
