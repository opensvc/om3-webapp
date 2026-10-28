import { describe, expect, test } from "vitest";
import { clusterFacts, collectorHost, type ClusterStatusPart } from "../cluster-facts";

const node = (agent: string, extra: Record<string, unknown> = {}) => ({
  status: { agent, is_leader: false, booted_at: "2026-10-20T10:00:00Z" },
  config: { env: "DEV" },
  daemon: { daemondata: { created_at: "2026-10-28T10:00:00Z" } },
  ...extra,
});

const STATUS: ClusterStatusPart = {
  cluster: {
    config: { id: "82e4", ca_sec_paths: ["system/sec/ca-former-20261014", "system/sec/ca-former-20260901"] },
    status: { is_compat: true },
    node: {
      n2: node("v3.0.1", {
        daemon: { collector: { state: "speaker-candidate", url: "http://oc3:8080" }, daemondata: { created_at: "2026-10-28T11:00:00Z" } },
        status: { agent: "v3.0.1", booted_at: "2026-10-18T10:00:00Z" },
      }),
      n1: node("v3.0.1", {
        daemon: { collector: { state: "speaker", url: "http://oc3:8080" }, daemondata: { created_at: "2026-10-28T10:00:00Z" } },
        status: { agent: "v3.0.1", is_leader: true, booted_at: "2026-10-23T10:00:00Z" },
      }),
      n3: node("v3.0.0", { daemon: { collector: { state: "warning", url: "unknown" } } }),
    },
  },
};

describe("clusterFacts", () => {
  test("the collector fed by its speaker, the nodes with client errors said", () => {
    expect(clusterFacts(STATUS).collector).toEqual({ state: "feeding", url: "http://oc3:8080", speaker: "n1", warnings: ["n3"] });
  });

  test("the speaker with errors, or none speaking: failing; no node configured: none", () => {
    const with_ = (states: string[]) => clusterFacts({
      cluster: { node: Object.fromEntries(states.map((state, i) => [`n${i + 1}`, { daemon: { collector: { state, url: "http://c:1" } } }])) },
    }).collector;
    expect(with_(["speaker-warning", "speaker-candidate"])).toEqual({ state: "failing", url: "http://c:1", speaker: "n1", warnings: ["n1"] });
    expect(with_(["warning", "speaker-candidate"]).state).toBe("failing");
    expect(with_(["disabled", "disabled"])).toEqual({ state: "none", warnings: [] });
    expect(clusterFacts({}).collector.state).toBe("none");
  });

  test("the agents by version, the most run first; the leader; the latest daemon start; the boots", () => {
    const facts = clusterFacts(STATUS);
    expect(facts.versions).toEqual([{ version: "v3.0.1", nodes: ["n1", "n2"] }, { version: "v3.0.0", nodes: ["n3"] }]);
    expect(facts.compat).toBe(true);
    expect(facts.leader).toBe("n1");
    expect(facts.daemonStart).toBe("2026-10-28T11:00:00.000Z");
    expect(facts.boots).toEqual(["2026-10-18T10:00:00.000Z", "2026-10-23T10:00:00.000Z"]);
  });

  test("the id, the environments each once, the former authorities and the day of the last rotation", () => {
    const facts = clusterFacts(STATUS);
    expect(facts.id).toBe("82e4");
    expect(facts.envs).toEqual(["DEV"]);
    expect(facts.ca).toEqual({ formers: 2, rotatedOn: "2026-10-14" });
    expect(clusterFacts({ cluster: { config: { ca_sec_paths: null } } }).ca).toBeUndefined();
  });

  test("a collector address, short", () => {
    expect(collectorHost("http://oc3.dev.svc:8080/feed")).toBe("oc3.dev.svc:8080");
    expect(collectorHost(undefined)).toBeUndefined();
  });
});
