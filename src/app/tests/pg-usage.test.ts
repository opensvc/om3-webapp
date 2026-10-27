import { describe, expect, test } from "vitest";
import { detailsUsage, namespaceUsage, namespacesUsage, nodeUsage, objectUsage, opensvcUsage, readPg, readPgScopes, sumUsage } from "../pg-usage";
import { namespaceOf } from "../namespace-usage";

const page = `# HELP opensvc_pg_cgroup_cpu_usage_usec cpu
opensvc_pg_cgroup_exists{namespace="prod",path="prod/svc/web"} 1
opensvc_pg_cgroup_cpu_usage_usec{namespace="prod",path="prod/svc/web"} 1000000
opensvc_pg_cgroup_memory_current_bytes{namespace="prod",path="prod/svc/web"} 2048
opensvc_pg_cgroup_memory_max_bytes{namespace="prod",path="prod/svc/web"} +Inf
opensvc_pg_cgroup_exists{namespace="prod",path="prod/svc/gone"} 0
opensvc_pg_cgroup_cpu_weight{namespace="prod",path="prod/svc/gone"} 100
opensvc_pg_cgroup_memory_current_bytes{namespace="root",path="svc/dns"} 1024
opensvc_pg_cgroups 3
`;

describe("readPg", () => {
  test("the objects with a cgroup on the node; one known without, the summaries, left out", () => {
    expect(readPg(page)).toEqual({
      "prod/svc/web": { namespace: "prod", cpuUsageUsec: 1000000, memoryCurrent: 2048, memoryMax: Infinity },
      "svc/dns": { namespace: "root", memoryCurrent: 1024 },
    });
  });
});

describe("readPgScopes", () => {
  const scoped = `opensvc_pg_cgroup_exists{namespace="",path="",scope="opensvc"} 1
opensvc_pg_cgroup_cpu_usage_usec{namespace="",path="",scope="opensvc"} 9000000
opensvc_pg_cgroup_memory_current_bytes{namespace="",path="",scope="opensvc"} 4096
opensvc_pg_cgroup_memory_max_bytes{namespace="",path="",scope="opensvc"} +Inf
opensvc_pg_cgroup_memory_current_bytes{namespace="prod",path="",scope="namespace"} 3000
opensvc_pg_cgroup_exists{namespace="prod",path="prod/svc/web",scope="object"} 1
opensvc_pg_cgroup_memory_current_bytes{namespace="prod",path="prod/svc/web",scope="object"} 2048
opensvc_pg_cgroup_cpu_cpus{namespace="",path="",scope="host"} 8
opensvc_pg_cgroup_memory_current_bytes{namespace="",path="",scope="host"} 9000
opensvc_pg_cgroup_memory_max_bytes{namespace="",path="",scope="host"} 16000
opensvc_pg_cgroup_exists{namespace="",path="system.slice",scope="slice"} 1
opensvc_pg_cgroup_memory_current_bytes{namespace="",path="system.slice",scope="slice"} 500
opensvc_pg_cgroup_exists{namespace="",path="gone.slice",scope="slice"} 0
`;

  test("the objects by path; the opensvc slice, the namespace slices, the host and the other slices apart, a slice not there left out", () => {
    expect(readPgScopes(scoped)).toEqual({
      byPath: { "prod/svc/web": { namespace: "prod", memoryCurrent: 2048 } },
      opensvc: { namespace: "", cpuUsageUsec: 9000000, memoryCurrent: 4096, memoryMax: Infinity },
      namespaces: { prod: { namespace: "prod", memoryCurrent: 3000 } },
      host: { namespace: "", cpus: 8, memoryCurrent: 9000, memoryMax: 16000 },
      slices: { "system.slice": { namespace: "", memoryCurrent: 500 } },
    });
    expect(readPg(scoped)).toEqual({ "prod/svc/web": { namespace: "prod", memoryCurrent: 2048 } });
  });

  test("not told, or not there: no opensvc slice", () => {
    expect(readPgScopes(page).opensvc).toBeUndefined();
    expect(readPgScopes(`opensvc_pg_cgroup_exists{namespace="",path="",scope="opensvc"} 0\n`).opensvc).toBeUndefined();
  });

  test("its cpu between two readings, in cpus; its memory; nothing when not told", () => {
    const at = (ms: number, usec: number) => ({ at: ms, byPath: {}, opensvc: { namespace: "", cpuUsageUsec: usec, memoryCurrent: 10 } });
    expect(opensvcUsage(undefined, at(0, 0))).toEqual({ cpu: null, memory: 10, limit: undefined });
    expect(opensvcUsage(at(0, 0), at(16000, 32000000))?.cpu).toBeCloseTo(2);
    expect(opensvcUsage(at(0, 0), { at: 16000, byPath: {} })).toBeUndefined();
  });
});

describe("the groups in the slice of an object asked for", () => {
  const detailed = `opensvc_pg_cgroup_memory_current_bytes{namespace="dev",path="dev/svc/oc3",rid="",scope="object",subset=""} 3000
opensvc_pg_cgroup_memory_current_bytes{namespace="dev",path="dev/svc/oc3",rid="",scope="subset",subset="data"} 1000
opensvc_pg_cgroup_memory_current_bytes{namespace="dev",path="dev/svc/oc3",rid="container#db",scope="resource",subset="data"} 900
opensvc_pg_cgroup_memory_current_bytes{namespace="dev",path="dev/svc/oc3",rid="ip#0",scope="resource",subset=""} 10
opensvc_pg_cgroup_exists{namespace="dev",path="dev/svc/oc3",rid="fs#9",scope="resource",subset=""} 0
`;

  test("its subsets and resources apart from the object, a group not there left out; the object's own figures untouched", () => {
    const reading = readPgScopes(detailed);
    expect(reading.byPath).toEqual({ "dev/svc/oc3": { namespace: "dev", memoryCurrent: 3000 } });
    expect(reading.details).toEqual({
      "dev/svc/oc3": {
        subsets: { data: { namespace: "dev", memoryCurrent: 1000 } },
        resources: {
          "container#db": { subset: "data", sample: { namespace: "dev", memoryCurrent: 900 } },
          "ip#0": { subset: "", sample: { namespace: "dev", memoryCurrent: 10 } },
        },
      },
    });
    expect(detailsUsage(undefined, { at: 0, ...reading })["dev/svc/oc3"].resources["ip#0"]).toEqual({
      subset: "",
      sample: { cpu: null, memory: 10, limit: undefined },
    });
  });
});

