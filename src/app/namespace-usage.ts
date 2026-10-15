/*
 * What a namespace holds of the cluster, as the om3 claims count it:
 *
 * - of a pool, the size each of its volumes was created with (`/api/pool/volume`);
 * - of a network, the addresses its objects hold (`/api/network/ip`), each counted
 *   once whatever the number of nodes it is configured on;
 *
 * against the limit its namespace configuration claims of each (`[claim#N]` of
 * `<namespace>/nscfg/namespace`). A namespace claiming nothing of a pool or a
 * network is capped by nothing but the pool or the network itself: its size is
 * the total then.
 */

/** A `[claim#N]` section of a namespace configuration. */
export interface Claim {
  type: "pool" | "network" | "cpu" | "memory";
  /** The pool or network claimed of; none for cpu and memory. */
  name?: string;
  /** Bytes for a pool and memory, addresses for a network, cpus for cpu. */
  limit?: number;
}

const SIZE = /^(\d+(?:[.,]\d+)*) ?([kmgtpe])?(i)?(b)?$/i;
const BINARY: Record<string, number> = { k: 2 ** 10, m: 2 ** 20, g: 2 ** 30, t: 2 ** 40, p: 2 ** 50, e: 2 ** 60 };
const DECIMAL: Record<string, number> = { k: 1e3, m: 1e6, g: 1e9, t: 1e12, p: 1e15, e: 1e18 };

/**
 * A size as om3 reads it (util/sizeconv FromSize): "512m" and "512mi" are MiB,
 * "512mb" is MB, a bare number is bytes. Undefined when it is no size.
 */
export function parseSize(text: string | undefined): number | undefined {
  const match = SIZE.exec((text ?? "").trim());
  if (!match) return undefined;
  const [, number, prefix, iec, bytes] = match;
  if (bytes !== undefined && iec === undefined && !prefix) return Number(number.replace(",", "."));
  const map = iec !== undefined || bytes === undefined ? BINARY : DECIMAL;
  return Number(number.replace(",", ".")) * (prefix ? map[prefix.toLowerCase()] : 1);
}

/**
 * A cpu limit in the pg_cpu_quota notation, as cpus: "800%" and "100%@8" are 8,
 * "50%" is 0.5. Undefined when it is none of these, @all included, which a
 * claim refuses.
 */
export function parseCpuLimit(text: string | undefined): number | undefined {
  const match = /^(\d+(?:\.\d+)?)%(?:@(\d+))?$/.exec((text ?? "").trim());
  if (!match) return undefined;
  return (Number(match[1]) / 100) * (match[2] === undefined ? 1 : Number(match[2]));
}

/**
 * The claims of a namespace configuration file: its `[claim#N]` sections, their
 * type, name and limit. A scoped value (`limit@node`) is no cluster-wide limit: it
 * is left out, as is a section without a known type.
 */
export function parseClaims(ini: string | undefined): Claim[] {
  const claims: Claim[] = [];
  let current: Record<string, string> | null = null;
  const flush = () => {
    if (!current) return;
    const type = current.type;
    if (type === "pool" || type === "network" || type === "cpu" || type === "memory") {
      const raw = current.limit;
      const limit =
        type === "cpu" ? parseCpuLimit(raw) : type === "network" ? (raw === undefined ? undefined : Number(raw)) : parseSize(raw);
      claims.push({ type, name: current.name, limit: Number.isFinite(limit) ? limit : undefined });
    }
    current = null;
  };
  for (const line of (ini ?? "").split("\n")) {
    const text = line.trim();
    if (text === "" || text.startsWith("#") || text.startsWith(";")) continue;
    const section = /^\[(.+)\]$/.exec(text);
    if (section) {
      flush();
      current = /^claim#/.test(section[1]) ? {} : null;
      continue;
    }
    const pair = /^([^=\s]+)\s*=\s*(.*)$/.exec(text);
    if (current && pair && !pair[1].includes("@")) current[pair[1]] = pair[2];
  }
  flush();
  return claims;
}

/** The namespace of an object path: "root" for a path of two parts or one. */
export const namespaceOf = (path: string) => {
  const parts = path.split("/");
  return parts.length === 3 ? parts[0] : "root";
};

/** What a namespace holds of one pool or network, and what it may hold. */
export interface UsageSegment {
  name: string;
  used: number;
  /** The claim limit, else the size of the pool or the network. */
  total: number;
  claimed: boolean;
}

/** What a namespace holds of all the pools or networks it uses or claims of. */
export interface Usage {
  used: number;
  total: number;
  free: number;
  segments: UsageSegment[];
}

