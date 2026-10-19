import { describe, expect, test } from "vitest";
import type { MeshLink } from "../heartbeat-mesh";
import { heartbeatsOf, layerOf, sidesOf } from "../heartbeat-summary";

/** A link one way, its sender and receiver, beating or not. */
const link = (hb: string, type: string, from: string, to: string, up: boolean, extra: Partial<MeshLink> = {}): MeshLink => ({
  key: `${hb} ${from} ${to}`,
  node: from,
  peer: to,
  hb,
  dir: "tx",
  type,
  from,
  to,
  state: up ? "up" : "down",
  streamState: "running",
  ...extra,
});

/** Both ways between two nodes, beating or not each. */
const both = (hb: string, type: string, a: string, b: string, aToB: boolean, bToA = aToB) => [
  link(hb, type, a, b, aToB),
  link(hb, type, b, a, bToA),
];

describe("heartbeat summary", () => {
  test("the layer of a driver: the network for unicast and multicast, the storage for a disk, a relay", () => {
    expect(["unicast", "multicast", "disk", "relay", "foo"].map(layerOf)).toEqual(["network", "network", "storage", "relay", "other"]);
  });

  test("each heartbeat over the cluster: its links beating out of all, its driver and layer", () => {
    const rows = heartbeatsOf([...both("hb#2", "disk", "n1", "n2", true, false), ...both("hb#1", "unicast", "n1", "n2", true)]);
    expect(rows.map((r) => [r.hb, r.type, r.layer, r.beating, r.total, r.state])).toEqual([
      ["hb#1", "unicast", "network", 2, 2, "up"],
      ["hb#2", "disk", "storage", 1, 2, "warn"],
    ]);
  });

  test("each side of each node: its heartbeats, their links beating, stopped, out of all", () => {
    // The links of both sides of each end: n1 tx and n2 rx, n2 tx and n1 rx.
    const ends = (hb: string, a: string, b: string, up: boolean, extra: Partial<MeshLink> = {}) => [
      link(hb, "unicast", a, b, up, { node: a, peer: b, dir: "tx", ...extra }),
      link(hb, "unicast", a, b, up, { node: b, peer: a, dir: "rx" }),
    ];
    const rows = sidesOf([
      ...ends("hb#1", "n10", "n1", true),
      ...ends("hb#1", "n1", "n10", true),
      ...ends("hb#2", "n1", "n10", false, { streamState: "stopped" }),
    ]);
    expect(rows.map((r) => [r.node, r.dir, r.hbs, r.beating, r.stopped, r.total, r.state])).toEqual([
      ["n1", "tx", ["hb#1", "hb#2"], 1, 1, 2, "warn"],
      ["n1", "rx", ["hb#1"], 1, 0, 1, "up"],
      ["n10", "tx", ["hb#1"], 1, 0, 1, "up"],
      ["n10", "rx", ["hb#1", "hb#2"], 1, 0, 2, "warn"],
    ]);
  });
});
