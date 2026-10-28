/*
 * The cgroups of opensvc as a tree, as systemd-cgtop shows a host's: the opensvc
 * slice, in it the slice of each namespace and its objects, the objects of the root
 * namespace (which has no slice of its own), and what is left, the daemon and the
 * rest. Over the nodes chosen, the figures add up. The whole host told, the tree is
 * its: the opensvc slice beside the other top-level slices, and what none of them holds.
 */
import { sumUsage, type ClusterUsage, type ObjectDetail, type Usage } from "./pg-usage";

export type UsageTreeKind = "host" | "opensvc" | "slice" | "namespace" | "object" | "instance" | "subset" | "resource" | "other" | "rest";

export interface UsageTreeNode {
  key: string;
  kind: UsageTreeKind;
  /** The namespace of a namespace slice, the path of an object, the node of an instance. */
  name: string;
  /** The object of an instance, of a subset, of a resource. */
  path?: string;
  /** The node of the instance a subset or a resource is of. */
  node?: string;
  /** The group a view is about, among those around it. */
  focus?: boolean;
  usage: Usage;
  children: UsageTreeNode[];
}

/** What the reader of the cgroups told (usePgReadings). */
export interface UsageReadings {
  usage: ClusterUsage;
  totals: Record<string, Usage>;
  namespaces: Record<string, Record<string, Usage>>;
  hosts?: Record<string, Usage>;
  slices?: Record<string, Record<string, Usage>>;
  /** The groups in the slices of the objects asked for, by node then object. */
  details?: Record<string, Record<string, ObjectDetail<Usage>>>;
}

/**
 * The groups in the slice of an instance, as its subsets and resources: each subset
 * with its resources, then the resources of no subset, in the order of their names.
 */
function instanceGroups(detail: ObjectDetail<Usage> | undefined, path: string, node: string): UsageTreeNode[] {
  if (detail === undefined) return [];
  const byName = (a: UsageTreeNode, b: UsageTreeNode) => a.name.localeCompare(b.name, undefined, { numeric: true });
  const resources = Object.entries(detail.resources).map(([rid, { subset, sample }]) => ({
    subset,
    node: { key: `resource:${node}:${rid}`, kind: "resource" as const, name: rid, path, node, usage: sample, children: [] },
  }));
  const subsets = Object.entries(detail.subsets).map(([name, usage]) => ({
    key: `subset:${node}:${name}`,
    kind: "subset" as const,
    name,
    path,
    node,
    usage,
    children: resources.filter((r) => r.subset === name).map((r) => r.node).sort(byName),
  }));
  return [...subsets.sort(byName), ...resources.filter((r) => !(r.subset in detail.subsets)).map((r) => r.node).sort(byName)];
}

/** What a usage has, less what its parts use: none below zero, none unless both are known. */
function remainder(whole: Usage, parts: Usage[]): Usage {
  const known = sumUsage(parts);
  const rest: Usage = { cpu: less(whole.cpu, known.cpu) ?? null, memory: less(whole.memory, known.memory) };
  for (const key of ["read", "write"] as const) {
    if (whole[key] !== undefined) rest[key] = whole[key] === null ? null : less(whole[key], known[key]);
  }
  if (whole.tasks !== undefined) rest.tasks = less(whole.tasks, known.tasks);
  return rest;
}

const ROOT = "root";

/** The difference of two figures, none below zero (a reading of the parent before its children's); none unless both are known. */
const less = (a: number | null | undefined, b: number | null | undefined) =>
  a === null || a === undefined || b === null || b === undefined ? (a ?? undefined) : Math.max(0, a - b);

/**
 * The tree of the opensvc cgroups over `nodes`: none when no node told its opensvc
 * slice (the reader may not see whole nodes). A namespace of no slice told stands
 * for the sum of its objects.
 */
