/*
 * The cgroup usage of the objects, over every node of the cluster. Each daemon
 * serves the cgroups of its own node (`/metrics/pg`); the API relays any node's
 * (`/api/node/name/{node}/metrics/pg`). A reading of a node gives, for each object
 * with a cgroup there, its instance on that node: the cpu it used so far, the
 * memory it uses and its memory limit. Two readings give the cpu rate.
 *
 * Over the nodes, the figures of an object add up: its instances share nothing,
 * the cpu and the memory they use are the object's, their limits what the object
 * may use in all, unlimited if one of them is. Over the objects, a namespace's.
 *
 * A reading also tells of the opensvc slice of the node, every opensvc cgroup
 * there, the daemon's included (`scope="opensvc"`): what opensvc uses on the node,
 * shown to whom the whole node may be shown only; and of the slice of each namespace
 * there but the root one, whose objects stand in the opensvc slice itself
 * (`scope="namespace"`); of the whole host, the root cgroup and the memory of the
 * machine (`scope="host"`), and of the other top-level slices, by name
 * (`scope="slice"`: system.slice, user.slice, machine.slice…). Asked for an object
 * (`?path=`), the groups in its slice: its subsets (`scope="subset"`) and its
 * resources (`scope="resource"`, by rid, with their subset).
 */
import { parsePrometheusText } from "../utils/cgroupMetrics";

/** What a reading of a node says of an object with a cgroup there. */
export interface PgSample {
  namespace: string;
  /** Cpu time used so far, in microseconds. */
  cpuUsageUsec?: number;
  memoryCurrent?: number;
  /** Infinity: no limit. */
  memoryMax?: number;
  /** Bytes read and written so far, over the devices: told where the io controller is on. */
  ioReadBytes?: number;
  ioWriteBytes?: number;
  /** Its tasks: told where the pids controller is on. */
  tasks?: number;
  /** The cpus it runs on. */
  cpus?: number;
}

/**
 * A reading of a node: when, its objects by path, its opensvc slice when told, its
 * namespace slices by namespace, the host when told, the other top-level slices by name.
 */
export interface NodeReading {
  /** When it was fetched, in ms: its time when the daemon does not tell when it was read. */
  at: number;
  /**
   * When the daemon read the cgroups, in ms (`opensvc_pg_collected_at_seconds`): the
   * node, its slices and its objects (`walk`); the subsets and resources asked for
   * (`parts`). Other scrapers decide when a reading is taken, the fetch may come later.
   */
  walkAt?: number;
  partsAt?: number;
  byPath: Record<string, PgSample>;
  opensvc?: PgSample;
  namespaces?: Record<string, PgSample>;
  host?: PgSample;
  slices?: Record<string, PgSample>;
  /** The groups in the slices of the objects asked for, by object path. */
  details?: Record<string, ObjectDetail<PgSample>>;
}

/** The groups in the slice of an object: its subsets by name, its resources by rid with their subset. */
export interface ObjectDetail<T> {
  subsets: Record<string, T>;
  resources: Record<string, { subset: string; sample: T }>;
}

/**
 * The usage of an instance: the cpu in cpus, null until a second reading tells it;
 * the bytes read and written a second likewise, undefined where not told; its tasks.
 */
export interface Usage {
  cpu: number | null;
  memory?: number;
  limit?: number;
  read?: number | null;
  write?: number | null;
  tasks?: number;
  /** The cpus it runs on: for the share of the capacity. */
  cpus?: number;
}

/** The usage of the instances of each node, by object path. */
export type ClusterUsage = Record<string, Record<string, Usage>>;

const FIELDS: Record<string, keyof Omit<PgSample, "namespace">> = {
  opensvc_pg_cgroup_cpu_usage_usec: "cpuUsageUsec",
  opensvc_pg_cgroup_memory_current_bytes: "memoryCurrent",
  opensvc_pg_cgroup_memory_max_bytes: "memoryMax",
  opensvc_pg_cgroup_io_read_bytes: "ioReadBytes",
  opensvc_pg_cgroup_io_write_bytes: "ioWriteBytes",
  opensvc_pg_cgroup_tasks: "tasks",
  opensvc_pg_cgroup_cpu_cpus: "cpus",
};

/**
 * A counter between two readings, by unit of time: none on a first reading, nor for
 * a counter gone back (a cgroup recreated); undefined when the counter is not told.
 */
