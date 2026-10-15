/*
 * The tabs of the Objects page. The objects are split by what they are: the
 * services running on the nodes, the volumes, the configurations (with the
 * cluster object), the secrets, the users. The next one groups them by
 * namespace, and the last one, Any, lists them all. The tab is in the URL,
 * `list=…`; the first one is shown without it.
 */

export const OBJECT_LISTS = ["services", "volumes", "configs", "secrets", "users"];

/** The tab listing the objects of all the others. */
export const ALL_LIST = "any";

/** The tabs that group the objects rather than list them. */
export const GROUP_TABS = ["namespaces"];

export const OBJECTS_TABS = [...OBJECT_LISTS, ...GROUP_TABS, ALL_LIST];

const LIST_OF_KIND = {vol: "volumes", cfg: "configs", ccfg: "configs", sec: "secrets", usr: "users"};

/** The tab an object of `kind` is listed in, besides Any. */
export const listOfKind = (kind) => LIST_OF_KIND[kind] ?? "services";
