/*
 * The heartbeat mesh of a cluster: its nodes, and a link for each stream of each
 * node toward each of its peers, as the daemons report them (DaemonHeartbeatUpdated).
 *
 * A tx stream of a node sends to its peer, an rx stream receives from it: the link
 * runs from the sender to the receiver. Each end reports its own stream, so the
 * hb#1 of two nodes is four links, two each way: n1 tx and n2 rx, n2 tx and n1 rx.
 */

export interface HeartbeatPeer {
  desc?: string;
  is_beating?: boolean;
  changed_at?: string;
  last_beating_at?: string;
}

export interface HeartbeatStream {
  id: string;
  type?: string;
  state?: string;
  peers?: Record<string, HeartbeatPeer>;
}

export interface MeshLink {
  /** Unique in the mesh: the stream of a node toward a peer. */
  key: string;
  /** The node reporting the stream, and the peer it is toward. */
  node: string;
  peer: string;
  /** The heartbeat, "hb#1", and the side of the stream on its node. */
  hb: string;
  dir: "rx" | "tx" | "";
  type: string;
  /** The sender and the receiver. */
  from: string;
  to: string;
  /** Up when the stream runs and the peer beats, down otherwise. */
  state: "up" | "down";
  streamState?: string;
  desc?: string;
  lastBeatingAt?: string;
}

/** The links of the mesh, in the order of the nodes, then of their streams. */
export function meshLinks(heartbeatStatus: Record<string, { streams?: HeartbeatStream[] } | undefined>): MeshLink[] {
  const links: MeshLink[] = [];
  for (const node of Object.keys(heartbeatStatus ?? {}).sort()) {
    for (const stream of heartbeatStatus[node]?.streams ?? []) {
      const match = /^(.*)\.(rx|tx)$/.exec(stream.id ?? "");
      const hb = match ? match[1] : stream.id;
      const dir = (match ? match[2] : "") as MeshLink["dir"];
      for (const [peer, status] of Object.entries(stream.peers ?? {})) {
        if (!peer) continue;
        const sends = dir !== "rx";
        links.push({
          key: `${node} ${stream.id} ${peer}`,
          node,
          peer,
          hb,
          dir,
          type: stream.type ?? "",
          from: sends ? node : peer,
          to: sends ? peer : node,
          state: stream.state === "running" && status?.is_beating === true ? "up" : "down",
          streamState: stream.state,
          desc: status?.desc,
          lastBeatingAt: status?.last_beating_at,
        });
      }
    }
  }
  return links;
}

/** The nodes of the mesh: those reporting heartbeats and their peers, sorted. */
export function meshNodes(heartbeatStatus: Record<string, unknown>, links: MeshLink[]): string[] {
  return [...new Set([...Object.keys(heartbeatStatus ?? {}), ...links.map((l) => l.peer)])].sort();
}

/** A group of links all beating, some, or none. */
export type GroupState = "up" | "warn" | "down";

/** The state of a group of links: up when all beat, down when none does, warn for a mix. */
export function groupState(links: MeshLink[]): GroupState {
  const up = links.filter((l) => l.state === "up").length;
  return up === links.length ? "up" : up === 0 ? "down" : "warn";
}

export interface Point {
  x: number;
  y: number;
}

/**
 * A direction between two nodes: the links from one to the other, drawn as one
 * straight line, tinted as one (groupState), its card listing each link.
 */
export interface MeshGroup {
  key: string;
  from: string;
  to: string;
  links: MeshLink[];
  state: GroupState;
  /** The line, from the edge of the sender to the edge of the receiver. */
  path: string;
  /** The middle of the line, where its card shows. */
  label: Point;
}

export interface MeshLayout {
  width: number;
  height: number;
  nodes: Record<string, Point>;
  groups: MeshGroup[];
}

/** The radius of a node, its lines starting at its edge. */
export const NODE_RADIUS = 34;
/** The room between the two parallel lines of a pair of nodes, one each way. */
export const DIRECTION_OFFSET = 22;

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * Where the nodes and the lines go. Two nodes face each other, more stand on a
 * circle. Between two nodes, a line each way, straight and parallel, one on each
 * side of the line between their centres, so the two directions never overlap;
 * each line holds all the links of its direction.
 */
export function meshLayout(nodes: string[], links: MeshLink[]): MeshLayout {
  let width: number;
  let height: number;
  const positions: Record<string, Point> = {};
  if (nodes.length <= 2) {
    width = 720;
    height = Math.max(160, 2 * (DIRECTION_OFFSET + NODE_RADIUS) + 60);
    const y = height / 2;
    if (nodes.length === 1) positions[nodes[0]] = { x: width / 2, y };
    else {
      positions[nodes[0]] = { x: NODE_RADIUS + 70, y };
      positions[nodes[1]] = { x: width - NODE_RADIUS - 70, y };
    }
  } else {
    const radius = Math.max(200, nodes.length * 50);
    width = height = 2 * (radius + NODE_RADIUS + 60);
    nodes.forEach((name, i) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / nodes.length;
      positions[name] = { x: width / 2 + radius * Math.cos(angle), y: height / 2 + radius * Math.sin(angle) };
    });
  }

  const byDirection = new Map<string, MeshLink[]>();
  for (const link of links) {
    const key = `${link.from} ${link.to}`;
    byDirection.set(key, [...(byDirection.get(key) ?? []), link]);
  }

  const groups: MeshGroup[] = [];
  for (const [key, members] of [...byDirection].sort(([k], [l]) => k.localeCompare(l))) {
    const [from, to] = key.split(" ");
    const pf = positions[from];
    const pt = positions[to];
    if (!pf || !pt) continue;
    // The normal of the pair from its first node in name order: the direction
    // from that node runs on one side, the other way on the other.
    const [a, b] = [from, to].sort();
    const pa = positions[a];
    const pb = positions[b];
    const length = Math.hypot(pb.x - pa.x, pb.y - pa.y) || 1;
    const normal = { x: -(pb.y - pa.y) / length, y: (pb.x - pa.x) / length };
    // Half the room between the two lines on each side of the line of the centres.
    const offset = from === a ? -DIRECTION_OFFSET / 2 : DIRECTION_OFFSET / 2;
    // Straight, parallel to the line of the centres: from the edge of the sender's
    // circle to the edge of the receiver's, where a line that far from the centre
    // crosses it.
    const along = { x: (pt.x - pf.x) / length, y: (pt.y - pf.y) / length };
    const inset = Math.sqrt(Math.max(0, NODE_RADIUS ** 2 - offset ** 2));
    const start = { x: pf.x + along.x * inset + normal.x * offset, y: pf.y + along.y * inset + normal.y * offset };
    const end = { x: pt.x - along.x * inset + normal.x * offset, y: pt.y - along.y * inset + normal.y * offset };
    const label = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    groups.push({
      key,
      from,
      to,
      // By heartbeat, the sender's tx before the receiver's rx.
      links: [...members].sort((l, m) => l.hb.localeCompare(m.hb) || (l.dir === "tx" ? -1 : 0) - (m.dir === "tx" ? -1 : 0)),
      state: groupState(members),
      path: `M ${round(start.x)} ${round(start.y)} L ${round(end.x)} ${round(end.y)}`,
      label: { x: round(label.x), y: round(label.y) },
    });
  }
  return { width, height, nodes: positions, groups };
}
