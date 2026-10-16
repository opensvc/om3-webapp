import { describe, expect, test } from "vitest";
import { DIRECTION_OFFSET, MAX_LABEL, groupState, meshLayout, meshLinks, meshNodes, nodeLabel, nodeWidth } from "../heartbeat-mesh";

/** Two nodes beating each other on hb#1, n2 receiving nothing from n1 on hb#2. */
const STATUS = {
  n1: {
    streams: [
      { id: "hb#1.rx", type: "unicast", state: "running", peers: { n2: { is_beating: true, desc: ":10011 ← n2" } } },
      { id: "hb#1.tx", type: "unicast", state: "running", peers: { n2: { is_beating: true, desc: "→ n2:10011" } } },
    ],
  },
  n2: {
    streams: [
      { id: "hb#1.rx", type: "unicast", state: "running", peers: { n1: { is_beating: true } } },
      { id: "hb#1.tx", type: "unicast", state: "running", peers: { n1: { is_beating: true } } },
      { id: "hb#2.rx", type: "multicast", state: "running", peers: { n1: { is_beating: false } } },
      { id: "hb#relay.tx", type: "relay", state: "stopped", peers: { n1: { is_beating: true } } },
    ],
  },
};

describe("meshLinks", () => {
  test("a link per stream of each node toward each peer, from the sender to the receiver", () => {
    const links = meshLinks(STATUS);
    expect(links.map((l) => [l.node, l.hb, l.dir, l.from, l.to])).toEqual([
      ["n1", "hb#1", "rx", "n2", "n1"],
      ["n1", "hb#1", "tx", "n1", "n2"],
      ["n2", "hb#1", "rx", "n1", "n2"],
      ["n2", "hb#1", "tx", "n2", "n1"],
      ["n2", "hb#2", "rx", "n1", "n2"],
      ["n2", "hb#relay", "tx", "n2", "n1"],
    ]);
    expect(links[0]).toMatchObject({ type: "unicast", desc: ":10011 ← n2", state: "up" });
  });

  test("down when the peer does not beat, or the stream does not run", () => {
    const links = meshLinks(STATUS);
    expect(links.find((l) => l.hb === "hb#2")?.state).toBe("down");
    expect(links.find((l) => l.hb === "hb#relay")).toMatchObject({ state: "down", streamState: "stopped" });
  });

  test("a stream reporting no peer, as a stopped one, is down toward the peers of its heartbeat on its node", () => {
    const links = meshLinks({
      n1: { streams: [{ id: "hb#1.rx", state: "running", peers: { n2: { is_beating: true }, n3: { is_beating: true } } }] },
      n2: { streams: [] },
      n3: {
        streams: [
          { id: "hb#1.rx", state: "running", peers: { n1: { is_beating: true }, n2: { is_beating: true } } },
          { id: "hb#1.tx", type: "unicast", state: "stopped", peers: {} },
        ],
      },
    });
    expect(links.filter((l) => l.node === "n3" && l.dir === "tx").map((l) => [l.from, l.to, l.state, l.streamState])).toEqual([
      ["n3", "n1", "down", "stopped"],
      ["n3", "n2", "down", "stopped"],
    ]);
  });

  test("a stream reporting no peer, its heartbeat knowing none on its node, is toward every other node", () => {
    const links = meshLinks({ n1: { streams: [{ id: "hb#1.tx", state: "stopped" }] }, n2: { streams: [] } });
    expect(links.map((l) => [l.from, l.to, l.state])).toEqual([["n1", "n2", "down"]]);
  });

  test("the nodes: those reporting and their peers", () => {
    const links = meshLinks({ n1: { streams: [{ id: "hb#1.tx", state: "running", peers: { n3: { is_beating: true } } }] } });
    expect(meshNodes({ n1: {} }, links)).toEqual(["n1", "n3"]);
  });
});

