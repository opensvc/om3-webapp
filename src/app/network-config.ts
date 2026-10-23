/*
 * A network of the cluster, a `[network#<name>]` section of the cluster configuration
 * (`section-config.ts`): what a network asks beyond its keywords, and what its range
 * is checked against.
 */
import {
  type Keyword,
  type SectionField,
  type SectionRules,
  type SectionValues,
  SECTION_NAME,
  bodyOps as sectionBodyOps,
  editOps,
  editPreview,
  sectionFields,
  sectionKeywords,
  sectionOps,
  sectionPreview,
  sectionTypes,
  typeDescriptions as sectionTypeDescriptions,
} from "./section-config";

export { type Keyword, firstParagraph, missingFields, parseBody, sectionBody } from "./section-config";
export type NetworkField = SectionField;
export type NetworkValues = SectionValues;

/**
 * What a network asks beyond its keywords: a routed bridge routes a subnet of its
 * network on each node, through a gateway and a tunnel endpoint of the node; a network
 * of no range hands out no address.
 */
export const NETWORK_RULES: SectionRules = {
  perNode: { routed_bridge: ["subnet", "gateway", "addr"] },
  order: ["network", "ranges", "dev", "subnet", "gateway", "addr", "modes"],
  required: ["network"],
};

export const NETWORK_NAME = SECTION_NAME;

export const networkKeywords = (keywords: Keyword[]) => sectionKeywords(keywords, "network");
export const networkTypes = (keywords: Keyword[]) => sectionTypes(keywords, "network");
export const typeDescriptions = (keywords: Keyword[]) => sectionTypeDescriptions(keywords, "network");
export const networkFields = (keywords: Keyword[], type: string) => sectionFields(keywords, "network", type, NETWORK_RULES);
export const networkOps = (name: string, type: string, values: NetworkValues) => sectionOps("network", name, type, values);
export const networkPreview = (name: string, type: string, values: NetworkValues) => sectionPreview("network", name, type, values);
export const bodyOps = (name: string, before: string, after: string) => sectionBodyOps("network", name, before, after);
export const networkEditOps = (name: string, type: string, original: NetworkValues, values: NetworkValues, fields: string[]) =>
  editOps("network", name, type, original, values, fields);
export const networkEditPreview = (name: string, type: string, original: NetworkValues, values: NetworkValues, fields: string[]) =>
  editPreview("network", name, type, original, values, fields);

/** An address range, `addr/len`, v4 or v6; not checked further than its shape. */
const CIDR = /^(\d{1,3}(\.\d{1,3}){3}|[0-9a-fA-F:]*:[0-9a-fA-F:.]*)\/\d{1,3}$/;
export const isCidr = (text: string) => CIDR.test(text.trim());

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
