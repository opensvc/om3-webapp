import { describe, expect, test } from "vitest";
import type { MeshLink } from "../heartbeat-mesh";
import { driversOf, heartbeatsOf, layerOf } from "../heartbeat-summary";

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

  test("each driver over the cluster: its heartbeats, their links beating out of all, its layer", () => {
    const rows = driversOf([
      ...both("hb#1", "unicast", "n1", "n2", true),
      ...both("hb#11", "unicast", "n1", "n2", false),
      ...both("hb#2", "disk", "n1", "n2", true),
    ]);
    expect(rows.map((r) => [r.type, r.layer, r.hbs, r.beating, r.total, r.state])).toEqual([
      ["disk", "storage", ["hb#2"], 2, 2, "up"],
      ["unicast", "network", ["hb#1", "hb#11"], 2, 4, "warn"],
    ]);
  });
});
