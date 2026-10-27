import { describe, expect, test } from "vitest";
import {
  designStart,
  designChanges,
  designText,
  parseDesign,
  poolTypes,
  kindDrivers,
  takesResources,
  missingValues,
  nextSectionName,
  offeredKeywords,
  popularKeywords,
  parseDriver,
  requiredKeywords,
  withRequired,
  type DesignKeyword,
  type DesignSection,
} from "../object-design";

const KEYWORDS: DesignKeyword[] = [
  { section: "DEFAULT", option: "nodes", text: "The nodes." },
  { section: "DEFAULT", option: "orchestrate", candidates: ["no", "ha", "start"] },
  { section: "", option: "comment" },
  { section: "fs", option: "type", required: true },
  { section: "fs", option: "mnt", types: ["ext4"], required: true },
  { section: "fs", option: "dev", types: ["ext4"], required: true },
  { section: "fs", option: "mnt_opt", types: ["ext4"] },
  { section: "fs", option: "size", types: [] },
  { section: "fs", option: "zone", types: ["zfs"], required: true },
  { section: "fs", option: "old", deprecated: "3.0" },
  { section: "container", option: "privileged", grant: "root", grantAlways: true },
  { section: "container", option: "image", grant: "root", grantAlways: false },
];

const fs = (entries: DesignSection["entries"] = []): DesignSection => ({ name: "fs#1", group: "fs", type: "ext4", entries });