function rate(before: number | undefined, now: number | undefined, elapsed: number): number | null | undefined {
  if (now === undefined) return undefined;
  return before === undefined || now < before || elapsed <= 0 ? null : (now - before) / elapsed;
}

/** The usage a sample tells, against the one before it, `elapsedMs` earlier. */
function sampleUsage(before: PgSample | undefined, sample: PgSample, elapsedMs: number): Usage {
  const usage: Usage = {
    cpu: rate(before?.cpuUsageUsec, sample.cpuUsageUsec, elapsedMs * 1000) ?? null,
    memory: sample.memoryCurrent,
    limit: sample.memoryMax,
  };
  const read = rate(before?.ioReadBytes, sample.ioReadBytes, elapsedMs / 1000);
  const write = rate(before?.ioWriteBytes, sample.ioWriteBytes, elapsedMs / 1000);
  if (read !== undefined) usage.read = read;
  if (write !== undefined) usage.write = write;
  if (sample.tasks !== undefined) usage.tasks = sample.tasks;
  if (sample.cpus !== undefined) usage.cpus = sample.cpus;
  return usage;
}

/**
 * What a reading tells: the objects with a cgroup on the node, those the daemon
 * knows without one there (`opensvc_pg_cgroup_exists 0`, no usage) left out; and the
 * opensvc slice of the node, when the reader may see it and it is there.
 */
export function readPgScopes(text: string): Omit<NodeReading, "at"> {
  const byPath: Record<string, PgSample> = {};
  const absent = new Set<string>();
  const namespaces: Record<string, PgSample> = {};
  const absentNamespaces = new Set<string>();
  const slices: Record<string, PgSample> = {};
  const absentSlices = new Set<string>();
  let opensvc: PgSample | undefined;
  let opensvcAbsent = false;
  let host: PgSample | undefined;
  const details: Record<string, ObjectDetail<PgSample>> = {};
  const absentGroups = new Set<string>();
  let walkAt: number | undefined;
  let partsAt: number | undefined;
  for (const { name, labels, value } of parsePrometheusText(text) as {
    name: string;
    labels: Record<string, string>;
    value: number;
  }[]) {
    if (name === "opensvc_pg_collected_at_seconds") {
      if (labels.collection === "walk") walkAt = value * 1000;
      else if (labels.collection === "parts") partsAt = value * 1000;
      continue;
    }
    if (labels.scope === "opensvc") {
      if (name === "opensvc_pg_cgroup_exists" && value === 0) opensvcAbsent = true;
      const field = FIELDS[name];
      if (!field) continue;
      opensvc ??= { namespace: "" };
      opensvc[field] = value;
      continue;
    }
    if (labels.scope === "subset" || labels.scope === "resource") {
      const path = labels.path;
      const subset = labels.subset ?? "";
      const rid = labels.rid ?? "";
      if (!path || (labels.scope === "subset" ? !subset : !rid)) continue;
      const key = `${labels.scope}\u0000${path}\u0000${labels.scope === "subset" ? subset : rid}`;
      if (name === "opensvc_pg_cgroup_exists" && value === 0) absentGroups.add(key);
      const field = FIELDS[name];
      if (!field) continue;
      details[path] ??= { subsets: {}, resources: {} };
      if (labels.scope === "subset") {
        details[path].subsets[subset] ??= { namespace: labels.namespace ?? "" };
        details[path].subsets[subset][field] = value;
      } else {
        details[path].resources[rid] ??= { subset, sample: { namespace: labels.namespace ?? "" } };
        details[path].resources[rid].sample[field] = value;
      }
      continue;
    }
    if (labels.scope === "host") {
      const field = FIELDS[name];
      if (!field) continue;
      host ??= { namespace: "" };
      host[field] = value;
      continue;
    }
    if (labels.scope === "slice") {
      const slice = labels.path;
      if (!slice) continue;
      if (name === "opensvc_pg_cgroup_exists" && value === 0) absentSlices.add(slice);
      const field = FIELDS[name];
      if (!field) continue;
      slices[slice] ??= { namespace: "" };
      slices[slice][field] = value;
      continue;
    }
    if (labels.scope === "namespace") {
      const namespace = labels.namespace;
      if (!namespace) continue;
      if (name === "opensvc_pg_cgroup_exists" && value === 0) absentNamespaces.add(namespace);
      const field = FIELDS[name];
      if (!field) continue;
      namespaces[namespace] ??= { namespace };
      namespaces[namespace][field] = value;
      continue;
    }
    const path = labels.path;
    if (!path) continue;
    if (name === "opensvc_pg_cgroup_exists" && value === 0) absent.add(path);
    const field = FIELDS[name];
    if (!field) continue;
    byPath[path] ??= { namespace: labels.namespace ?? "" };
    byPath[path][field] = value;
  }
  for (const path of absent) delete byPath[path];
  for (const namespace of absentNamespaces) delete namespaces[namespace];
  for (const slice of absentSlices) delete slices[slice];
  for (const key of absentGroups) {
    const [scope, path, name] = key.split("\u0000");
    if (scope === "subset") delete details[path]?.subsets[name];
    else delete details[path]?.resources[name];
  }
  const reading: Omit<NodeReading, "at"> = { byPath, namespaces, slices };
  if (walkAt !== undefined) reading.walkAt = walkAt;
  if (partsAt !== undefined) reading.partsAt = partsAt;
  if (Object.keys(details).length > 0) reading.details = details;
  if (opensvc && !opensvcAbsent) reading.opensvc = opensvc;
  if (host) reading.host = host;
  return reading;
}

