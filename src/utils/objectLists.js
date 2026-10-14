/*
 * The tabs of the Objects page. The objects are split by what they are: the
 * services running on the nodes, the volumes, the configurations (with the
 * cluster object), the secrets, the users. Two more tabs group them: by
 * kind, by namespace. The tab is in the URL, `list=…`; the first one is shown
 * without it.
 */

export const OBJECT_LISTS = ["services", "volumes", "configs", "secrets", "users"];

/** The tabs that group the objects rather than list them. */
export const GROUP_TABS = ["kinds", "namespaces"];

export const OBJECTS_TABS = [...OBJECT_LISTS, ...GROUP_TABS];

const LIST_OF_KIND = {vol: "volumes", cfg: "configs", ccfg: "configs", sec: "secrets", usr: "users"};

/** The tab an object of `kind` is listed in. */
export const listOfKind = (kind) => LIST_OF_KIND[kind] ?? "services";

/** The Objects page on the tab of `kind`, with the query parameters given. */
export const objectsUrl = (params) => {
    const query = new URLSearchParams(params);
    const list = params.kind ? listOfKind(params.kind) : OBJECT_LISTS[0];
    if (list !== OBJECT_LISTS[0]) query.set("list", list);
    return `/objects?${query.toString()}`;
};
