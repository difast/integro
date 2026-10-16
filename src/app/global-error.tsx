"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ru">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1.5rem", color: "#0d1730" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 800 }}>Сайт временно недоступен</h1>
        <p style={{ marginTop: "1rem", color: "#5a6479" }}>Произошла ошибка. Попробуйте обновить страницу позже.</p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "2rem",
            padding: "0.9rem 1.5rem",
            borderRadius: "999px",
            border: 0,
            background: "#b31d2e",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Обновить
        </button>
      </body>
    </html>
  );
}
