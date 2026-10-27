/*
 * An object configuration designed rather than written: its sections, each its
 * keys and values, DEFAULT and env first, then the resources, each of a driver
 * (`fs.flag`: the group fs, the type flag). Turned into the file om reads, the
 * type of a resource first in its section.
 */

/** A keyword as the daemon documents it (GET .../config/keywords). */
export interface DesignKeyword {
  section: string;
  option: string;
  types?: string[];
  text?: string;
  required?: boolean;
  default?: string;
  defaultText?: string;
  candidates?: string[];
  converter?: string;
  scopable?: boolean;
  deprecated?: string;
  replacedBy?: string;
  /** The grant setting it needs: "" when any user may (om3, when it tells). */
  grant?: string;
  /** The grant needed whatever the value, not for some values only. */
  grantAlways?: boolean;
  grantDoc?: string;
  /** Among the keywords of a minimal configuration of its driver. */
  minimal?: boolean;
}

export interface DesignEntry {
  key: string;
  value: string;
}

/** A section of the design: its name in the file, its driver for a resource. */
export interface DesignSection {
  name: string;
  /** "fs" of fs#1; none for DEFAULT and env. */
  group?: string;
  /** "flag" of fs.flag. */
  type?: string;
  entries: DesignEntry[];
}

/** The sections every design starts with: DEFAULT; and env, the free keys of a service or a volume, with `env`. */
export const designStart = (env = true): DesignSection[] => [
  { name: "DEFAULT", entries: [] },
  ...(env ? [{ name: "env", entries: [] }] : []),
];

/** The sections whose keys are free, no keyword of them. */
export const FREE_SECTIONS = ["env", "labels"];

/** The sections a design leaves as they are, neither shown nor written: the keys of a datastore. */
const KEPT_SECTIONS = ["data"];

/** The keys a design leaves as they are: the id of the object. */
const KEPT_KEYS = ["DEFAULT.id"];

/**
 * The design of a configuration file, on the sections of `start`: a section each,
 * a resource its driver (its group from its name, its type from its `type` key),
 * a value continued on the indented lines below its key; the comments, the kept
 * sections and keys left out.
 */
