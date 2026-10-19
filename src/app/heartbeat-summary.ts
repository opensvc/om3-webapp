/*
 * What the heartbeat mesh says at a glance (HeartbeatSummary): how each heartbeat
 * and each driver fare over the cluster, and the layer of infrastructure they go
 * over. Read from the links of the mesh (meshLinks).
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

/** A heartbeat over the cluster: its links beating out of all of them. */
export interface HeartbeatSummaryRow {
  hb: string;
  type: string;
  layer: Layer;
  beating: number;
  total: number;
  state: GroupState;
}

const stateOf = (beating: number, total: number): GroupState =>
  beating === total ? "up" : beating === 0 ? "down" : "warn";

/** Each heartbeat, by its name, with its links beating out of all of them. */
export function heartbeatsOf(links: MeshLink[]): HeartbeatSummaryRow[] {
  const byHb = new Map<string, MeshLink[]>();
  for (const link of links) {
    byHb.set(link.hb, [...(byHb.get(link.hb) ?? []), link]);
  }
  return [...byHb.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hb, of]) => {
      const beating = of.filter((l) => l.state === "up").length;
      const type = of.find((l) => l.type)?.type ?? "";
      return { hb, type, layer: layerOf(type), beating, total: of.length, state: stateOf(beating, of.length) };
    });
}

/** A driver over the cluster: its heartbeats, their links beating out of all of them. */
export interface DriverSummaryRow {
  type: string;
  layer: Layer;
  hbs: string[];
  beating: number;
  total: number;
  state: GroupState;
}

/** Each driver, by its name, with its heartbeats and their links beating out of all of them. */
export function driversOf(links: MeshLink[]): DriverSummaryRow[] {
  const byType = new Map<string, MeshLink[]>();
  for (const link of links) {
    byType.set(link.type, [...(byType.get(link.type) ?? []), link]);
  }
  return [...byType.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, of]) => {
      const beating = of.filter((l) => l.state === "up").length;
      return {
        type,
        layer: layerOf(type),
        hbs: [...new Set(of.map((l) => l.hb))].sort(),
        beating,
        total: of.length,
        state: stateOf(beating, of.length),
      };
    });
}