const sum = (segments: UsageSegment[]): Usage => {
  const used = segments.reduce((n, s) => n + s.used, 0);
  const total = segments.reduce((n, s) => n + s.total, 0);
  return { used, total, free: Math.max(0, total - used), segments };
};

function usageOf(
  held: Map<string, number>,
  sizes: Map<string, number>,
  claims: Claim[],
  type: "pool" | "network",
): Usage {
  const limits = new Map<string, number>();
  for (const claim of claims) {
    if (claim.type === type && claim.name && claim.limit !== undefined) limits.set(claim.name, claim.limit);
  }
  const names = [...new Set([...held.keys(), ...limits.keys()])].sort();
  return sum(
    names.map((name) => {
      const limit = limits.get(name);
      return {
        name,
        used: held.get(name) ?? 0,
        total: limit ?? sizes.get(name) ?? 0,
        claimed: limit !== undefined,
      };
    }),
  );
}

export interface PoolItem {
  name: string;
  size?: number;
}
export interface VolumeItem {
  path: string;
  pool?: string;
  size?: number;
}
export interface NetworkItem {
  name: string;
  size?: number;
}
export interface AddressItem {
  ip: string;
  path?: string;
  network?: { name?: string };
}

/** What each namespace holds of each pool: the sizes its volumes were created with. */
export function poolHoldings(volumes: VolumeItem[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const volume of volumes) {
    if (!volume.pool) continue;
    const ns = namespaceOf(volume.path);
    const held = out.get(ns) ?? new Map<string, number>();
    held.set(volume.pool, (held.get(volume.pool) ?? 0) + (volume.size ?? 0));
    out.set(ns, held);
  }
  return out;
}

/** What each namespace holds of each network: its addresses, each counted once. */
export function networkHoldings(addresses: AddressItem[]): Map<string, Map<string, number>> {
  const seen = new Map<string, Map<string, Set<string>>>();
  for (const address of addresses) {
    const network = address.network?.name;
    if (!network || !address.path) continue;
    const ns = namespaceOf(address.path);
    const byNetwork = seen.get(ns) ?? new Map<string, Set<string>>();
    const ips = byNetwork.get(network) ?? new Set<string>();
    ips.add(address.ip);
    byNetwork.set(network, ips);
    seen.set(ns, byNetwork);
  }
  const out = new Map<string, Map<string, number>>();
  for (const [ns, byNetwork] of seen) {
    out.set(ns, new Map([...byNetwork].map(([network, ips]) => [network, ips.size])));
  }
  return out;
}

const sizesOf = (items: { name: string; size?: number }[]) =>
  new Map(items.map((item) => [item.name, item.size ?? 0]));

export function poolUsage(namespace: string, holdings: Map<string, Map<string, number>>, pools: PoolItem[], claims: Claim[]): Usage {
  return usageOf(holdings.get(namespace) ?? new Map(), sizesOf(pools), claims, "pool");
}

export function networkUsage(namespace: string, holdings: Map<string, Map<string, number>>, networks: NetworkItem[], claims: Claim[]): Usage {
  return usageOf(holdings.get(namespace) ?? new Map(), sizesOf(networks), claims, "network");
}

/** The cpu or memory limit a namespace claims, undefined when it claims none. */
export const computeLimit = (claims: Claim[], type: "cpu" | "memory") =>
  claims.find((claim) => claim.type === type && claim.limit !== undefined)?.limit;

/** The kinds a namespace row counts, each a column. */
export type CountedKind = "svc" | "vol" | "sec" | "cfg";

/** How many objects of each counted kind a namespace holds, svc and vol by availability. */
export interface KindCounts {
  svc: Record<string, number>;
  vol: Record<string, number>;
  sec: number;
  cfg: number;
}

const AVAILS = ["up", "warn", "down", "n/a"];

/** The objects of each namespace, counted by kind, the services and volumes by availability. */
export function kindCounts(objectStatus: Record<string, { avail?: string } | undefined>): Map<string, KindCounts> {
  const out = new Map<string, KindCounts>();
  for (const [path, status] of Object.entries(objectStatus)) {
    if (!path || !status || typeof status !== "object") continue;
    const parts = path.split("/");
    const ns = namespaceOf(path);
    const kind = parts.length >= 2 ? parts[parts.length - 2] : path === "cluster" ? "ccfg" : "svc";
    const counts = out.get(ns) ?? { svc: {}, vol: {}, sec: 0, cfg: 0 };
    if (kind === "svc" || kind === "vol") {
      const avail = AVAILS.includes(status.avail ?? "") ? (status.avail as string) : "n/a";
      counts[kind][avail] = (counts[kind][avail] ?? 0) + 1;
    } else if (kind === "sec" || kind === "cfg") {
      counts[kind] += 1;
    }
    out.set(ns, counts);
  }
  return out;
}
