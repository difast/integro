"use client";

// Глобальная ошибка рендерится без стилей сайта, поэтому цвета палитры заданы inline.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ru">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1.5rem", color: "#263746", background: "#e8edf1" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 500 }}>Сайт временно недоступен</h1>
        <p style={{ marginTop: "1rem", color: "#5e676c" }}>Произошла ошибка. Попробуйте обновить страницу позже.</p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "2rem",
            padding: "0.9rem 1.5rem",
            borderRadius: "10px",
            border: 0,
            background: "#263746",
            color: "#fff",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Обновить
        </button>
      </body>
    </html>
  );
}