export function parseDesign(text: string, start: DesignSection[] = designStart()): DesignSection[] {
  const sections: DesignSection[] = start.map((section) => ({ ...section, entries: [...section.entries] }));
  const at = (name: string) => {
    let section = sections.find((x) => x.name === name);
    if (!section) {
      section = name === "DEFAULT" || FREE_SECTIONS.includes(name) ? { name, entries: [] } : { name, group: name.split("#")[0], type: "", entries: [] };
      sections.push(section);
    }
    return section;
  };
  let current: DesignSection | null = null;
  let kept = false;
  let last: DesignEntry | null = null;
  for (const line of text.replace(/\r/g, "").split("\n")) {
    const head = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (head) {
      const name = head[1].trim();
      kept = KEPT_SECTIONS.includes(name);
      current = kept ? null : at(name);
      last = null;
      continue;
    }
    if (/^\s*([#;]|$)/.test(line)) {
      last = null;
      continue;
    }
    if (/^\s/.test(line)) {
      if (last) last.value += `\n${line.trim()}`;
      continue;
    }
    const kv = line.match(/^([^=]+?)\s*=\s?(.*)$/);
    if (!kv || kept) continue;
    const section = current ?? at("DEFAULT");
    const key = kv[1].trim();
    last = null;
    if (key === "type" && section.group !== undefined && !NEEDS_GROUPS.includes(section.group)) {
      section.type = kv[2];
    } else if (!KEPT_KEYS.includes(`${section.name}.${key}`)) {
      last = { key, value: kv[2] };
      section.entries.push(last);
    }
  }
  return sections;
}

/** The changes a design makes to the one it started from, as om config update takes them. */
export interface DesignChanges {
  set: { keyword: string; value: string }[];
  unset: string[];
  delete: string[];
}

/**
 * What turns the configuration of `before` into that of `after`: the sections gone
 * deleted, the keys gone unset, the keys new or changed set, a section new its type
 * first; a key new without a value not written. A keyword of DEFAULT is its key alone.
 */
export function designChanges(before: DesignSection[], after: DesignSection[]): DesignChanges {
  const keyword = (section: string, key: string) => (section === "DEFAULT" ? key : `${section}.${key}`);
  const names = new Set(after.map((section) => section.name));
  const changes: DesignChanges = {
    set: [],
    unset: [],
    delete: before.filter((section) => !names.has(section.name)).map((section) => section.name),
  };
  for (const section of after) {
    const old = before.find((x) => x.name === section.name);
    const was = new Map((old?.entries ?? []).map((e) => [e.key.trim(), e.value]));
    if (section.type && section.type !== old?.type) changes.set.push({ keyword: keyword(section.name, "type"), value: section.type });
    const keys = new Set<string>();
    for (const entry of section.entries) {
      const key = entry.key.trim();
      if (key === "") continue;
      keys.add(key);
      const changed = was.has(key) ? was.get(key) !== entry.value : entry.value.trim() !== "";
      if (changed) changes.set.push({ keyword: keyword(section.name, key), value: entry.value });
    }
    for (const key of was.keys()) if (key !== "" && !keys.has(key)) changes.unset.push(keyword(section.name, key));
  }
  return changes;
}

/** A driver of a resource: its group and type, `fs.flag` its name. */
export interface DesignDriver {
  group: string;
  type: string;
  name: string;
}

/**
 * The driver groups each kind's objects take, as om3 keys their keywords: a volume no
 * app nor container, a user no resource; a namespace configuration its claims.
 */
const KIND_GROUPS: Record<string, string[]> = {
  svc: ["app", "container", "disk", "fs", "ip", "share", "sync", "task", "volume"],
  vol: ["disk", "fs", "ip", "share", "sync", "task", "volume"],
  nscfg: ["claim"],
};

/** The claims of a namespace configuration, of no node's drivers: a claim of a pool, of a network. */
const CLAIM_DRIVERS: DesignDriver[] = ["network", "pool"].map((type) => ({ group: "claim", type, name: `claim.${type}` }));

/**
 * The drivers an object of `kind` may take, from the capabilities of a node
 * (`drivers.resource.<group>.<type>`, a feature of a driver a fifth word, left out):
 * those of the groups of its kind, in the order of their names.
 */
export function kindDrivers(kind: string, capabilities: string[]): DesignDriver[] {
  const groups = KIND_GROUPS[kind] ?? [];
  if (groups.includes("claim")) return CLAIM_DRIVERS;
  return capabilities
    .map((name) => name.split("."))
    .filter((words) => words[0] === "drivers" && words[1] === "resource" && groups.includes(words[2]))
    // A group of needs is a driver alone, its types those of the pools; any other a driver a type.
    .filter((words) => words.length === (NEEDS_GROUPS.includes(words[2]) ? 3 : 4))
    .map(([, , group, type = ""]) => ({ group, type, name: type ? `${group}.${type}` : group }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Whether an object of `kind` takes resources: a user none. */
export const takesResources = (kind: string) => (KIND_GROUPS[kind] ?? []).length > 0;

/**
 * The groups whose resources choose no type: a volume says what it needs (its size,
 * shared, access, a type of pool even, as a keyword like any) and the pool lookup
 * picks one matching. Its `type` a need, not its driver.
 */
export const NEEDS_GROUPS = ["volume"];

/** The keywords a resource of a group must set, om requiring them or not: the size of a volume. */
const NEEDED: Record<string, string[]> = { volume: ["size"] };

/**
 * The types of pool a volume may ask for, from the capabilities of a node
 * (`drivers.resource.volume.<type>`).
 */
export function poolTypes(capabilities: string[]): string[] {
  return capabilities
    .map((name) => name.split("."))
    .filter((words) => words.length === 4 && words[0] === "drivers" && words[1] === "resource" && NEEDS_GROUPS.includes(words[2]))
    .map((words) => words[3])
    .sort();
}

/** A driver as written: "fs.flag", its group and type; the group alone without a dot. */
export function parseDriver(driver: string): { group: string; type: string } {
  const [group, ...rest] = driver.trim().split(".");
  return { group: group ?? "", type: rest.join(".") };
}

/**
 * The name of a new section of a group: the group and the lowest index none of the
 * sections takes, from 1 (fs#1, then fs#2…).
 */
export function nextSectionName(sections: DesignSection[], group: string): string {
  const taken = new Set(sections.map((s) => s.name));
  let i = 1;
  while (taken.has(`${group}#${i}`)) i += 1;
  return `${group}#${i}`;
}

/** The keywords of a section of a driver: those of its group, of every type or of its own. */
export function sectionKeywords(keywords: DesignKeyword[], section: DesignSection): DesignKeyword[] {
  const group = section.group ?? section.name;
  return keywords.filter(
    (k) =>
      (k.section === group || (group === "DEFAULT" && k.section === "")) &&
      (!section.type || !k.types || k.types.length === 0 || k.types.includes(section.type)),
  );
}

/** The keywords a section must set, the type of a resource aside (the design writes it). */
export function requiredKeywords(keywords: DesignKeyword[], section: DesignSection): DesignKeyword[] {
  const needed = NEEDED[section.group ?? ""] ?? [];
  return sectionKeywords(keywords, section).filter((k) => (k.required || needed.includes(k.option)) && k.option !== "type");
}

/**
 * The keywords of a section offered, those its entries do not set yet, in the order
 * of their names: with `hideRoot`, not those needing the root grant whatever the
 * value, those needing it for some values only offered (an image named `-x`).
 */
export function offeredKeywords(keywords: DesignKeyword[], section: DesignSection, hideRoot = false): DesignKeyword[] {
  const set = new Set(section.entries.map((e) => e.key));
  return sectionKeywords(keywords, section)
    .filter((k) => (k.option !== "type" || NEEDS_GROUPS.includes(section.group ?? "")) && !set.has(k.option) && !k.deprecated)
    .filter((k) => !hideRoot || !(k.grant === "root" && k.grantAlways !== false))
    .sort((a, b) => a.option.localeCompare(b.option));
}

/** A section with its required keywords, each with an empty value, after the entries it has. */
export function withRequired(keywords: DesignKeyword[], section: DesignSection): DesignSection {
  const set = new Set(section.entries.map((e) => e.key));
  const missing = requiredKeywords(keywords, section).filter((k) => !set.has(k.option));
  return { ...section, entries: [...section.entries, ...missing.map((k) => ({ key: k.option, value: "" }))] };
}

/**
 * The file of a design, as om reads it: a section each, the type of a resource first,
 * then its entries with a key; an empty DEFAULT or env left out, an entry with no key too.
 */
export function designText(sections: DesignSection[]): string {
  const blocks: string[] = [];
  for (const section of sections) {
    const entries = section.entries.filter((e) => e.key.trim() !== "");
    const lines = [...(section.type ? [`type = ${section.type}`] : []), ...entries.map((e) => `${e.key.trim()} = ${e.value}`)];
    if (lines.length === 0 && !section.group) continue;
    blocks.push([`[${section.name}]`, ...lines].join("\n"));
  }
  return blocks.length === 0 ? "" : `${blocks.join("\n\n")}\n`;
}

/**
 * The keywords most set, by driver group, in the order they are offered: those om
 * calls minimal follow, then those every resource takes.
 */
const POPULAR: Record<string, string[]> = {
  DEFAULT: ["nodes", "orchestrate", "topology", "placement", "parents", "children"],
  app: ["start", "stop", "check", "info", "environment", "user"],
  container: ["image", "command", "rm", "environment", "volume_mounts", "netns", "hostname"],
  disk: ["size", "file", "name", "pool", "vg"],
  fs: ["mnt", "dev", "size", "mnt_opt", "user", "perm"],
  ip: ["name", "network", "netns", "netmask", "dev", "expose"],
  share: ["path", "opts"],
  sync: ["target", "src", "dst", "schedule"],
  task: ["command", "schedule", "user", "confirmation"],
  volume: ["size", "install", "name", "pool", "format", "shared"],
  claim: ["pool", "network", "size", "limit"],
};
const POPULAR_RESOURCE = ["tags", "subset", "standby", "optional", "monitor"];

/**
 * The keywords of a section offered at once, at most `max`: those most set of its
 * group, those om calls minimal, then those every resource takes; of the keywords
 * offered (`offeredKeywords`) alone.
 */
export function popularKeywords(keywords: DesignKeyword[], section: DesignSection, hideRoot = false, max = 6): DesignKeyword[] {
  const offered = offeredKeywords(keywords, section, hideRoot);
  const names = [
    ...(POPULAR[section.group ?? section.name] ?? []),
    ...offered.filter((k) => k.minimal).map((k) => k.option),
    ...(section.group ? POPULAR_RESOURCE : []),
  ];
  const picked: DesignKeyword[] = [];
  for (const name of names) {
    const keyword = offered.find((k) => k.option === name);
    if (keyword && !picked.includes(keyword)) picked.push(keyword);
  }
  return picked.slice(0, max);
}

/** The required entries of the sections left without a value: none, the design is complete. */
export function missingValues(sections: DesignSection[], keywords: DesignKeyword[]): { section: string; key: string }[] {
  return sections.flatMap((section) => {
    const required = new Set(requiredKeywords(keywords, section).map((k) => k.option));
    return section.entries.filter((e) => required.has(e.key) && e.value.trim() === "").map((e) => ({ section: section.name, key: e.key }));
  });
}
