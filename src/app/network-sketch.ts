/*
 * The sketch of a network: its range in a band over the nodes of the cluster, a box
 * for each node saying what the network is on it, the objects holding addresses of it
 * on each node under its box. What each type puts on a node, from its section of the
 * cluster configuration:
 *
 * - routed_bridge: a subnet of the range a node, on a bridge, routed between the
 *   nodes, through tunnels from an endpoint of each node;
 * - bridge: the same range on every node, on a bridge, masqueraded out of the node;
 * - lan: a segment the nodes share, joined through an interface of each node.
 *
 * An address is one whatever the nodes reporting it: those of an object reported by
 * several nodes, a lan address its instances share say, are drawn once, a pill across
 * the columns of all the nodes, solid over those reporting them, dashed over the
 * others; the others under the box of the one node holding them.
 *
 * The layout is made here, without a browser: the width of a text is estimated.
 */

/** The keys of the section, `key` or `key@node`, and their values. */
export type SectionValues = Record<string, string>;

export interface SketchAddress {
  ip?: string;
  node?: string;
  path?: string;
  rid?: string;
}

export interface SketchInput {
  name: string;
  type: string;
  network: string;
  values: SectionValues;
  nodes: string[];
  addresses: SketchAddress[];
}

/** A fact of a box: a keyword, its value; `computed`, the daemon deciding it, none set. */
export interface SketchFact {
  key: string;
  value: string;
  computed?: boolean;
}

export interface SketchNode {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  facts: SketchFact[];
  /** The addresses of the network held on the node alone. */
  count: number;
  /** The addresses of the network the node reports with others. */
  shared: number;
  /** The line from the band down to the box. */
  drop: { x: number; y1: number; y2: number };
}

export interface SketchObject {
  node: string;
  path: string;
  count: number;
  x: number;
  y: number;
  width: number;
}

/** A stretch of a shared pill over the column of a node: solid where the node reports the addresses. */
export interface SketchSegment {
  node: string;
  x1: number;
  x2: number;
  present: boolean;
}

/** An object of addresses reported by several nodes, a pill across the columns; `nodes`, those reporting them. */
export interface SketchShared {
  path: string;
  count: number;
  nodes: string[];
  x: number;
  y: number;
  width: number;
  segments: SketchSegment[];
}

export interface SketchLayout {
  width: number;
  height: number;
  band: {
    x: number;
    y: number;
    width: number;
    height: number;
    facts: SketchFact[];
  };
  nodes: SketchNode[];
  /**
   * The routes between the nodes of a routed bridge: a line across the row of the
   * boxes, under them, past the first and the last, its label after the last; a pipe of
   * two lines, `tunnel`, the routes through tunnels (`tunnel` not `never`).
   */
  route: { x1: number; x2: number; y: number; tunnel: boolean; labelX: number } | null;
  objects: SketchObject[];
  /** The objects left out under a node, too many to show. */
  more: { node: string; count: number; x: number; y: number }[];
  /** The addresses reported by several nodes: their count, their objects as pills, those left out. */
  shared: { count: number; rows: SketchShared[]; more: { count: number; x: number; y: number } | null } | null;
}

/** The width of a character, estimated: of a label, of a value in the monospaced font, of a bold title. */
export const CHAR_WIDTH = 6.6;
export const MONO_WIDTH = 8;
const BOLD_WIDTH = 7.6;
export const LINE = 16;
export const PADDING = 12;
export const CHIP_HEIGHT = 22;
const CHIP_GAP = 6;
const MARGIN = 8;
const GAP = 32;
const DROP = 36;
const MIN_NODE_WIDTH = 180;
/** How far the route runs past the first and the last box; its label after it. */
const ROUTE_STUB = 20;
const ROUTE_LABEL_GAP = 6;
/** The objects shown under a node; the others counted. */
export const MAX_OBJECTS = 5;
/** The objects of shared addresses shown in the band; the others counted. */
export const MAX_SHARED = 12;

/** The value of a key on a node: scoped to it, or set for all. */
const scoped = (values: SectionValues, key: string, node: string): string | undefined =>
  values[`${key}@${node}`] ?? values[key];

/** What the network is over all the nodes, its band. */
export function bandFacts({ type, network, values }: Pick<SketchInput, "type" | "network" | "values">): SketchFact[] {
  const facts: SketchFact[] = [{ key: "network", value: network }];
  const add = (key: string) => {
    if (values[key]) facts.push({ key, value: values[key] });
  };
  if (type === "routed_bridge") ["tunnel", "tunnel_mode", "ips_per_node", "mask_per_node"].forEach(add);
  if (type === "lan") ["ranges", "gateway", "modes"].forEach(add);
  if (type === "bridge") add("public");
  add("dns");
  return facts;
}

