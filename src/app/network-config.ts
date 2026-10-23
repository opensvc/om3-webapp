/*
 * A network of the cluster, a `[network#<name>]` section of the cluster configuration,
 * as the network wizard writes it: its types and fields, read from the keywords the
 * daemon declares (GET /api/cluster/config/keywords), the operations writing it (PATCH
 * /api/cluster/config), the section they write.
 */

/** A keyword as the daemon describes it; the fields the wizard reads. */
export interface Keyword {
  section?: string;
  option: string;
  types?: string[] | null;
  text?: string;
  default?: string;
  defaultText?: string;
  example?: string;
  candidates?: string[] | null;
  converter?: string;
  required?: boolean;
  scopable?: boolean;
}

/**
 * A field of the wizard, a keyword of the section. `perNode`, one a node, scoped
 * (`subnet@n1`): a value the same on every node would not do. `kind`, its control.
 */
export interface NetworkField {
  key: string;
  keyword: Keyword;
  kind: "text" | "number" | "bool" | "choice" | "choices" | "list";
  perNode: boolean;
  required: boolean;
}

/** The keys of the section, `key` or `key@node`, and their values; empty when not set. */
export type NetworkValues = Record<string, string>;

/**
 * The keywords of a type taken on each node apart: a routed bridge routes a subnet of
 * its network on each node, through a gateway and a tunnel endpoint of the node.
 */
const PER_NODE: Record<string, string[]> = {
  routed_bridge: ["subnet", "gateway", "addr"],
};

/** The keywords asked first, in this order; the others after them, by name. */
const ORDER = ["network", "ranges", "dev", "subnet", "gateway", "addr", "modes"];

/** A network name: a section `network#<name>`, its keys `network#<name>.<key>`, so no dot. */
export const NETWORK_NAME = /^[A-Za-z0-9_-]+$/;

/** The keywords of the network section. */
export function networkKeywords(keywords: Keyword[]): Keyword[] {
  return keywords.filter((k) => k.section === "network");
}

/** The types of a network, as its `type` keyword lists them; its default first. */
export function networkTypes(keywords: Keyword[]): { types: string[]; default?: string } {
  const type = networkKeywords(keywords).find((k) => k.option === "type");
  return { types: type?.candidates ?? [], default: type?.default || undefined };
}

/**
 * What each type is, as the `type` keyword says it in its list, a type an item:
 * "* `lan`: ranges of a segment…", its continuation lines indented.
 */
export function typeDescriptions(keywords: Keyword[]): Record<string, string> {
  const text = networkKeywords(keywords).find((k) => k.option === "type")?.text ?? "";
  const out: Record<string, string> = {};
  let current: string | null = null;
  for (const line of text.split("\n")) {
    const item = /^\*\s+`([^`]+)`:\s*(.*)$/.exec(line);
    if (item) {
      current = item[1];
      out[current] = item[2].trim();
    } else if (current && /^\s+\S/.test(line)) {
      out[current] += ` ${line.trim()}`;
    } else {
      current = null;
    }
  }
  return out;
}

/** The first paragraph of a help text: a hint under a field, the rest in the keyword reference. */
export const firstParagraph = (text?: string) => (text ?? "").split(/\n\s*\n/)[0].replace(/\s*\n\s*/g, " ").trim();

const kindOf = (k: Keyword): NetworkField["kind"] => {
  const list = k.converter === "list" || k.converter === "converters.List";
  if (k.candidates && k.candidates.length > 0) return list ? "choices" : "choice";
  if (k.converter === "bool" || k.converter === "converters.Bool") return "bool";
  if (k.converter === "int" || k.converter === "converters.Int") return "number";
  return list ? "list" : "text";
};

/**
 * The fields of a type: the keywords of the section it has (`types` naming it, or
 * none, those of every type), the type itself left out, asked by the first step. The
 * network required: a network of no address hands none out.
 */
export function networkFields(keywords: Keyword[], type: string): NetworkField[] {
  const rank = (key: string) => (ORDER.includes(key) ? ORDER.indexOf(key) : ORDER.length);
  return networkKeywords(keywords)
    .filter((k) => k.option !== "type" && (!k.types || k.types.length === 0 || k.types.includes(type)))
    .map((k) => ({
      key: k.option,
      keyword: k,
      kind: kindOf(k),
      perNode: (PER_NODE[type] ?? []).includes(k.option),
      required: Boolean(k.required) || k.option === "network",
    }))
    .sort((a, b) => rank(a.key) - rank(b.key) || a.key.localeCompare(b.key));
}

/** An address range, `addr/len`, v4 or v6; not checked further than its shape. */
const CIDR = /^(\d{1,3}(\.\d{1,3}){3}|[0-9a-fA-F:]*:[0-9a-fA-F:.]*)\/\d{1,3}$/;
export const isCidr = (text: string) => CIDR.test(text.trim());

/** The fields required and left empty: a per-node one, on any of the nodes. */
export function missingFields(fields: NetworkField[], values: NetworkValues, nodes: string[]): string[] {
  const empty = (key: string) => !(values[key] ?? "").trim();
  return fields
    .filter((f) => f.required && (f.perNode ? nodes.some((n) => empty(`${f.key}@${n}`)) : empty(f.key)))
    .map((f) => f.key);
}

/** An IPv4 range, as its first address and its size; null for another one. */
function v4Range(cidr: string): { start: number; size: number } | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.exec(cidr.trim());
  if (!match) return null;
  const len = Number(match[5]);
  if (len > 32 || match.slice(1, 5).some((o) => Number(o) > 255)) return null;
  const addr = match.slice(1, 5).reduce((acc, o) => acc * 256 + Number(o), 0);
  const size = 2 ** (32 - len);
  return { start: Math.floor(addr / size) * size, size };
}

/** The networks whose IPv4 range overlaps `cidr`: a second network handing out the same addresses. */
export function overlapping(cidr: string, networks: { name: string; network?: string }[]): string[] {
  const one = v4Range(cidr);
  if (!one) return [];
  return networks
    .filter((n) => {
      const other = n.network ? v4Range(n.network) : null;
      return other !== null && one.start < other.start + other.size && other.start < one.start + one.size;
    })
    .map((n) => n.name);
}

/** The keys set, the type first, then by name, a key before its scoped values. */
function entries(type: string, values: NetworkValues): [string, string][] {
  return [
    ["type", type] as [string, string],
    ...Object.entries(values)
      .filter(([key, value]) => key !== "type" && value.trim() !== "")
      .map(([key, value]) => [key, value.trim()] as [string, string])
      .sort(([a], [b]) => a.localeCompare(b)),
  ];
}

/** The operations writing a new network: its keys set, the type first, the driver read before them. */
export function networkOps(name: string, type: string, values: NetworkValues): string[] {
  return entries(type, values).map(([key, value]) => `network#${name}.${key}=${value}`);
}

