/*
 * The drivers a node can run, as om reads them: a driver built in is usable on a
 * node when the node holds its capability, the one its capability scanner sets
 * (`om node capabilities scan`). A resource driver's capability is
 * `drivers.resource.<group>.<name>`, another's `drivers.<group>.<name>`
 * (core/driver ID.Cap); the configuration of a driver a node does not hold is
 * refused there (xconfig validate). A capability under a driver's own names what
 * the driver can do there besides (`drivers.resource.container.kvm.hvm`); one under
 * `node.x.` a tool of the node (`node.x.systemd`).
 */

/** The driver groups of the resources, their capabilities under `drivers.resource.`. */
export const RESOURCE_GROUPS: readonly string[] = ["ip", "volume", "disk", "fs", "share", "container", "app", "sync", "task"];

/** The capabilities of the tools of a node, under it. */
const TOOL_PREFIX = "node.x.";

/** The capability of the driver `id` (`fs.ext4`, `pool.directory`, `volume`). */
export function driverCap(id: string): string {
  const group = id.split(".")[0];
  return RESOURCE_GROUPS.includes(group) ? `drivers.resource.${id}` : `drivers.${id}`;
}

/** A driver built in, and what the node can do of it. */
export interface DriverRow {
  id: string;
  group: string;
  /** Its name in its group, empty for the driver of a group alone (`volume`). */
  name: string;
  usable: boolean;
  /** What it can do there besides, its capabilities under its own: `hvm`, `acls`. */
  features: string[];
}

/** The drivers built in, by group then name, each usable or not with the capabilities given. */
export function driverRows(drivers: string[], capabilities: string[]): DriverRow[] {
  const caps = new Set(capabilities);
  return [...new Set(drivers)]
    .map((id) => {
      const cap = driverCap(id);
      const [group, ...rest] = id.split(".");
      return {
        id,
        group,
        name: rest.join("."),
        usable: caps.has(cap),
        features: capabilities
          .filter((c) => c.startsWith(`${cap}.`))
          .map((c) => c.slice(cap.length + 1))
          .sort(),
      };
    })
    .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
}

/** The tools of the node its capabilities name (`systemd`, `scsi.sg_persist`), sorted. */
export const nodeTools = (capabilities: string[]): string[] =>
  capabilities
    .filter((c) => c.startsWith(TOOL_PREFIX))
    .map((c) => c.slice(TOOL_PREFIX.length))
    .sort();

/**
 * The nodes not holding the driver `id`, of those whose capabilities were read:
 * a node not read (`undefined`) is not said lacking it.
 */
export function nodesLacking(capabilitiesByNode: Record<string, string[] | undefined>, id: string): string[] {
  const cap = driverCap(id);
  return Object.entries(capabilitiesByNode)
    .filter(([, caps]) => caps !== undefined && !caps.includes(cap))
    .map(([node]) => node)
    .sort();
}