/** The objects a reading tells of, with a cgroup on the node (`readPgScopes`). */
export function readPg(text: string): Record<string, PgSample> {
  return readPgScopes(text).byPath;
}

/**
 * The time between two readings, in ms: between the times the daemon read them at
 * when it tells (`walkAt`, or `partsAt` for the subsets and resources), else between
 * their fetches; none without a reading before.
 */
function elapsed(previous: NodeReading | undefined, current: NodeReading, collection: "walkAt" | "partsAt" = "walkAt"): number {
  if (!previous) return 0;
  const before = previous[collection];
  const now = current[collection];
  return before !== undefined && now !== undefined ? now - before : current.at - previous.at;
}

/** Whether a reading is the one before again: read in the same window by another scrape. */
export function sameReading(previous: NodeReading | undefined, current: NodeReading): boolean {
  return previous?.walkAt !== undefined && previous.walkAt === current.walkAt;
}

/**
 * The usage of the instances of a node, from its last reading and the one before:
 * the cpu used between them, in cpus; none on a first reading, nor for a counter
 * gone back, a cgroup recreated.
 */
export function nodeUsage(previous: NodeReading | undefined, current: NodeReading): Record<string, Usage> {
  const out: Record<string, Usage> = {};
  const elapsedMs = elapsed(previous, current);
  for (const [path, sample] of Object.entries(current.byPath)) {
    out[path] = sampleUsage(previous?.byPath[path], sample, elapsedMs);
  }
  return out;
}

/** The usage of the namespace slices of a node, as that of its objects (nodeUsage): the cpu from a second reading. */
export function namespaceSlicesUsage(previous: NodeReading | undefined, current: NodeReading): Record<string, Usage> {
  return nodeUsage(
    previous && { ...previous, byPath: previous.namespaces ?? {} },
    { ...current, byPath: current.namespaces ?? {} },
  );
}

/** The usage of the other top-level slices of a node, by name, as that of its objects. */
export function topSlicesUsage(previous: NodeReading | undefined, current: NodeReading): Record<string, Usage> {
  return nodeUsage(
    previous && { ...previous, byPath: previous.slices ?? {} },
    { ...current, byPath: current.slices ?? {} },
  );
}

/** The usage of the groups in the slices of the objects asked for, by object path, as that of the objects. */
export function detailsUsage(previous: NodeReading | undefined, current: NodeReading): Record<string, ObjectDetail<Usage>> {
  const out: Record<string, ObjectDetail<Usage>> = {};
  const elapsedMs = elapsed(previous, current, "partsAt");
  for (const [path, detail] of Object.entries(current.details ?? {})) {
    const before = previous?.details?.[path];
    out[path] = {
      subsets: Object.fromEntries(Object.entries(detail.subsets).map(([name, sample]) => [name, sampleUsage(before?.subsets[name], sample, elapsedMs)])),
      resources: Object.fromEntries(Object.entries(detail.resources).map(([rid, { subset, sample }]) => [
        rid,
        { subset, sample: sampleUsage(before?.resources[rid]?.sample, sample, elapsedMs) },
      ])),
    };
  }
  return out;
}

