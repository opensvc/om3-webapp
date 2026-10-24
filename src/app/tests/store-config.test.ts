import { describe, expect, test } from "vitest";
import { STORE_RULES, storeSource } from "../store-config";
import { type Keyword, sectionFields, sectionTypes } from "../section-config";
// The store keywords as the daemon declares them (GET /api/cluster/config/keywords).
import KEYWORDS from "./store-keywords.fixture.json";

describe("store config", () => {
  test("where a store is declared, from its reference", () => {
    expect(storeSource("tar1")).toEqual({ kind: "cluster", name: "tar1" });
    expect(storeSource("from test/sec/stores store#tar2")).toEqual({ kind: "sec", sec: "test/sec/stores", name: "tar2" });
  });

  test("the type of a store, tar the one there is; where it is required and asked first", () => {
    const keywords = KEYWORDS as Keyword[];
    expect(sectionTypes(keywords, "store").types).toEqual(["tar"]);
    const fields = sectionFields(keywords, "store", "tar", STORE_RULES);
    expect(fields.map((f) => [f.key, f.required])).toEqual([
      ["url", true],
      ["shared", false],
      ["host_key", false],
      ["ssh_private_key", false],
      ["keep", false],
      ["schedule", false],
    ]);
    expect(fields.find((f) => f.key === "shared")?.kind).toBe("bool");
  });
});
