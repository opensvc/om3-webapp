import { describe, expect, test } from "vitest";
import { servedSlots, slotCounts } from "../heartbeat-relays";

describe("the slots a relay holds", () => {
  const now = Date.parse("2026-10-30T10:00:30Z");
  const items = [
    { relay: "", cluster_name: "prod", nodename: "p2", node_addr: "10.0.0.2", updated_at: "2026-10-30T10:00:25Z" },
    { relay: "", cluster_name: "prod", nodename: "p1", node_addr: "10.0.0.1", updated_at: "2026-10-30T09:59:00Z" },
    { relay: "", cluster_id: "c2", nodename: "q1", updated_at: "2026-10-30T10:00:29Z" },
    { relay: "r", status: "unreachable" },
  ];

  test("by cluster then node, active within the timeout, stale past it; an item of no node left out", () => {
    expect(servedSlots(items, now).map((s) => [s.cluster, s.node, s.state])).toEqual([
      ["c2", "q1", "active"],
      ["prod", "p1", "stale"],
      ["prod", "p2", "active"],
    ]);
    expect(slotCounts(servedSlots(items, now))).toEqual({ active: 2, stale: 1 });
  });

  test("none held: relaying for no cluster", () => {
    expect(slotCounts(servedSlots([], now))).toEqual({ active: 0, stale: 0 });
  });
});