/** What the network is on a node, its box. */
export function nodeFacts({ name, type, values }: Pick<SketchInput, "name" | "type" | "values">, node: string): SketchFact[] {
  const facts: SketchFact[] = [];
  const set = (key: string, value: string | undefined) => {
    if (value) facts.push({ key, value });
  };
  // The bridge of a node, `obr_<network>` unless named.
  const bridge = values.dev || `obr_${name}`;
  if (type === "routed_bridge") {
    const subnet = scoped(values, "subnet", node);
    facts.push(subnet ? { key: "subnet", value: subnet } : { key: "subnet", value: "", computed: true });
    set("dev", bridge);
    set("addr", scoped(values, "addr", node));
    set("gateway", values[`gateway@${node}`]);
  } else if (type === "bridge") {
    set("network", values[`network@${node}`]);
    set("dev", bridge);
  } else if (type === "lan") {
    set("dev", scoped(values, "dev", node));
    set("gateway", values[`gateway@${node}`]);
    set("vlan_tag", scoped(values, "vlan_tag", node));
  }
  return facts;
}

const factWidth = (f: SketchFact, computedText: number) =>
  (f.key.length + 1) * CHAR_WIDTH + (f.computed ? computedText : f.value.length * MONO_WIDTH);

/**
 * The layout of the sketch. `computedText`, the width of the words saying a value is
 * the daemon's, `routeText`, of the label of the routes, both translated by the page.
 */
