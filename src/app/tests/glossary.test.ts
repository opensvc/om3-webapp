import { describe, expect, test } from "vitest";
import en from "../../i18n/locales/en.json";
import fr from "../../i18n/locales/fr.json";
import { GLOSSARY_GROUPS, GLOSSARY_KEYS, isGlossaryKey, kindTerm, termMatches, termUrl } from "../glossary";
import { introPage } from "../page-intro";

type Catalog = { glossary: { groups: Record<string, string>; terms: Record<string, { term?: string; definition?: string }> }; pageIntro: { pages: Record<string, string> } };

describe("the glossary", () => {
  test("each term once, of one group", () => {
    expect(new Set(GLOSSARY_KEYS).size).toBe(GLOSSARY_KEYS.length);
  });

  test.each([
    ["en", en as unknown as Catalog],
    ["fr", fr as unknown as Catalog],
  ])("every term named and defined in %s, every group titled, no definition the catalog holds of no term", (_, catalog) => {
    for (const group of GLOSSARY_GROUPS) expect(catalog.glossary.groups[group.key], group.key).toBeTruthy();
    for (const key of GLOSSARY_KEYS) {
      expect(catalog.glossary.terms[key]?.term, key).toBeTruthy();
      expect(catalog.glossary.terms[key]?.definition, key).toBeTruthy();
    }
    expect(Object.keys(catalog.glossary.terms).filter((key) => !isGlossaryKey(key))).toEqual([]);
  });

  test("the term of a kind, none for one it does not define", () => {
    expect(kindTerm("svc")).toBe("kindSvc");
    expect(kindTerm("nscfg")).toBe("kindNscfg");
    expect(kindTerm("foo")).toBeUndefined();
  });

  test("a term matched by its name or definition, any case; everything by nothing", () => {
    expect(termMatches("FROZ", "Frozen", "…")).toBe(true);
    expect(termMatches("failover", "Topology", "failover or flex")).toBe(true);
    expect(termMatches("zzz", "Topology", "failover or flex")).toBe(false);
    expect(termMatches("  ", "x")).toBe(true);
    expect(termUrl("avail")).toBe("/glossary#term-avail");
  });
});

describe("the intro of a page", () => {
  test("by its path, the objects by their list, the services by default", () => {
    expect(introPage("/cluster", "")).toBe("cluster");
    expect(introPage("/heartbeats/", "")).toBe("heartbeats");
    expect(introPage("/network", "")).toBe("networks");
    expect(introPage("/objects", "")).toBe("objects-services");
    expect(introPage("/objects", "?list=secrets&peek=x")).toBe("objects-secrets");
    expect(introPage("/kinds", "")).toBe("objects-any");
    expect(introPage("/objects", "?list=bogus")).toBeNull();
    expect(introPage("/glossary", "")).toBeNull();
    expect(introPage("/whoami", "")).toBeNull();
  });

  test.each([
    ["en", en as unknown as Catalog],
    ["fr", fr as unknown as Catalog],
  ])("every page with an intro said in %s", (_, catalog) => {
    const pages = ["cluster", "heartbeats", "nodes", "namespaces", "networks", "pools", "stores", "resources"]
      .concat(["any", "services", "volumes", "configs", "secrets", "users"].map((l) => `objects-${l}`));
    for (const page of pages) expect(catalog.pageIntro.pages[page], page).toBeTruthy();
  });
});
