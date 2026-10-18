import { describe, expect, it } from "vitest";
import { adminPasswordStatus, verifyAdminPassword } from "@/lib/admin/password";

describe("admin password", () => {
  it("refuses login when the variable is missing or empty", () => {
    expect(adminPasswordStatus(undefined)).toBe("missing");
    expect(adminPasswordStatus("")).toBe("missing");
    expect(adminPasswordStatus("    ")).toBe("missing");
    expect(verifyAdminPassword("", "")).toBe(false);
    expect(verifyAdminPassword("anything", undefined)).toBe(false);
  });

  it("refuses short passwords", () => {
    expect(adminPasswordStatus("short")).toBe("too_short");
    expect(verifyAdminPassword("short", "short")).toBe(false);
  });

  it("accepts only the exact password", () => {
    const secret = "correct-horse-battery";
    expect(adminPasswordStatus(secret)).toBe("ok");
    expect(verifyAdminPassword(secret, secret)).toBe(true);
    expect(verifyAdminPassword("correct-horse-batter", secret)).toBe(false);
    expect(verifyAdminPassword(`${secret} `, secret)).toBe(false);
    expect(verifyAdminPassword("", secret)).toBe(false);
  });
});
