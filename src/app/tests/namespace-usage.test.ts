import { describe, expect, test } from "vitest";
import {
  computeLimit,
  kindCounts,
  networkHoldings,
  networkUsage,
  parseClaims,
  parseCpuLimit,
  parseSize,
  poolHoldings,
  poolUsage,
} from "../namespace-usage";

describe("parseSize", () => {
  test.each([
    ["512", 512],
    ["512m", 512 * 2 ** 20],
    ["512mi", 512 * 2 ** 20],
    ["512MiB", 512 * 2 ** 20],
    ["512mb", 512e6],
    ["1,5g", 1.5 * 2 ** 30],
    ["20g", 20 * 2 ** 30],
  ])("%s, as om3 reads it, is %d bytes", (text, bytes) => {
    expect(parseSize(text)).toBe(bytes);
  });

  test("what is no size is undefined", () => {
    expect(parseSize("lots")).toBeUndefined();
    expect(parseSize(undefined)).toBeUndefined();
  });
});

describe("parseCpuLimit", () => {
  test.each([
    ["800%", 8],
    ["100%@8", 8],
    ["50%", 0.5],
  ])("%s is %d cpus", (text, cpus) => {
    expect(parseCpuLimit(text)).toBe(cpus);
  });

  test("@all, refused by a claim, is no limit", () => {
    expect(parseCpuLimit("50%@all")).toBeUndefined();
  });
});

describe("parseClaims", () => {
  test("the claim sections: type, name and limit in its unit; the scoped values and the other sections left out", () => {
    const claims = parseClaims(`[DEFAULT]
limit = 1g

[claim#1]
type = pool
name = rpo0
limit = 200m
limit@n1 = 1m

[claim#2]
type = network
name = default
limit = 10

[claim#3]
type = cpu
limit = 400%

[claim#4]
type = memory
limit = 16g

[claim#5]
type = gpu
limit = 2
`);
    expect(claims).toEqual([
      { type: "pool", name: "rpo0", limit: 200 * 2 ** 20 },
      { type: "network", name: "default", limit: 10 },
      { type: "cpu", name: undefined, limit: 4 },
      { type: "memory", name: undefined, limit: 16 * 2 ** 30 },
    ]);
    expect(computeLimit(claims, "cpu")).toBe(4);
    expect(computeLimit([], "memory")).toBeUndefined();
  });

  test("a claim without a limit caps nothing", () => {
    expect(parseClaims("[claim#1]\ntype = pool\nname = p\n")).toEqual([{ type: "pool", name: "p", limit: undefined }]);
  });
});

describe("usage", () => {
  const pools = [{ name: "default", size: 100 }, { name: "shm", size: 4 }];

  test("a pool claimed of counts out of its claim, one not out of its size, a claimed pool unused counts too", () => {
    const held = poolHoldings([
      { path: "ns1/vol/a", pool: "default", size: 10 },
      { path: "ns1/vol/b", pool: "default", size: 5 },
      { path: "ns1/vol/c", pool: "shm", size: 1 },
      { path: "ns2/vol/d", pool: "default", size: 50 },
      { path: "vol/e", pool: "shm", size: 2 },
    ]);
    const usage = poolUsage("ns1", held, [...pools, { name: "fast", size: 10 }], [
      { type: "pool", name: "default", limit: 20 },
      { type: "pool", name: "fast", limit: 8 },
    ]);
    expect(usage).toEqual({
      used: 16,
      total: 32,
      free: 16,
      segments: [
        { name: "default", used: 15, total: 20, claimed: true },
        { name: "fast", used: 0, total: 8, claimed: true },
        { name: "shm", used: 1, total: 4, claimed: false },
      ],
    });
    // A volume of a path in two parts is of the root namespace.
    expect(poolUsage("root", held, pools, []).used).toBe(2);
  });

  test("an address held on several nodes is one address", () => {
    const held = networkHoldings([
      { ip: "10.0.0.1", path: "ns1/svc/a", network: { name: "default" } },
      { ip: "10.0.0.1", path: "ns1/svc/a", network: { name: "default" } },
      { ip: "10.0.0.2", path: "ns1/svc/b", network: { name: "default" } },
    ]);
    expect(networkUsage("ns1", held, [{ name: "default", size: 256 }], [])).toEqual({
      used: 2,
      total: 256,
      free: 254,
      segments: [{ name: "default", used: 2, total: 256, claimed: false }],
    });
  });

  test("used over the limit leaves nothing free, not less", () => {
    const usage = poolUsage("ns1", poolHoldings([{ path: "ns1/vol/a", pool: "default", size: 30 }]), pools, [
      { type: "pool", name: "default", limit: 20 },
    ]);
    expect(usage.free).toBe(0);
  });
});

describe("kindCounts", () => {
  test("the services and volumes by availability, the secrets and configurations counted; the rest is a namespace only", () => {
    const counts = kindCounts({
      "ns1/svc/a": { avail: "up" },
      "ns1/svc/b": { avail: "stdby up" },
      "ns1/vol/c": { avail: "down" },
      "ns1/sec/d": { avail: "n/a" },
      "ns1/cfg/e": { avail: "n/a" },
      "ns1/usr/f": { avail: "n/a" },
      foo: { avail: "warn" },
      cluster: { avail: "n/a" },
    });
    expect(counts.get("ns1")).toEqual({ svc: { up: 1, "n/a": 1 }, vol: { down: 1 }, sec: 1, cfg: 1 });
    expect(counts.get("root")).toEqual({ svc: { warn: 1 }, vol: {}, sec: 0, cfg: 0 });
  });
});