/** The section as it will read once written. */
export function networkPreview(name: string, type: string, values: NetworkValues): string {
  return [`[network#${name}]`, ...entries(type, values).map(([key, value]) => `${key} = ${value}`)].join("\n");
}

/** A line of a section: `key = value`, the key scoped to a node or not (`subnet@n1`). */
const BODY_LINE = /^\s*([A-Za-z0-9_]+(?:@[A-Za-z0-9_.-]+)?)\s*=\s*(.*?)\s*$/;
const IGNORED_LINE = /^\s*([#;].*)?$/;

/** The body of a section as written: its lines but its header. */
export function sectionBody(section: string | null): string {
  return (section ?? "")
    .split("\n")
    .filter((line) => !/^\s*\[[^\]]+\]\s*$/.test(line))
    .join("\n")
    .trim();
}

/** The keys of a body and their values; the lines that are none, blank and comments aside. */
export function parseBody(body: string): { values: NetworkValues; invalid: string[] } {
  const values: NetworkValues = {};
  const invalid: string[] = [];
  for (const line of body.split("\n")) {
    const match = BODY_LINE.exec(line);
    if (match) values[match[1]] = match[2];
    else if (!IGNORED_LINE.test(line)) invalid.push(line.trim());
  }
  return { values, invalid };
}

/**
 * The operations an edit of the section of a network makes (PATCH /api/cluster/config):
 * the keys changed or added set, the type first, those gone unset; the others, and
 * the comments of the file, left alone.
 */
export function bodyOps(name: string, before: string, after: string): { set: string[]; unset: string[]; invalid: string[] } {
  const old = parseBody(before).values;
  const { values, invalid } = parseBody(after);
  const set = Object.entries(values)
    .filter(([key, value]) => old[key] !== value)
    .sort(([a], [b]) => Number(a !== "type") - Number(b !== "type") || a.localeCompare(b))
    .map(([key, value]) => `network#${name}.${key}=${value}`);
  const unset = Object.keys(old)
    .filter((key) => !(key in values))
    .sort()
    .map((key) => `network#${name}.${key}`);
  return { set, unset, invalid };
}

/**
 * The operations a modification of a network by the wizard makes: from the keys it had
 * (`original`) to those the wizard gives (`values`), on the fields of its type
 * (`fields`). The same type: the fields changed set, those emptied unset, the other
 * keys of the section left alone. Another type, the keys of the former meaning nothing
 * to it: the section deleted first (`rewrite`), then the keys of the new one set.
 */
export function networkEditOps(
  name: string,
  type: string,
  original: NetworkValues,
  values: NetworkValues,
  fields: string[],
): { rewrite: boolean; set: string[]; unset: string[] } {
  const isField = (key: string) => fields.includes(key.split("@")[0]);
  const own = Object.fromEntries(Object.entries(values).filter(([key]) => isField(key)));
  const rewrite = Boolean(original.type) && original.type !== type;
  if (rewrite) return { rewrite, set: networkOps(name, type, own), unset: [] };
  const set: string[] = [];
  const unset: string[] = [];
  if (!original.type) set.push(`network#${name}.type=${type}`);
  for (const [key, raw] of Object.entries(own).sort(([a], [b]) => a.localeCompare(b))) {
    const value = raw.trim();
    if (value === "") {
      if (key in original) unset.push(`network#${name}.${key}`);
    } else if (original[key] !== value) {
      set.push(`network#${name}.${key}=${value}`);
    }
  }
  return { rewrite, set, unset };
}

/** The section of a network as it will read once modified. */
export function networkEditPreview(name: string, type: string, original: NetworkValues, values: NetworkValues, fields: string[]): string {
  const { rewrite } = networkEditOps(name, type, original, values, fields);
  const isField = (key: string) => fields.includes(key.split("@")[0]);
  const result: NetworkValues = rewrite ? {} : { ...original };
  delete result.type;
  for (const [key, raw] of Object.entries(values)) {
    if (!isField(key)) continue;
    if (raw.trim() === "") delete result[key];
    else result[key] = raw.trim();
  }
  return networkPreview(name, type, result);
}
