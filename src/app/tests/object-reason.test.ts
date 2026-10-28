import { describe, expect, test } from "vitest";
import { cachedReason, objectReason, type ObjectEvents } from "../object-reason";
import dns from "./fixtures/system-svc-dns.json";

/** What the stream holds of an object, from its data as the api reads it. */
function eventsOf(data: Record<string, unknown>): ObjectEvents {
  const { instances = {}, ...object } = data as { instances?: Record<string, Record<string, Record<string, unknown>>> };
  const by = (key: string) => Object.fromEntries(Object.entries(instances).map(([node, i]) => [node, i[key]]));
  return { object, instances: by("status"), monitors: by("monitor"), configs: by("config") };
}

describe("why an object is not up", () => {
  test("its first note, errors first, as its status board says it", () => {
    expect(objectReason("system/svc/dns", eventsOf(dns))).toEqual({
      level: "error",
      text: "start failed: the orchestration gave up, clear the instance to retry",
      more: 0,
    });
  });

  test("an object up, or of no status: none", () => {
    expect(objectReason("system/svc/dns", { ...eventsOf(dns), object: { ...eventsOf(dns).object, avail: "up", overall: "up" } })).toBeNull();
    expect(objectReason("system/cfg/c", { object: undefined, instances: undefined, monitors: {}, configs: undefined })).toBeNull();
  });

  test("no note: its resources down, three at most, not the optional ones", () => {
    const status = (resources: Record<string, unknown>) => ({ avail: "down", overall: "down", resources });
    const events: ObjectEvents = {
      object: { avail: "down", overall: "down", topology: "failover", orchestrate: "no" },
      instances: {
        n1: status({ "container#1": { status: "down" }, "fs#1": { status: "down", optional: true }, "app#1": { status: "up" } }),
        n2: status({ "container#1": { status: "down" }, "container#2": { status: "down" } }),
      },
      monitors: {},
      configs: undefined,
    };
    // Monitors never updated: a note says so, before the resources.
    expect(objectReason("root/svc/encap", events)?.text).toMatch(/^no instance monitor/);
    const monitored = { ...events, monitors: { n1: { state: "idle", updated_at: "2026-10-28T10:00:00Z" }, n2: { state: "idle", updated_at: "2026-10-28T10:00:00Z" } } };
    expect(objectReason("root/svc/encap", monitored)).toEqual({ level: "error", text: "container#1, container#2 down", more: 0 });
    const many = {
      ...monitored,
      instances: { n1: status(Object.fromEntries(["a#1", "b#1", "c#1", "d#1"].map((rid) => [rid, { status: "down" }]))) },
    };
    expect(objectReason("root/svc/many", many)?.text).toBe("a#1, b#1, c#1… down");
  });

  test("infos only: stopped on purpose first, then the resources down, then a freeze, said so", () => {
    const at = "2026-10-28T10:00:00Z";
    const events = (resources: Record<string, unknown>, stopped: boolean): ObjectEvents => ({
      object: { avail: "down", overall: "down", topology: "failover", orchestrate: "ha" },
      instances: { n1: { avail: "down", overall: "down", frozen_at: at, resources, ...(stopped ? { stopped_at: at } : {}) } },
      monitors: { n1: { state: "idle", updated_at: at } },
      configs: undefined,
    });
    expect(objectReason("root/svc/s", events({ "fs#1": { status: "down" } }, true))?.text).toMatch(/^stopped on purpose/);
    expect(objectReason("root/svc/s", events({ "fs#1": { status: "down" } }, false))?.text).toBe("fs#1 down");
    expect(objectReason("root/svc/s", events({}, false))).toEqual({
      level: "info",
      text: "frozen: the daemon takes no initiative on the instance",
      more: 0,
    });
  });

  test("kept while what it is read from does not change", () => {
    const events = eventsOf(dns);
    const first = cachedReason("system/svc/dns", events);
    expect(cachedReason("system/svc/dns", { ...events })).toBe(first);
    expect(cachedReason("system/svc/dns", { ...events, object: { ...events.object } })).not.toBe(first);
  });
});
