import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Автономная сборка нужна только для Docker-образа (см. Dockerfile).
  // При обычном запуске через `npm start` переменная не задаётся.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Старые адреса документов ведут на единственные действующие версии.
  async redirects() {
    return [
      {
        source: "/politika-konfidencialnosti",
        destination: "/pravovaya-informaciya/politika-obrabotki-personalnyh-dannyh",
        permanent: true,
      },
      {
        source: "/soglasie-na-obrabotku",
        destination: "/pravovaya-informaciya/soglasie-na-obrabotku-personalnyh-dannyh",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      // Панель заявок и её API: не индексировать, не кешировать, не встраивать во фреймы.
      ...["/admin", "/admin/:path*", "/api/admin/:path*"].map((source) => ({
        source,
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      })),
    ];
  },
};

export default nextConfig;