describe("object design", () => {
  test("starts with DEFAULT and env; a driver its group and type", () => {
    expect(designStart().map((s) => s.name)).toEqual(["DEFAULT", "env"]);
    expect(parseDriver("fs.flag")).toEqual({ group: "fs", type: "flag" });
    expect(parseDriver(" app ")).toEqual({ group: "app", type: "" });
  });

  test("a new section of a group, the lowest index free from 1", () => {
    const sections = [...designStart(), fs(), { name: "fs#3", group: "fs", type: "ext4", entries: [] }];
    expect(nextSectionName(sections, "fs")).toBe("fs#2");
    expect(nextSectionName(sections, "app")).toBe("app#1");
  });

  test("the keywords a section must set, of its type, the type aside; seeded with an empty value", () => {
    expect(requiredKeywords(KEYWORDS, fs()).map((k) => k.option)).toEqual(["mnt", "dev"]);
    expect(withRequired(KEYWORDS, fs([{ key: "mnt", value: "/srv" }])).entries).toEqual([
      { key: "mnt", value: "/srv" },
      { key: "dev", value: "" },
    ]);
  });

  test("the keywords offered: of its section and type, not set yet, not deprecated, by name; DEFAULT's those of no section too", () => {
    expect(offeredKeywords(KEYWORDS, fs([{ key: "mnt", value: "/srv" }])).map((k) => k.option)).toEqual(["dev", "mnt_opt", "size"]);
    expect(offeredKeywords(KEYWORDS, designStart()[0]).map((k) => k.option)).toEqual(["comment", "nodes", "orchestrate"]);
  });

  test("root-only hidden: those needing root whatever the value, not those needing it for some", () => {
    const container: DesignSection = { name: "container#1", group: "container", type: "docker", entries: [] };
    expect(offeredKeywords(KEYWORDS, container).map((k) => k.option)).toEqual(["image", "privileged"]);
    expect(offeredKeywords(KEYWORDS, container, true).map((k) => k.option)).toEqual(["image"]);
  });

  test("the file: a section each, the type first, an empty DEFAULT or env left out, an entry with no key too", () => {
    const sections = [
      { name: "DEFAULT", entries: [{ key: "nodes", value: "*" }] },
      { name: "env", entries: [{ key: "", value: "x" }] },
      fs([{ key: "mnt", value: "/srv" }, { key: "dev", value: "/dev/sdb" }]),
    ];
    expect(designText(sections)).toBe("[DEFAULT]\nnodes = *\n\n[fs#1]\ntype = ext4\nmnt = /srv\ndev = /dev/sdb\n");
    expect(designText(designStart())).toBe("");
  });

  test("the drivers of a kind, from the capabilities of a node: its groups, a feature of a driver left out", () => {
    const capabilities = [
      "drivers.resource.app.forking",
      "drivers.resource.container.docker",
      "drivers.resource.container.docker.signal",
      "drivers.resource.fs.flag",
      "drivers.array.hds",
      "node.x.systemd",
    ];
    expect(kindDrivers("svc", capabilities).map((d) => d.name)).toEqual(["app.forking", "container.docker", "fs.flag"]);
    expect(kindDrivers("vol", capabilities).map((d) => d.name)).toEqual(["fs.flag"]);
    expect(kindDrivers("nscfg", capabilities).map((d) => d.name)).toEqual(["claim.network", "claim.pool"]);
    expect(kindDrivers("usr", capabilities)).toEqual([]);
    expect([takesResources("svc"), takesResources("usr")]).toEqual([true, false]);
  });

  test("a file read as a design: the type of a resource its driver, a value continued, comments, the id and the data left out", () => {
    const text = [
      "[DEFAULT]",
      "id = 1234",
      "nodes = n1 n2",
      "# a comment",
      "[fs#1]",
      "type = flag",
      "[app#1]",
      "start = a",
      "  b",
      "[env]",
      "ip@n1 = 10.0.0.1",
      "[data]",
      "key = secret",
    ].join("\n");
    expect(parseDesign(text)).toEqual([
      { name: "DEFAULT", entries: [{ key: "nodes", value: "n1 n2" }] },
      { name: "env", entries: [{ key: "ip@n1", value: "10.0.0.1" }] },
      { name: "fs#1", group: "fs", type: "flag", entries: [] },
      { name: "app#1", group: "app", type: "", entries: [{ key: "start", value: "a\nb" }] },
    ]);
    expect(parseDesign("", designStart(false))).toEqual([{ name: "DEFAULT", entries: [] }]);
  });

  test("the changes of a design: sections gone deleted, keys gone unset, new or changed set, a new section its type first", () => {
    const before = parseDesign("[DEFAULT]\nnodes = n1\norchestrate = ha\n[fs#1]\ntype = flag\n[env]\na = 1\n");
    const after: DesignSection[] = [
      { name: "DEFAULT", entries: [{ key: "nodes", value: "n1 n2" }, { key: "comment", value: "" }] },
      { name: "env", entries: [{ key: "a", value: "1" }, { key: "b", value: "2" }] },
      { name: "app#1", group: "app", type: "forking", entries: [{ key: "start", value: "x" }] },
    ];
    expect(designChanges(before, after)).toEqual({
      set: [
        { keyword: "nodes", value: "n1 n2" },
        { keyword: "env.b", value: "2" },
        { keyword: "app#1.type", value: "forking" },
        { keyword: "app#1.start", value: "x" },
      ],
      unset: ["orchestrate"],
      delete: ["fs#1"],
    });
    expect(designChanges(before, before)).toEqual({ set: [], unset: [], delete: [] });
  });

  test("the popular keywords: of its group first, then minimal, then those of any resource; offered ones alone, at most a few", () => {
    const keywords: DesignKeyword[] = [
      { section: "fs", option: "mnt" },
      { section: "fs", option: "size" },
      { section: "fs", option: "zone", minimal: true },
      { section: "fs", option: "tags" },
      { section: "fs", option: "rare" },
    ];
    const section: DesignSection = { name: "fs#1", group: "fs", type: "zfs", entries: [{ key: "mnt", value: "/srv" }] };
    expect(popularKeywords(keywords, section).map((k) => k.option)).toEqual(["size", "zone", "tags"]);
    expect(popularKeywords(keywords, section, false, 1).map((k) => k.option)).toEqual(["size"]);
    expect(popularKeywords(KEYWORDS, designStart()[0]).map((k) => k.option)).toEqual(["nodes", "orchestrate"]);
  });

  test("a volume: a driver alone, its type a need offered like any keyword, its size required", () => {
    const capabilities = ["drivers.resource.volume", "drivers.resource.volume.shm", "drivers.resource.volume.loop", "drivers.resource.fs.flag"];
    expect(kindDrivers("vol", capabilities).map((d) => [d.name, d.type])).toEqual([["fs.flag", "flag"], ["volume", ""]]);
    expect(poolTypes(capabilities)).toEqual(["loop", "shm"]);
    const keywords: DesignKeyword[] = [
      { section: "volume", option: "type", types: [""] },
      { section: "volume", option: "size", types: [""] },
      { section: "volume", option: "shared", types: [""] },
    ];
    const volume: DesignSection = { name: "volume#1", group: "volume", type: "", entries: [] };
    expect(requiredKeywords(keywords, volume).map((k) => k.option)).toEqual(["size"]);
    expect(offeredKeywords(keywords, volume).map((k) => k.option)).toEqual(["shared", "size", "type"]);
    const read = parseDesign("[volume#1]\ntype = shm\nsize = 1g\n");
    expect(read.find((x) => x.name === "volume#1")).toEqual({ name: "volume#1", group: "volume", type: "", entries: [{ key: "type", value: "shm" }, { key: "size", value: "1g" }] });
    expect(designText(read)).toBe("[volume#1]\ntype = shm\nsize = 1g\n");
  });

  test("the required entries left without a value", () => {
    expect(missingValues([withRequired(KEYWORDS, fs([{ key: "mnt", value: "/srv" }]))], KEYWORDS)).toEqual([{ section: "fs#1", key: "dev" }]);
  });
});