export function usageTree(
  nodes: string[],
  { usage, totals, namespaces, hosts = {}, slices: topSlices = {} }: UsageReadings,
  namespaceOf: (path: string) => string,
): UsageTreeNode | null {
  const told = nodes.filter((node) => totals[node] !== undefined);
  if (told.length === 0) return null;

  // Each object over the nodes, by namespace.
  const objects = new Map<string, Usage[]>();
  for (const node of told) {
    for (const [path, u] of Object.entries(usage[node] ?? {})) {
      if (!objects.has(path)) objects.set(path, []);
      objects.get(path)!.push(u);
    }
  }
  const byNamespace = new Map<string, UsageTreeNode[]>();
  for (const [path, list] of objects) {
    const ns = namespaceOf(path);
    if (!byNamespace.has(ns)) byNamespace.set(ns, []);
    byNamespace.get(ns)!.push({ key: `object:${path}`, kind: "object", name: path, usage: sumUsage(list), children: [] });
  }

  // Each namespace slice over the nodes, but the root namespace, its objects in the opensvc slice.
  const slices = new Map<string, Usage[]>();
  for (const node of told) {
    for (const [ns, u] of Object.entries(namespaces[node] ?? {})) {
      if (!slices.has(ns)) slices.set(ns, []);
      slices.get(ns)!.push(u);
    }
  }
  const nsNames = [...new Set([...slices.keys(), ...byNamespace.keys()])].filter((ns) => ns !== ROOT);
  const children: UsageTreeNode[] = nsNames.map((ns) => {
    const objectsOf = byNamespace.get(ns) ?? [];
    return {
      key: `namespace:${ns}`,
      kind: "namespace",
      name: ns,
      usage: slices.has(ns) ? sumUsage(slices.get(ns)!) : sumUsage(objectsOf.map((o) => o.usage)),
      children: objectsOf,
    };
  });
  children.push(...(byNamespace.get(ROOT) ?? []));

  const total = sumUsage(told.map((node) => totals[node]));
  children.push({ key: "other", kind: "other", name: "", usage: remainder(total, children.map((c) => c.usage)), children: [] });
  const opensvc: UsageTreeNode = { key: "opensvc", kind: "opensvc", name: "", usage: total, children };

  // The whole host, on every node chosen: the opensvc slice among the other top-level ones.
  if (!told.every((node) => hosts[node] !== undefined)) return opensvc;
  const bySlice = new Map<string, Usage[]>();
  for (const node of told) {
    for (const [slice, u] of Object.entries(topSlices[node] ?? {})) {
      if (!bySlice.has(slice)) bySlice.set(slice, []);
      bySlice.get(slice)!.push(u);
    }
  }
  const others: UsageTreeNode[] = [...bySlice].map(([slice, list]) => ({
    key: `slice:${slice}`, kind: "slice", name: slice, usage: sumUsage(list), children: [],
  }));
  const host = sumUsage(told.map((node) => hosts[node]));
  const parts = [opensvc, ...others];
  return {
    key: "host",
    kind: "host",
    name: "",
    usage: host,
    children: [...parts, { key: "rest", kind: "rest", name: "", usage: remainder(host, parts.map((c) => c.usage)), children: [] }],
  };
}

/**
 * The groups around an object, over `nodes` (its instances' nodes, or the node of one):
 * the opensvc slice when told, the slice of its namespace when told and not the root
 * one, then the object, the group a view is about, and with `instances`, its instance
 * on each node under it. The subsets and resources of an instance read (`details`),
 * under it; of the object on one node without `instances`, under the object. None
 * when no node tells a group of the object.
 */
export function objectUsageTree(
  nodes: string[],
  { usage, totals, namespaces, details = {} }: UsageReadings,
  path: string,
  namespaceOf: (path: string) => string,
  { instances = false }: { instances?: boolean } = {},
): UsageTreeNode | null {
  const on = nodes.filter((node) => usage[node]?.[path] !== undefined);
  if (on.length === 0) return null;
  let tree: UsageTreeNode = {
    key: `object:${path}`,
    kind: "object",
    name: path,
    focus: true,
    usage: sumUsage(on.map((node) => usage[node][path])),
    // Every instance, a node telling no group for it with no figure.
    children: instances
      ? nodes.map((node) => ({
          key: `instance:${node}`,
          kind: "instance" as const,
          name: node,
          path,
          usage: usage[node]?.[path] ?? { cpu: null },
          children: instanceGroups(details[node]?.[path], path, node),
        }))
      : nodes.length === 1 ? instanceGroups(details[nodes[0]]?.[path], path, nodes[0]) : [],
  };
  const ns = namespaceOf(path);
  const slices = nodes.map((node) => namespaces[node]?.[ns]).filter((u): u is Usage => u !== undefined);
  if (ns !== ROOT && slices.length > 0) {
    tree = { key: `namespace:${ns}`, kind: "namespace", name: ns, usage: sumUsage(slices), children: [tree] };
  }
  const told = nodes.map((node) => totals[node]).filter((u): u is Usage => u !== undefined);
  if (told.length > 0) tree = { key: "opensvc", kind: "opensvc", name: "", usage: sumUsage(told), children: [tree] };
  return tree;
}

export type UsageOrder = "cpu" | "memory" | "tasks" | "read" | "write" | "name";

/**
 * The tree in an order, at every level: the most used first, by cpu, memory, tasks,
 * bytes read or written a second, or by name; a figure not told last of the used;
 * the rest always last.
 */
export function sortUsageTree(node: UsageTreeNode, order: UsageOrder): UsageTreeNode {
  const value = (n: UsageTreeNode) => (order === "name" ? 0 : (n.usage[order] ?? -1));
  const children = [...node.children]
    .map((child) => sortUsageTree(child, order))
    .sort((a, b) => {
      // What is left, last.
      const last = (n: UsageTreeNode) => n.kind === "other" || n.kind === "rest";
      if (last(a) || last(b)) return last(a) ? 1 : -1;
      if (order === "name") return a.name.localeCompare(b.name);
      return value(b) - value(a) || a.name.localeCompare(b.name);
    });
  return { ...node, children };
}
