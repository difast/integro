import { describe, expect, it } from "vitest";
import { buildPoolConfig, describeConnection, normalizePem, parseDatabaseUrl } from "@/lib/db/config";

describe("parseDatabaseUrl", () => {
  const expected = { user: "app_user", password: "p@ss#w?rd/:%x", host: "db.example.net", port: 5432, database: "default_db" };

  it("reads an encoded password", () => {
    expect(parseDatabaseUrl("postgresql://app_user:p%40ss%23w%3Frd%2F%3A%25x@db.example.net:5432/default_db")).toMatchObject(expected);
  });

  it("reads a raw password with special characters (Timeweb decodes variables)", () => {
    expect(parseDatabaseUrl("postgresql://app_user:p@ss#w?rd/:%x@db.example.net:5432/default_db")).toMatchObject(expected);
  });

  it("reads query parameters, IP hosts, IPv6 and default port", () => {
    const parsed = parseDatabaseUrl("postgres://u:s?x@147.45.185.102:5432/db?sslmode=require");
    expect(parsed).toMatchObject({ user: "u", password: "s?x", host: "147.45.185.102", port: 5432, database: "db" });
    expect(parsed?.params.get("sslmode")).toBe("require");
    expect(parseDatabaseUrl("postgresql://u:p@[::1]/db")).toMatchObject({ host: "::1", port: undefined });
  });

  it("returns null for non-URL strings", () => {
    expect(parseDatabaseUrl("host=localhost user=x")).toBeNull();
  });
});

describe("buildPoolConfig", () => {
  const url = "postgresql://app_user:p%40ss@db.example.net:5432/default_db";
  const ca = "-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----";

  it("passes credentials as separate fields", () => {
    expect(buildPoolConfig({ DATABASE_URL: url })).toEqual({
      host: "db.example.net",
      port: 5432,
      database: "default_db",
      user: "app_user",
      password: "p@ss",
      ssl: false,
    });
  });

  it("maps sslmode like libpq", () => {
    expect(buildPoolConfig({ DATABASE_URL: `${url}?sslmode=require` }).ssl).toEqual({ rejectUnauthorized: false });
    expect(buildPoolConfig({ DATABASE_URL: `${url}?sslmode=verify-full` }).ssl).toEqual({ rejectUnauthorized: true, ca: undefined });
    expect(buildPoolConfig({ DATABASE_URL: url, DATABASE_SSL: "true" }).ssl).toEqual({ rejectUnauthorized: true, ca: undefined });
    expect(buildPoolConfig({ DATABASE_URL: `${url}?sslmode=disable` }).ssl).toBe(false);

    const verifyCa = buildPoolConfig({ DATABASE_URL: `${url}?sslmode=verify-ca`, DATABASE_CA_CERT: ca }).ssl as Record<string, unknown>;
    expect(verifyCa.rejectUnauthorized).toBe(true);
    expect(verifyCa.ca).toBe(`${ca}\n`);
    expect(typeof verifyCa.checkServerIdentity).toBe("function");

    const requireWithCa = buildPoolConfig({ DATABASE_URL: `${url}?sslmode=require`, DATABASE_CA_CERT: ca }).ssl as Record<string, unknown>;
    expect(requireWithCa.rejectUnauthorized).toBe(true);
  });

  it("describes the connection without the password", () => {
    const text = describeConnection(buildPoolConfig({ DATABASE_URL: url }));
    expect(text).toBe("app_user@db.example.net:5432/default_db");
    expect(text).not.toContain("p@ss");
  });
});

describe("normalizePem", () => {
  it("restores certificates pasted into a single-line field", () => {
    const expected = `-----BEGIN CERTIFICATE-----\n${"A".repeat(64)}\n${"B".repeat(10)}\n-----END CERTIFICATE-----\n`;
    const spaced = `-----BEGIN CERTIFICATE----- ${"A".repeat(64)} ${"B".repeat(10)} -----END CERTIFICATE-----`;
    expect(normalizePem(spaced)).toBe(expected);
    const escaped = `-----BEGIN CERTIFICATE-----\\n${"A".repeat(64)}\\n${"B".repeat(10)}\\n-----END CERTIFICATE-----`;
    expect(normalizePem(escaped)).toBe(expected);
    expect(normalizePem("not a certificate")).toBeUndefined();
    expect(normalizePem(`${spaced}\n${spaced}`)).toBe(expected + expected);
  });
});
