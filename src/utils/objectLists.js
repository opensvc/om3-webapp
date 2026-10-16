/*
 * The tabs of the Objects page. The first one, Any, lists them all; then the
 * objects split by what they are: the services running on the nodes, the volumes,
 * the configurations (with the cluster object), the secrets, the users; the last
 * one groups them by namespace. The tab is in the URL, `list=…`; the services
 * tab, the one shown by default, without it.
 */

export const OBJECT_LISTS = ["services", "volumes", "configs", "secrets", "users"];

/** The tab listing the objects of all the others. */
export const ALL_LIST = "any";

/** The tabs that group the objects rather than list them. */
export const GROUP_TABS = ["namespaces"];

export const OBJECTS_TABS = [ALL_LIST, ...OBJECT_LISTS, ...GROUP_TABS];

const LIST_OF_KIND = {vol: "volumes", cfg: "configs", ccfg: "configs", sec: "secrets", usr: "users"};

/** The tab an object of `kind` is listed in, besides Any. */
export const listOfKind = (kind) => LIST_OF_KIND[kind] ?? "services";
