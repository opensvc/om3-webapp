import { describe, expect, test } from "vitest";
import { DEFAULT_TIMEOUT_MS, relayHeartbeats, relayState, relayView } from "../heartbeat-relays";

describe("the relay heartbeats of the configuration", () => {
  test("those of type relay, their relay, their timeout evaluated in ms, the default when none", () => {
    expect(
      relayHeartbeats([
        { keyword: "hb#1.type", evaluated: "unicast" },
        { keyword: "hb#1.timeout", evaluated: 15e9 },
        { keyword: "hb#relay.type", evaluated: "relay" },
        { keyword: "hb#relay.relay", evaluated: "relay3.opensvc.com:3333" },
        { keyword: "hb#relay.timeout", evaluated: 30e9 },
        { keyword: "hb#r2.type", value: "relay" },
        { keyword: "hb#r2.relay", value: "relay4:3333" },
        // A relay heartbeat with no relay set: none to ask.
        { keyword: "hb#r3.type", evaluated: "relay" },
      ]),
    ).toEqual([
      { section: "hb#r2", relay: "relay4:3333", timeoutMs: DEFAULT_TIMEOUT_MS },
      { section: "hb#relay", relay: "relay3.opensvc.com:3333", timeoutMs: 30_000 },
    ]);
  });
});

describe("what a relay says of the cluster", () => {
  const now = Date.parse("2026-10-26T13:00:30Z");
  const slot = (nodename: string, at: string, extra = {}) => ({
    relay: "relay3",
    cluster_id: "c1",
    nodename,
    node_addr: `10.0.0.1:${nodename.length}`,
    msg_len: 1116,
    updated_at: at,
    ...extra,
  });

  test("a row per node of the cluster, in its order: writing within the timeout, stale beyond, missing without a slot", () => {
    const view = relayView(
      [slot("n2", "2026-10-26T13:00:25Z"), slot("n1", "2026-10-26T13:00:00Z")],
      ["n1", "n2", "n3"],
      15_000,
      now,
      "c1",
    );
    expect(view.error).toBeUndefined();
    expect(view.rows.map((r) => [r.node, r.state, r.ageMs])).toEqual([
      ["n1", "stale", 30_000],
      ["n2", "up", 5_000],
      ["n3", "missing", undefined],
    ]);
    expect(view.rows[1]).toMatchObject({ addr: "10.0.0.1:2", msgLen: 1116, updatedAt: "2026-10-26T13:00:25Z" });
    expect(relayState(view)).toBe("warn");
  });

  test("the relay not reached: its reason, no row, down", () => {
    const view = relayView(
      [{ relay: "relay3:3333", cluster_id: "c1", username: "dev3", status: "dial tcp: connection refused" }],
      ["n1"],
      15_000,
      now,
    );
    expect(view).toEqual({ error: "dial tcp: connection refused", rows: [] });
    expect(relayState(view)).toBe("down");
  });

  test("a slot of another cluster sharing the username left out; a node the cluster does not name, after its nodes", () => {
    const view = relayView(
      [slot("n1", "2026-10-26T13:00:29Z"), slot("n1", "2026-10-26T13:00:29Z", { cluster_id: "c2", node_addr: "x" }), slot("n9", "2026-10-26T13:00:29Z")],
      ["n1"],
      15_000,
      now,
      "c1",
    );
    expect(view.rows.map((r) => [r.node, r.state, r.addr])).toEqual([
      ["n1", "up", "10.0.0.1:2"],
      ["n9", "up", "10.0.0.1:2"],
    ]);
    expect(relayState(view)).toBe("up");
  });

  test("two slots of a node, written from two addresses: the latest", () => {
    const view = relayView(
      [slot("n1", "2026-10-26T13:00:01Z", { node_addr: "old" }), slot("n1", "2026-10-26T13:00:29Z", { node_addr: "new" })],
      ["n1"],
      15_000,
      now,
    );
    expect(view.rows).toHaveLength(1);
    expect(view.rows[0].addr).toBe("new");
  });

  test("no node writing: down", () => {
    expect(relayState(relayView([], ["n1", "n2"], 15_000, now))).toBe("down");
  });
});
