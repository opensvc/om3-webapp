/*
 * The nodes table scaled down to the room it has, a step at a time, the least
 * missed first: the labels dropped; the agent version dropped, a mark by the state of
 * a node running another than most; the env a badge by the name; the score, load,
 * memory and swap in one cell; the dates under the name.
 */

/** The steps of the scaling down: past the last one, the table scrolls sideways. */
export const NODE_LAYOUT_STEPS = 5;

/** What the table shows at a step of its scaling down, 0 the whole of it. */
export const nodeLayout = (step) => ({
    labels: step < 1,
    version: step < 2,
    envColumn: step < 3,
    metricsGrouped: step >= 4,
    datesInName: step >= 5,
});

/** The columns of a layout, after the checkbox, each the key it sorts by and its title. */
export function nodeColumns(layout) {
    return [
        {key: "name", labelKey: "common.name"},
        {key: "state", labelKey: "common.state"},
        ...(layout.metricsGrouped ? [{key: "score", labelKey: "nodes.columns.metrics"}] : [
            {key: "score", labelKey: "nodes.columns.score"},
            {key: "load_15m", labelKey: "nodes.columns.load15m"},
            {key: "mem_avail", labelKey: "nodes.columns.memAvail"},
            {key: "swap_avail", labelKey: "nodes.columns.swapAvail"},
        ]),
        ...(layout.version ? [{key: "version", labelKey: "nodes.columns.version"}] : []),
        ...(layout.envColumn ? [{key: "env", labelKey: "nodes.columns.env"}] : []),
        ...(layout.labels ? [{key: "labels", labelKey: "nodes.columns.labels"}] : []),
        ...(layout.datesInName ? [] : [
            {key: "booted_at", labelKey: "nodes.columns.bootedAt"},
            {key: "updated_at", labelKey: "nodes.columns.updatedAt"},
        ]),
    ];
}

/**
 * The agent version most nodes run, the one a node running another is marked for; a
 * tie, that of `preferred` (the node serving the api) when one of them, else the
 * highest in the order of the words. None reported, undefined.
 */
export function commonVersion(versions, preferred) {
    const counts = new Map();
    for (const v of versions) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    if (counts.size === 0) return undefined;
    const most = Math.max(...counts.values());
    const tied = [...counts].filter(([, n]) => n === most).map(([v]) => v);
    if (preferred && tied.includes(preferred)) return preferred;
    return tied.sort((a, b) => b.localeCompare(a, undefined, {numeric: true}))[0];
}
