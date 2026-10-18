import { describe, expect, it } from "vitest";
import { buildPoolConfig, normalizePem } from "@/lib/db/config";

const base = "postgresql://app_user:p%40ss%23word@db.example.net:5432/default_db";

describe("buildPoolConfig", () => {
  it("enables verified TLS for sslmode=verify-full and keeps the encoded password", () => {
    const config = buildPoolConfig({ DATABASE_URL: `${base}?sslmode=verify-full` });
    expect(config.connectionString).toBe(base);
    expect(config.ssl).toEqual({ rejectUnauthorized: true, ca: undefined });
  });

  it("uses the CA certificate from DATABASE_CA_CERT, including escaped line breaks", () => {
    const config = buildPoolConfig({
      DATABASE_URL: `${base}?sslmode=verify-full&sslrootcert=/root/.cloud-certs/root.crt`,
      DATABASE_CA_CERT: "-----BEGIN CERTIFICATE-----\\nABC\\n-----END CERTIFICATE-----",
    });
    expect(config.connectionString).toBe(base);
    expect(config.ssl).toEqual({
      rejectUnauthorized: true,
      ca: "-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----\n",
    });
  });

  it("restores certificates pasted into a single-line field", () => {
    const body = "A".repeat(64) + "B".repeat(10);
    const expected = `-----BEGIN CERTIFICATE-----\n${"A".repeat(64)}\n${"B".repeat(10)}\n-----END CERTIFICATE-----\n`;
    const spaced = `-----BEGIN CERTIFICATE----- ${"A".repeat(64)} ${"B".repeat(10)} -----END CERTIFICATE-----`;
    expect(normalizePem(spaced)).toBe(expected);
    expect(normalizePem(`-----BEGIN CERTIFICATE-----${body}-----END CERTIFICATE-----`)).toBe(expected);
    expect(normalizePem("not a certificate")).toBeUndefined();
    expect(normalizePem(`${spaced}\n${spaced}`)).toBe(expected + expected);
  });

  it("enables TLS with DATABASE_SSL=true and disables it otherwise", () => {
    expect(buildPoolConfig({ DATABASE_URL: base, DATABASE_SSL: "true" }).ssl).toEqual({
      rejectUnauthorized: true,
      ca: undefined,
    });
    expect(buildPoolConfig({ DATABASE_URL: base }).ssl).toBe(false);
    expect(buildPoolConfig({ DATABASE_URL: `${base}?sslmode=disable` }).ssl).toBe(false);
  });

  it("keeps unrelated query parameters", () => {
    const config = buildPoolConfig({ DATABASE_URL: `${base}?sslmode=require&application_name=x` });
    expect(config.connectionString).toBe(`${base}?application_name=x`);
  });
});
