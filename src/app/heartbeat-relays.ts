/*
 * A relay, as `om node relay status` shows it: a heartbeat of type relay has each
 * node of a cluster write its message to a slot of a relay, a third host, and read
 * the slots of its peers there. A node that is a relay says the slots it holds (GET
 * /api/relay/status): for each node of each cluster writing to it, the address it
 * wrote from, when and how much.
 */

/** A slot of a relay, or the relay not reached, as the daemon lists them. */
export interface RelayStatusItem {
  relay: string;
  cluster_id?: string;
  cluster_name?: string;
  nodename?: string;
  node_addr?: string;
  username?: string;
  msg_len?: number;
  updated_at?: string;
  /** Why the relay could not be asked; empty when it answered. */
  status?: string;
}

/** The timeout of a heartbeat when the daemon says none: its default, 15s. */
export const DEFAULT_TIMEOUT_MS = 15_000;

/** A slot this node holds as a relay, for a node of a cluster writing to it: active, or stale. */
export interface ServedSlot {
  cluster: string;
  node: string;
  addr?: string;
  updatedAt?: string;
  state: "active" | "stale";
}

/**
 * The slots the node answering holds as a relay (GET /api/relay/status), by cluster
 * then node: active when written within `timeoutMs`, stale past it. A relay knows
 * not the timeouts of the heartbeats writing to it: the default one unless said.
 * Reckoned on the clock of the browser against the one of the relay.
 */
export function servedSlots(items: RelayStatusItem[], now: number, timeoutMs = DEFAULT_TIMEOUT_MS): ServedSlot[] {
  return items
    .filter((i) => i.nodename)
    .map((i) => {
      const written = Date.parse(i.updated_at ?? "");
      const fresh = !Number.isNaN(written) && now - written <= timeoutMs;
      return {
        cluster: i.cluster_name || i.cluster_id || "",
        node: i.nodename as string,
        addr: i.node_addr,
        updatedAt: i.updated_at,
        state: fresh ? ("active" as const) : ("stale" as const),
      };
    })
    .sort((a, b) => a.cluster.localeCompare(b.cluster) || a.node.localeCompare(b.node));
}

/** How many slots active and stale; none of either, the node relays for no cluster. */
export function slotCounts(slots: ServedSlot[]): { active: number; stale: number } {
  return { active: slots.filter((s) => s.state === "active").length, stale: slots.filter((s) => s.state === "stale").length };
}