/** The usage of the whole host, as that of its opensvc slice (opensvcUsage): undefined when not told. */
export function hostUsage(previous: NodeReading | undefined, current: NodeReading): Usage | undefined {
  if (current.host === undefined) return undefined;
  return sampleUsage(previous?.host, current.host, elapsed(previous, current));
}

/**
 * The usage of the opensvc slice of a node, from its last reading and the one
 * before: the cpu used between them in cpus, null on a first reading; undefined
 * when the reading does not tell it (the reader may not see the whole node).
 */
export function opensvcUsage(previous: NodeReading | undefined, current: NodeReading): Usage | undefined {
  if (current.opensvc === undefined) return undefined;
  return sampleUsage(previous?.opensvc, current.opensvc, elapsed(previous, current));
}

/**
 * The figures of a usage beyond the cpu and the memory its readings tell, in the
 * order of the columns: the tasks, the bytes read and written a second.
 */
export const IO_FIGURES = ["tasks", "read", "write"] as const;

/**
 * The sum of usages: the cpus told, the memories, the limits, unlimited if one is;
 * the io rates and the tasks where told, a rate null while one of them waits for its
 * second reading.
 */
export function sumUsage(usages: Usage[]): Usage {
  const cpus = usages.map((u) => u.cpu).filter((c): c is number => c !== null && c !== undefined);
  const memories = usages.map((u) => u.memory).filter((m): m is number => m !== undefined);
  const limits = usages.map((u) => u.limit).filter((l): l is number => l !== undefined);
  const sum: Usage = {
    cpu: cpus.length === 0 ? null : cpus.reduce((a, b) => a + b, 0),
    memory: memories.length === 0 ? undefined : memories.reduce((a, b) => a + b, 0),
    limit: limits.length === 0 ? undefined : limits.reduce((a, b) => a + b, 0),
  };
  for (const key of ["read", "write"] as const) {
    const told = usages.map((u) => u[key]).filter((v) => v !== undefined);
    if (told.length > 0) sum[key] = told.some((v) => v === null) ? null : (told as number[]).reduce((a, b) => a + b, 0);
  }
  for (const key of ["tasks", "cpus"] as const) {
    const told = usages.map((u) => u[key]).filter((v): v is number => v !== undefined);
    if (told.length > 0) sum[key] = told.reduce((a, b) => a + b, 0);
  }
  return sum;
}

/** An instance of an object: its node, its usage there. */
export interface InstanceUsage extends Usage {
  node: string;
}

/** The usage of an object: its instances, node by node, and their sum. */
export interface ObjectUsage extends Usage {
  path: string;
  instances: InstanceUsage[];
}

/** The usage of an object over the nodes reporting it, its instances in the order of the nodes. */
export function objectUsage(usage: ClusterUsage, path: string): ObjectUsage {
  const instances = Object.keys(usage)
    .sort()
    .filter((node) => usage[node][path] !== undefined)
    .map((node) => ({ node, ...usage[node][path] }));
  return { path, instances, ...sumUsage(instances) };
}

/** The usage of the objects of a namespace over the nodes, and their sum. */
export function namespaceUsage(
  usage: ClusterUsage,
  namespaceOf: (path: string) => string,
  namespace: string,
): Usage & { objects: ObjectUsage[] } {
  const paths = new Set<string>();
  for (const byPath of Object.values(usage)) {
    for (const path of Object.keys(byPath)) if (namespaceOf(path) === namespace) paths.add(path);
  }
  const objects = [...paths].sort().map((path) => objectUsage(usage, path));
  return { objects, ...sumUsage(objects) };
}

/** The usage of every namespace, summed over its objects and the nodes. */
export function namespacesUsage(usage: ClusterUsage, namespaceOf: (path: string) => string): Record<string, Usage> {
  const byNamespace: Record<string, Usage[]> = {};
  for (const byPath of Object.values(usage)) {
    for (const [path, u] of Object.entries(byPath)) (byNamespace[namespaceOf(path)] ??= []).push(u);
  }
  return Object.fromEntries(Object.entries(byNamespace).map(([ns, list]) => [ns, sumUsage(list)]));
}