describe("io and tasks", () => {
  const page = (read: number, write: number, tasks: number) => `opensvc_pg_cgroup_cpu_usage_usec{namespace="prod",path="prod/svc/web",scope="object"} 0
opensvc_pg_cgroup_io_read_bytes{namespace="prod",path="prod/svc/web",scope="object"} ${read}
opensvc_pg_cgroup_io_write_bytes{namespace="prod",path="prod/svc/web",scope="object"} ${write}
opensvc_pg_cgroup_tasks{namespace="prod",path="prod/svc/web",scope="object"} ${tasks}
`;
  const at = (ms: number, text: string) => ({ at: ms, byPath: readPg(text) });

  test("the bytes read and written a second from a second reading on, the tasks at once", () => {
    expect(nodeUsage(undefined, at(0, page(0, 0, 3)))["prod/svc/web"]).toEqual({ cpu: null, read: null, write: null, tasks: 3, memory: undefined, limit: undefined });
    const u = nodeUsage(at(0, page(0, 0, 3)), at(16000, page(1600, 16000, 4)))["prod/svc/web"];
    expect(u.read).toBeCloseTo(100);
    expect(u.write).toBeCloseTo(1000);
    expect(u.tasks).toBe(4);
  });

  test("not told: no io nor tasks; summed where told, a rate waiting for its second reading waiting", () => {
    expect(nodeUsage(undefined, { at: 0, byPath: readPg('opensvc_pg_cgroup_memory_current_bytes{namespace="p",path="p/svc/a"} 1') })["p/svc/a"]).toEqual({ cpu: null, memory: 1, limit: undefined });
    expect(sumUsage([{ cpu: 1, read: 10, tasks: 2 }, { cpu: 1, read: 5, tasks: 1 }, { cpu: 1 }])).toEqual({ cpu: 3, memory: undefined, limit: undefined, read: 15, tasks: 3 });
    expect(sumUsage([{ cpu: 1, read: 10 }, { cpu: null, read: null }]).read).toBeNull();
  });
});

describe("nodeUsage", () => {
  const at = (ms: number, usec: number) => ({ at: ms, byPath: { "prod/svc/web": { namespace: "prod", cpuUsageUsec: usec, memoryCurrent: 1 } } });

  test("the cpu used between two readings, in cpus; none on the first one", () => {
    expect(nodeUsage(undefined, at(0, 0))["prod/svc/web"]).toEqual({ cpu: null, memory: 1, limit: undefined });
    // Two seconds of cpu over sixteen: an eighth of a cpu.
    expect(nodeUsage(at(0, 0), at(16000, 2000000))["prod/svc/web"].cpu).toBeCloseTo(0.125);
  });

  test("a counter gone back, a cgroup recreated: no rate this time", () => {
    expect(nodeUsage(at(0, 5000000), at(16000, 1000))["prod/svc/web"].cpu).toBeNull();
  });
});

describe("sums", () => {
  test("the cpus told, the memories, the limits; unlimited if one is", () => {
    expect(sumUsage([{ cpu: 0.5, memory: 10, limit: 100 }, { cpu: null, memory: 5, limit: Infinity }])).toEqual({
      cpu: 0.5,
      memory: 15,
      limit: Infinity,
    });
    expect(sumUsage([{ cpu: null }, { cpu: null }])).toEqual({ cpu: null, memory: undefined, limit: undefined });
  });

  const usage = {
    n2: { "prod/svc/web": { cpu: 0.25, memory: 20, limit: 100 } },
    n1: {
      "prod/svc/web": { cpu: 0.5, memory: 10, limit: 100 },
      "prod/svc/db": { cpu: 1, memory: 5 },
      "svc/dns": { cpu: 0.1, memory: 1 },
    },
  };

  test("an object: its instances in the order of the nodes, and their sum", () => {
    expect(objectUsage(usage, "prod/svc/web")).toEqual({
      path: "prod/svc/web",
      instances: [
        { node: "n1", cpu: 0.5, memory: 10, limit: 100 },
        { node: "n2", cpu: 0.25, memory: 20, limit: 100 },
      ],
      cpu: 0.75,
      memory: 30,
      limit: 200,
    });
    expect(objectUsage(usage, "prod/svc/none")).toEqual({ path: "prod/svc/none", instances: [], cpu: null, memory: undefined, limit: undefined });
  });

  test("a namespace: its objects summed over the nodes, and their sum; root's short paths its own", () => {
    const prod = namespaceUsage(usage, namespaceOf, "prod");
    expect(prod.objects.map((o) => o.path)).toEqual(["prod/svc/db", "prod/svc/web"]);
    expect(prod.cpu).toBeCloseTo(1.75);
    expect(prod.memory).toBe(35);
    const all = namespacesUsage(usage, namespaceOf);
    expect(Object.keys(all).sort()).toEqual(["prod", "root"]);
    expect(all.root).toEqual({ cpu: 0.1, memory: 1, limit: undefined });
  });
});
