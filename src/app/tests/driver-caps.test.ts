import { describe, expect, test } from "vitest";
import { driverCap, driverRows, nodeTools, nodesLacking } from "../driver-caps";

describe("the capability of a driver", () => {
  test("a resource driver's under drivers.resource, another's under drivers, as om names them", () => {
    expect(driverCap("fs.ext4")).toBe("drivers.resource.fs.ext4");
    expect(driverCap("sync.store")).toBe("drivers.resource.sync.store");
    expect(driverCap("volume")).toBe("drivers.resource.volume");
    expect(driverCap("pool.directory")).toBe("drivers.pool.directory");
    expect(driverCap("hb.unicast")).toBe("drivers.hb.unicast");
    expect(driverCap("store.tar")).toBe("drivers.store.tar");
  });
});

describe("the drivers of a node", () => {
  const caps = [
    "drivers.resource.container.kvm",
    "drivers.resource.container.kvm.hvm",
    "drivers.resource.container.kvm.partitions",
    "drivers.pool.directory",
    "drivers.resource.volume",
    "node.x.systemd",
    "node.x.scsi.sg_persist",
  ];

  test("each usable when the node holds its capability, by group then name, its features beside it", () => {
    expect(driverRows(["pool.rados", "volume", "container.kvm", "pool.directory", "container.podman"], caps)).toEqual([
      { id: "container.kvm", group: "container", name: "kvm", usable: true, features: ["hvm", "partitions"] },
      { id: "container.podman", group: "container", name: "podman", usable: false, features: [] },
      { id: "pool.directory", group: "pool", name: "directory", usable: true, features: [] },
      { id: "pool.rados", group: "pool", name: "rados", usable: false, features: [] },
      { id: "volume", group: "volume", name: "", usable: true, features: [] },
    ]);
  });

  test("a driver whose name begins another's takes none of its features", () => {
    const rows = driverRows(["container.kvm", "container.kv"], ["drivers.resource.container.kvm", "drivers.resource.container.kv"]);
    expect(rows.find((r) => r.id === "container.kv")?.features).toEqual([]);
  });

  test("the tools of the node, from its node.x capabilities", () => {
    expect(nodeTools(caps)).toEqual(["scsi.sg_persist", "systemd"]);
  });
});

describe("the nodes lacking a driver", () => {
  test("those read that lack its capability; a node not read is not said lacking it", () => {
    const byNode = {
      n1: ["drivers.pool.directory", "drivers.pool.zpool"],
      n2: ["drivers.pool.directory"],
      n3: undefined,
    };
    expect(nodesLacking(byNode, "pool.zpool")).toEqual(["n2"]);
    expect(nodesLacking(byNode, "pool.directory")).toEqual([]);
    expect(nodesLacking(byNode, "pool.rados")).toEqual(["n1", "n2"]);
  });
});