describe("meshLayout", () => {
  test("two nodes face each other, a line each way holding the links of its direction", () => {
    const links = meshLinks(STATUS);
    const layout = meshLayout(["n1", "n2"], links);
    expect(layout.nodes.n1.y).toBe(layout.nodes.n2.y);
    expect(layout.nodes.n1.x).toBeLessThan(layout.nodes.n2.x);
    expect(layout.groups.map((g) => [g.from, g.to, g.links.map((l) => `${l.hb}.${l.dir}@${l.node}`)])).toEqual([
      // By heartbeat, the sender's tx before the receiver's rx.
      ["n1", "n2", ["hb#1.tx@n1", "hb#1.rx@n2", "hb#2.rx@n2"]],
      ["n2", "n1", ["hb#1.tx@n2", "hb#1.rx@n1", "hb#relay.tx@n2"]],
    ]);
  });

  test("the two directions run straight and parallel, one each side of the line between the nodes, each from its sender", () => {
    const layout = meshLayout(["n1", "n2"], meshLinks(STATUS));
    const [forward, backward] = layout.groups;
    const ends = (path: string) => {
      const [, x1, y1, x2, y2] = /^M (\S+) (\S+) L (\S+) (\S+)$/.exec(path)!.map(Number);
      return { x1, y1, x2, y2 };
    };
    const f = ends(forward.path);
    const b = ends(backward.path);
    // Horizontal like the line between the nodes: parallel to it and to each other.
    expect(f.y1).toBe(f.y2);
    expect(b.y1).toBe(b.y2);
    // On opposite sides of the centres' line, the offset apart.
    const y = layout.nodes.n1.y;
    expect(Math.sign(f.y1 - y)).toBe(-Math.sign(b.y1 - y));
    expect(Math.abs(f.y1 - b.y1)).toBeCloseTo(DIRECTION_OFFSET);
    // Each from its sender: n1 to n2 left to right, n2 to n1 right to left.
    expect(f.x1).toBeLessThan(f.x2);
    expect(b.x1).toBeGreaterThan(b.x2);
  });

  test("a line green when all its links beat, orange for a mix, red when none does", () => {
    const [forward, backward] = meshLayout(["n1", "n2"], meshLinks(STATUS)).groups;
    // n1 to n2: hb#1 from both ends beating, hb#2 rx on n2 not; n2 to n1: the relay stopped.
    expect([forward.state, backward.state]).toEqual(["warn", "warn"]);
    const up = { state: "up" } as ReturnType<typeof meshLinks>[number];
    const down = { state: "down" } as ReturnType<typeof meshLinks>[number];
    expect(groupState([up, up])).toBe("up");
    expect(groupState([up, down])).toBe("warn");
    expect(groupState([down, down])).toBe("down");
  });

  test("a node is a box as wide as its name, a long name cut, its end an ellipsis", () => {
    expect(nodeWidth("n1")).toBeLessThan(nodeWidth("a-node-with-a-much-longer-name"));
    const long = "node.with.a.very.long.fully.qualified.domain.name.example.com";
    expect(nodeLabel(long)).toHaveLength(MAX_LABEL);
    expect(nodeLabel(long).endsWith("…")).toBe(true);
    expect(nodeLabel("dev2n1")).toBe("dev2n1");
    expect(nodeWidth(long)).toBe(nodeWidth(nodeLabel(long)));
  });

  test("a line runs from the edge of the box of its sender to the edge of the box of its receiver", () => {
    const left = "a-rather-long-node-name-1";
    const right = "b";
    const status = {
      [left]: { streams: [{ id: "hb#1.tx", state: "running", peers: { [right]: { is_beating: true } } }] },
      [right]: { streams: [] },
    };
    const layout = meshLayout([left, right], meshLinks(status));
    const [, x1, , x2] = /^M (\S+) (\S+) L (\S+) (\S+)$/.exec(layout.groups[0].path)!.map(Number);
    const l = layout.nodes[left];
    const r = layout.nodes[right];
    expect(x1).toBeCloseTo(l.x + l.width / 2);
    expect(x2).toBeCloseTo(r.x - r.width / 2);
  });

  test("boxes of long names on the circle do not overlap", () => {
    const names = ["a", "b", "c", "d", "e"].map((c) => `${c}-node.long.domain.example`);
    const layout = meshLayout(names, []);
    const boxes = Object.values(layout.nodes);
    for (const [i, p] of boxes.entries()) {
      for (const q of boxes.slice(i + 1)) {
        const apart = Math.abs(p.x - q.x) >= (p.width + q.width) / 2 || Math.abs(p.y - q.y) >= (p.height + q.height) / 2;
        expect(apart).toBe(true);
      }
      expect(p.x - p.width / 2).toBeGreaterThanOrEqual(0);
      expect(p.x + p.width / 2).toBeLessThanOrEqual(layout.width);
    }
  });

  test("more nodes stand on a circle", () => {
    const layout = meshLayout(["a", "b", "c"], []);
    const centre = { x: layout.width / 2, y: layout.height / 2 };
    const distances = Object.values(layout.nodes).map((p) => Math.hypot(p.x - centre.x, p.y - centre.y));
    distances.forEach((d) => expect(d).toBeCloseTo(distances[0]));
  });
});