export function sketchLayout(input: SketchInput, computedText = 120, routeText = 90): SketchLayout {
  const { nodes, addresses } = input;
  const facts = Object.fromEntries(nodes.map((node) => [node, nodeFacts(input, node)]));

  // An address by what it is, its object, resource and ip, and the nodes reporting it.
  const reported = new Map<string, { path: string; nodes: Set<string> }>();
  for (const a of addresses) {
    if (!a.node || !nodes.includes(a.node)) continue;
    const key = `${a.path ?? ""} ${a.rid ?? ""} ${a.ip ?? ""}`;
    const one = reported.get(key) ?? { path: a.path ?? "", nodes: new Set<string>() };
    one.nodes.add(a.node);
    reported.set(key, one);
  }
  // Held on one node, under its box; on several, in the band, once.
  const byNode: Record<string, Map<string, number>> = {};
  const sharedByPath = new Map<string, { count: number; nodes: Set<string> }>();
  const sharedOn: Record<string, number> = {};
  let sharedCount = 0;
  for (const { path, nodes: on } of reported.values()) {
    if (on.size === 1) {
      const [node] = on;
      const paths = (byNode[node] ??= new Map());
      paths.set(path, (paths.get(path) ?? 0) + 1);
      continue;
    }
    sharedCount += 1;
    const one = sharedByPath.get(path) ?? { count: 0, nodes: new Set<string>() };
    one.count += 1;
    on.forEach((n) => {
      one.nodes.add(n);
      sharedOn[n] = (sharedOn[n] ?? 0) + 1;
    });
    sharedByPath.set(path, one);
  }
  const busiest = (a: { path: string; count: number }, b: { path: string; count: number }) =>
    b.count - a.count || a.path.localeCompare(b.path);
  const objectsOf = (node: string) =>
    [...(byNode[node]?.entries() ?? [])].map(([path, count]) => ({ path, count })).sort(busiest);
  const shared = [...sharedByPath.entries()]
    .map(([path, one]) => ({ path, count: one.count, nodes: nodes.filter((n) => one.nodes.has(n)) }))
    .sort(busiest);

  const widthOf = (node: string) =>
    Math.max(
      MIN_NODE_WIDTH,
      Math.round(node.length * BOLD_WIDTH + 2 * PADDING),
      ...facts[node].map((f) => Math.round(factWidth(f, computedText) + 2 * PADDING)),
      ...objectsOf(node).slice(0, MAX_OBJECTS).map((o) => Math.round((o.path.length + 6) * CHAR_WIDTH + 2 * PADDING)),
    );
  const widths = nodes.map(widthOf);
  const rowWidth = widths.reduce((sum, w) => sum + w, 0) + GAP * Math.max(0, nodes.length - 1);

  const band = bandFacts(input);
  const title = (input.name.length + input.type.length + 3) * BOLD_WIDTH;
  const bandText = Math.max(title, ...band.map((f) => factWidth(f, computedText))) + 2 * PADDING;
  // A pill as long as its label at least: the row of the nodes widened for the longest.
  const shownShared = shared.slice(0, MAX_SHARED);
  const pillText = Math.max(0, ...shownShared.map((o) => Math.round((o.path.length + 8) * CHAR_WIDTH + 2 * PADDING)));
  const extra = Math.max(0, pillText - rowWidth);
  const fullRow = rowWidth + extra;
  // A routed bridge of nodes to route between: its line past the boxes, its label after them.
  const routed = input.type === "routed_bridge" && nodes.length > 1;
  const routeLeft = routed ? ROUTE_STUB : 0;
  const routeRight = routed ? ROUTE_STUB + ROUTE_LABEL_GAP + routeText : 0;
  const width = Math.round(Math.max(fullRow + routeLeft + routeRight, bandText, MIN_NODE_WIDTH) + 2 * MARGIN);
  const bandHeight = PADDING * 2 + LINE * (band.length + 1);
  const bandBox = { x: MARGIN, y: MARGIN, width: width - 2 * MARGIN, height: bandHeight, facts: band };

  // The boxes as high as the fullest: the name, its facts, its count of addresses, its count of shared ones.
  const lines = Math.max(0, ...nodes.map((n) => facts[n].length)) + (sharedCount > 0 ? 1 : 0);
  const boxHeight = PADDING * 2 + LINE * (lines + 2);
  const top = bandBox.y + bandHeight + DROP;
  // The boxes widened evenly when a pill asks for more room than they take.
  const grow = nodes.length > 0 ? extra / nodes.length : 0;
  let x = MARGIN + routeLeft + (width - 2 * MARGIN - fullRow - routeLeft - routeRight) / 2;
  const sketchNodes: SketchNode[] = [];
  nodes.forEach((node, i) => {
    const w = widths[i] + grow;
    const own = objectsOf(node);
    sketchNodes.push({
      name: node,
      x,
      y: top,
      width: w,
      height: boxHeight,
      facts: facts[node],
      count: own.reduce((sum, o) => sum + o.count, 0),
      shared: sharedOn[node] ?? 0,
      drop: { x: x + w / 2, y1: bandBox.y + bandHeight, y2: top },
    });
    x += w + GAP;
  });

  // Under the boxes, the shared addresses first, a pill an object across all the columns,
  // its stretch over a column changing halfway into the gap to the next.
  let y = top + boxHeight + CHIP_GAP * 2;
  let sharedBlock: SketchLayout["shared"] = null;
  if (shared.length > 0 && sketchNodes.length > 0) {
    const first = sketchNodes[0];
    const last = sketchNodes[sketchNodes.length - 1];
    const bounds = sketchNodes.map((n, i) => [
      i === 0 ? n.x : (sketchNodes[i - 1].x + sketchNodes[i - 1].width + n.x) / 2,
      i === sketchNodes.length - 1 ? n.x + n.width : (n.x + n.width + sketchNodes[i + 1].x) / 2,
    ]);
    const rows = shownShared.map((o) => {
      const row = {
        ...o,
        x: first.x,
        y,
        width: last.x + last.width - first.x,
        segments: sketchNodes.map((n, i) => ({ node: n.name, x1: bounds[i][0], x2: bounds[i][1], present: o.nodes.includes(n.name) })),
      };
      y += CHIP_HEIGHT + CHIP_GAP;
      return row;
    });
    const left = shared.length - shownShared.length;
    sharedBlock = { count: sharedCount, rows, more: left > 0 ? { count: left, x: first.x + (last.x + last.width - first.x) / 2, y: y + LINE / 2 } : null };
    // The objects held on one node after the pills, as far from the last as two pills are apart.
    if (left > 0) y += LINE;
  }

  // Then the objects each node holds alone, under its box.
  const objects: SketchObject[] = [];
  const more: SketchLayout["more"] = [];
  let bottom = Math.max(y, top + (nodes.length > 0 ? boxHeight : 0));
  for (const n of sketchNodes) {
    let yy = y;
    const own = objectsOf(n.name);
    for (const o of own.slice(0, MAX_OBJECTS)) {
      objects.push({ node: n.name, path: o.path, count: o.count, x: n.x, y: yy, width: n.width });
      yy += CHIP_HEIGHT + CHIP_GAP;
    }
    if (own.length > MAX_OBJECTS) {
      more.push({ node: n.name, count: own.length - MAX_OBJECTS, x: n.x + n.width / 2, y: yy + LINE / 2 });
      yy += LINE;
    }
    bottom = Math.max(bottom, yy);
  }

  let route: SketchLayout["route"] = null;
  if (routed) {
    const first = sketchNodes[0];
    const last = sketchNodes[sketchNodes.length - 1];
    const x2 = last.x + last.width + ROUTE_STUB;
    route = { x1: first.x - ROUTE_STUB, x2, y: top + boxHeight / 2, tunnel: input.values.tunnel !== "never", labelX: x2 + ROUTE_LABEL_GAP };
  }

  return { width, height: Math.round(bottom + MARGIN), band: bandBox, nodes: sketchNodes, route, objects, more, shared: sharedBlock };
}
