/*
 * What the heartbeat mesh says at a glance (HeartbeatSummary): how each heartbeat
 * fares over the cluster and the layer of infrastructure it goes over, how each node
 * sends and receives. Read from the links of the mesh (meshLinks).
 */

import type { GroupState, MeshLink } from "./heartbeat-mesh";

/**
 * The kind of infrastructure a heartbeat goes over, its redundancy layer: the
 * network (unicast, multicast), the storage (a shared disk), a relay (a third
 * site). Two heartbeats of a layer fail together when it fails.
 */
export type Layer = "network" | "storage" | "relay" | "other";

export const LAYERS: readonly Layer[] = ["network", "storage", "relay", "other"];

export function layerOf(type: string): Layer {
  switch (type) {
    case "unicast":
    case "multicast":
      return "network";
    case "disk":
      return "storage";
    case "relay":
      return "relay";
    default:
      return "other";
  }
}

/** Links beating, on a stopped stream, out of all: the figures and the bar of a row. */
interface Counts {
  beating: number;
  stopped: number;
  total: number;
  state: GroupState;
}

/** A heartbeat over the cluster: its links beating out of all of them. */
export interface HeartbeatSummaryRow extends Counts {
  hb: string;
  type: string;
  layer: Layer;
}

function countsOf(links: MeshLink[]): Counts {
  const beating = links.filter((l) => l.state === "up").length;
  const stopped = links.filter((l) => l.streamState !== undefined && l.streamState !== "running").length;
  const total = links.length;
  return { beating, stopped, total, state: beating === total ? "up" : beating === 0 ? "down" : "warn" };
}

/** Each heartbeat, by its name, with its links beating out of all of them. */
export function heartbeatsOf(links: MeshLink[]): HeartbeatSummaryRow[] {
  const byHb = new Map<string, MeshLink[]>();
  for (const link of links) {
    byHb.set(link.hb, [...(byHb.get(link.hb) ?? []), link]);
  }
  return [...byHb.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hb, of]) => {
      const type = of.find((l) => l.type)?.type ?? "";
      return { hb, type, layer: layerOf(type), ...countsOf(of) };
    });
}

/**
 * A side of a node: its tx streams sending to its peers, or its rx streams receiving
 * from them, over all its heartbeats.
 */
export interface SideSummaryRow extends Counts {
  node: string;
  dir: "tx" | "rx";
  hbs: string[];
}

/** Each node, by its name, its tx side then its rx side, with their links beating out of all. */
export function sidesOf(links: MeshLink[]): SideSummaryRow[] {
  const bySide = new Map<string, MeshLink[]>();
  for (const link of links) {
    if (link.dir === "") continue;
    const key = `${link.dir} ${link.node}`;
    bySide.set(key, [...(bySide.get(key) ?? []), link]);
  }
  return [...bySide.values()]
    .map((of) => ({
      node: of[0].node,
      dir: of[0].dir as "tx" | "rx",
      hbs: [...new Set(of.map((l) => l.hb))].sort(),
      ...countsOf(of),
    }))
    .sort((a, b) => a.node.localeCompare(b.node) || (a.dir === b.dir ? 0 : a.dir === "tx" ? -1 : 1));
}
