import { describe, expect, it } from "vitest";
import { buildWhere, filtersToSearch, parseFilters, searchDigits } from "@/lib/requests/filters";

describe("parseFilters", () => {
  it("accepts known values only", () => {
    expect(parseFilters({ q: "  Иван ", status: "done", sort: "old", page: "3" })).toEqual({
      q: "Иван",
      status: "done",
      sort: "old",
      page: 3,
    });
    expect(parseFilters({ status: "drop table", sort: "x", page: "-5" })).toEqual({
      q: "",
      status: null,
      sort: "new",
      page: 1,
    });
  });

  it("limits search length", () => {
    expect(parseFilters({ q: "a".repeat(500) }).q).toHaveLength(100);
  });
});

describe("buildWhere", () => {
  it("passes user input only as parameters", () => {
    const where = buildWhere({ q: "100%_'; DROP", status: "new" });
    expect(where.sql).not.toContain("DROP");
    expect(where.params).toEqual(["new", "%100\\%\\_'; DROP%", "%100%"]);
  });

  it("adds phone digit search for numbers", () => {
    const where = buildWhere({ q: "8 (999) 123-45-67", status: null });
    expect(where.params).toContain("%9991234567%");
  });

  it("returns empty condition without filters", () => {
    expect(buildWhere({ q: "", status: null })).toEqual({ sql: "", params: [] });
  });
});

describe("helpers", () => {
  it("normalises Russian phone numbers", () => {
    expect(searchDigits("+7 999 123-45-67")).toBe("9991234567");
    expect(searchDigits("8 999 123 45 67")).toBe("9991234567");
    expect(searchDigits("123")).toBe("123");
  });

  it("builds query strings without defaults", () => {
    expect(filtersToSearch({ q: "", status: null, sort: "new", page: 1 })).toBe("");
    expect(filtersToSearch({ q: "a b", status: "done", sort: "old", page: 2 })).toBe("?q=a+b&status=done&sort=old&page=2");
  });
});
