/*
 * What the cluster status tells of the cluster as a whole, beyond its nodes and
 * objects: the collector it feeds, the agents its nodes run, its leader and how long
 * its daemons and machines have run, its id and environment, its former certificate
 * authorities. Read from GET /api/cluster/status, its objects selected away.
 */

/** A node of the cluster status, the parts read of it. */
interface StatusNode {
  status?: { agent?: string; is_leader?: boolean; booted_at?: string };
  config?: { env?: string };
  daemon?: Record<string, { state?: string; url?: string; created_at?: string } | undefined>;
}

export interface ClusterStatusPart {
  cluster?: {
    config?: { id?: string; ca_sec_paths?: string[] | null };
    status?: { is_compat?: boolean };
    node?: Record<string, StatusNode>;
  };
}

export interface ClusterFacts {
  id?: string;
  /** The environments of the nodes, each once ("DEV"). */
  envs: string[];
  /**
   * The collector: fed by its speaker node; `failing`, the speaker with client errors
   * or none speaking; `none`, no node configured for one. `warnings`, the nodes with
   * client errors.
   */
  collector: { state: "feeding" | "failing" | "none"; url?: string; speaker?: string; warnings: string[] };
  /** The agent versions, each its nodes, the most run first. */
  versions: { version: string; nodes: string[] }[];
  /** Whether the agents of the nodes may work together. */
  compat: boolean;
  leader?: string;
  /** The latest start of a daemon: the shortest run of them. */
  daemonStart?: string;
  /** The oldest and the newest boot of the machines. */
  boots?: [string, string];
  /** The former certificate authorities still trusted, and the day of the last rotation their names tell. */
  ca?: { formers: number; rotatedOn?: string };
}

const time = (value: string | undefined) => (value ? Date.parse(value) : NaN);

/** The facts the status tells, the nodes in the order of their names. */
export function clusterFacts(status: ClusterStatusPart): ClusterFacts {
  const config = status.cluster?.config ?? {};
  const nodes = Object.entries(status.cluster?.node ?? {}).sort(([a], [b]) => a.localeCompare(b));

  // The collector: the speaker feeds it; a node without a configuration of one, disabled.
  const links = nodes.map(([name, n]) => ({ name, ...(n.daemon?.collector ?? {}) })).filter((l) => l.state !== undefined);
  const configured = links.filter((l) => l.state !== "disabled");
  const speaker = configured.find((l) => l.state === "speaker" || l.state === "speaker-warning");
  const warnings = configured.filter((l) => l.state === "warning" || l.state === "speaker-warning").map((l) => l.name);
  const url = [speaker, ...configured].find((l) => l?.url && l.url !== "unknown")?.url;
  const collector: ClusterFacts["collector"] = configured.length === 0
    ? { state: "none", warnings: [] }
    : { state: speaker?.state === "speaker" ? "feeding" : "failing", url, speaker: speaker?.name, warnings };

  const byVersion = new Map<string, string[]>();
  for (const [name, n] of nodes) {
    const version = n.status?.agent;
    if (version) byVersion.set(version, [...(byVersion.get(version) ?? []), name]);
  }
  const versions = [...byVersion.entries()]
    .map(([version, names]) => ({ version, nodes: names }))
    .sort((a, b) => b.nodes.length - a.nodes.length || a.version.localeCompare(b.version));

  const starts = nodes.map(([, n]) => time(n.daemon?.daemondata?.created_at)).filter((t) => !Number.isNaN(t));
  const boots = nodes.map(([, n]) => time(n.status?.booted_at)).filter((t) => !Number.isNaN(t));

  const formers = (config.ca_sec_paths ?? []).filter(Boolean);
  const days = formers.map((p) => p.match(/(\d{4})(\d{2})(\d{2})/)).filter((m): m is RegExpMatchArray => m !== null).map((m) => `${m[1]}-${m[2]}-${m[3]}`).sort();

  const facts: ClusterFacts = {
    id: config.id || undefined,
    envs: [...new Set(nodes.map(([, n]) => n.config?.env).filter((e): e is string => !!e))],
    collector,
    versions,
    compat: status.cluster?.status?.is_compat !== false,
    leader: nodes.find(([, n]) => n.status?.is_leader)?.[0],
  };
  if (starts.length > 0) facts.daemonStart = new Date(Math.max(...starts)).toISOString();
  if (boots.length > 0) facts.boots = [new Date(Math.min(...boots)).toISOString(), new Date(Math.max(...boots)).toISOString()];
  if (formers.length > 0) facts.ca = { formers: formers.length, rotatedOn: days.at(-1) };
  return facts;
}

/** The address of a collector, short: its host and port. */
export function collectorHost(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
