import { describe, expect, test } from "vitest";
import { objectUsageTree, sortUsageTree, usageTree, type UsageTreeNode } from "../pg-tree";
import { namespaceOf } from "../namespace-usage";

const readings = {
  usage: {
    n1: { "dev/svc/a": { cpu: 0.1, memory: 100 }, "dev/svc/b": { cpu: 0.3, memory: 50 }, web: { cpu: 0.05, memory: 10 } },
    n2: { "dev/svc/a": { cpu: 0.2, memory: 200 }, "kvm/svc/vm": { cpu: 0.5, memory: 400 } },
  },
  totals: { n1: { cpu: 1, memory: 1000 }, n2: { cpu: 1, memory: 1000 } },
  namespaces: { n1: { dev: { cpu: 0.45, memory: 160 } }, n2: { dev: { cpu: 0.2, memory: 210 } } },
};

/** The tree as lines: the depth, the kind, the name, the cpu and the memory. */
const lines = (node: UsageTreeNode | null, depth = 0): string[] =>
  node === null ? [] : [
    `${depth} ${node.kind} ${node.name} ${node.usage.cpu === null || node.usage.cpu === undefined ? "-" : node.usage.cpu.toFixed(2)} ${node.usage.memory ?? "-"}`,
    ...node.children.flatMap((c) => lines(c, depth + 1)),
  ];

describe("usageTree", () => {
  test("the opensvc slice; its namespaces, from their slices, their objects; the root's objects; the rest; over the nodes", () => {
    expect(lines(usageTree(["n1", "n2"], readings, namespaceOf))).toEqual([
      "0 opensvc  2.00 2000",
      "1 namespace dev 0.65 370",
      "2 object dev/svc/a 0.30 300",
      "2 object dev/svc/b 0.30 50",
      // No slice told: the sum of its objects.
      "1 namespace kvm 0.50 400",
      "2 object kvm/svc/vm 0.50 400",
      "1 object web 0.05 10",
      "1 other  0.80 1220",
    ]);
  });

  test("a node alone: its own figures", () => {
    expect(lines(usageTree(["n2"], readings, namespaceOf))[0]).toBe("0 opensvc  1.00 1000");
  });

  test("no opensvc slice told: no tree", () => {
    expect(usageTree(["n1"], { ...readings, totals: {} }, namespaceOf)).toBeNull();
  });
});

describe("usageTree of the whole host", () => {
  const withHost = {
    ...readings,
    hosts: { n1: { cpu: 3, memory: 5000, cpus: 8 }, n2: { cpu: 2, memory: 4000, cpus: 8 } },
    slices: { n1: { "user.slice": { cpu: 1, memory: 1500 } }, n2: { "user.slice": { cpu: 0.5, memory: 500 }, "system.slice": { cpu: 0.2, memory: 300 } } },
  };

  test("the host on top: the opensvc slice beside the other top-level slices, then what none holds", () => {
    const tree = usageTree(["n1", "n2"], withHost, namespaceOf)!;
    expect(lines(tree).filter((l) => l.startsWith("0 ") || l.startsWith("1 "))).toEqual([
      "0 host  5.00 9000",
      "1 opensvc  2.00 2000",
      "1 slice user.slice 1.50 2000",
      "1 slice system.slice 0.20 300",
      "1 rest  1.30 4700",
    ]);
    expect(tree.usage.cpus).toBe(16);
    // Sorted, what none holds stays last.
    expect(sortUsageTree(tree, "memory").children.map((c) => c.kind)).toEqual(["opensvc", "slice", "slice", "rest"]);
  });

  test("a node not telling its host: the opensvc slice on top, as before", () => {
    expect(usageTree(["n1", "n2"], { ...withHost, hosts: { n1: withHost.hosts.n1 } }, namespaceOf)?.kind).toBe("opensvc");
  });
});

describe("objectUsageTree", () => {
  test("the slices around an object over its nodes, the object marked, its instances under it", () => {
    expect(lines(objectUsageTree(["n1", "n2"], readings, "dev/svc/a", namespaceOf, { instances: true }))).toEqual([
      "0 opensvc  2.00 2000",
      "1 namespace dev 0.65 370",
      "2 object dev/svc/a 0.30 300",
      "3 instance n1 0.10 100",
      "3 instance n2 0.20 200",
    ]);
    expect(objectUsageTree(["n1"], readings, "dev/svc/a", namespaceOf)?.children[0].children[0].focus).toBe(true);
  });

  test("a root object in the opensvc slice; the whole node not told: from the namespace; no group of it: no tree", () => {
    expect(lines(objectUsageTree(["n1"], readings, "web", namespaceOf))).toEqual(["0 opensvc  1.00 1000", "1 object web 0.05 10"]);
    expect(lines(objectUsageTree(["n1"], { ...readings, totals: {} }, "dev/svc/b", namespaceOf))).toEqual([
      "0 namespace dev 0.45 160",
      "1 object dev/svc/b 0.30 50",
    ]);
    expect(objectUsageTree(["n2"], readings, "web", namespaceOf)).toBeNull();
  });
});

describe("sortUsageTree", () => {
  const tree = usageTree(["n1", "n2"], readings, namespaceOf)!;
  const order = (node: UsageTreeNode) => node.children.map((c) => c.name || c.kind);

  test("the most used first, by cpu or memory, at every level; the rest last", () => {
    expect(order(sortUsageTree(tree, "cpu"))).toEqual(["dev", "kvm", "web", "other"]);
    expect(order(sortUsageTree(tree, "memory"))).toEqual(["kvm", "dev", "web", "other"]);
    expect(order(sortUsageTree(tree, "memory").children[1])).toEqual(["dev/svc/a", "dev/svc/b"]);
  });

  test("by tasks, bytes read or written a second: the most first, a figure not told after, the rest last", () => {
    const leaf = (name: string, usage: UsageTreeNode["usage"]): UsageTreeNode => ({ key: name, kind: "slice", name, usage, children: [] });
    const io: UsageTreeNode = {
      key: "host",
      kind: "host",
      name: "",
      usage: { cpu: 1 },
      children: [
        { key: "rest", kind: "rest", name: "", usage: { cpu: 0, tasks: 900, read: 9e9, write: 9e9 }, children: [] },
        leaf("a", { cpu: 0, tasks: 5, read: 100, write: null }),
        leaf("b", { cpu: 0, tasks: 50, read: 10, write: 300 }),
        leaf("c", { cpu: 0 }),
      ],
    };
    expect(order(sortUsageTree(io, "tasks"))).toEqual(["b", "a", "c", "rest"]);
    expect(order(sortUsageTree(io, "read"))).toEqual(["a", "b", "c", "rest"]);
    expect(order(sortUsageTree(io, "write"))).toEqual(["b", "a", "c", "rest"]);
  });

  test("by name", () => {
    expect(order(sortUsageTree(tree, "name"))).toEqual(["dev", "kvm", "web", "other"]);
  });
});
