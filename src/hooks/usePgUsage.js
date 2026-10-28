import {useEffect, useMemo, useSyncExternalStore} from "react";
import useEventStore from "./useEventStore.js";
import {URL_NODE} from "../config/apiPath.js";
import {detailsUsage, hostUsage, namespaceSlicesUsage, nodeUsage, opensvcUsage, readPgScopes, sameReading, topSlicesUsage} from "../app/pg-usage";
import logger from "../utils/logger.js";

/**
 * How often each node is read. The daemon reads its cgroups at each scrape, scrapes
 * less than a second apart sharing one reading, and tells when it read them: the
 * rates are counted between those times, whoever asked for the readings.
 */
export const PG_POLL_MS = 12000;

/**
 * A node newly read, or an object newly asked for on it, is read again this soon
 * after: its rates, which take two readings, shown without waiting for the poll.
 */
export const PG_FIRST_RATE_MS = 2000;

/** A reading the same as the one before, in the window of another scrape: read again after it. */
export const PG_SAME_RETRY_MS = 1100;

/*
 * One reader for every view: the nodes asked for, each by how many views, are read
 * every PG_POLL_MS, a node newly asked for at once. The state is the usage of the
 * instances of each node read (`ClusterUsage`), that of the opensvc slice of each
 * node told (`totals`), that of its namespace slices (`namespaces`), that of the whole
 * host told (`hosts`) and of its other top-level slices (`slices`), that of the groups
 * in the slices of the objects asked for on it (`details`: their subsets and
 * resources, read with `?path=`), and the error of each node whose last reading failed.
 */
const wanted = new Map();
/** The objects whose subsets and resources are asked for, by node: path to how many views. */
const wantedPaths = new Map();
const readings = {};
const EMPTY = {usage: {}, totals: {}, namespaces: {}, hosts: {}, slices: {}, details: {}, errors: {}};
let state = EMPTY;
const listeners = new Set();
let timer = null;

const authHeaders = () => ({Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`});

function publish(next) {
    state = next;
    for (const listener of listeners) listener();
}

async function readNode(node) {
    try {
        const paths = [...(wantedPaths.get(node)?.keys() ?? [])].sort();
        const query = paths.length === 0 ? "" : `?${paths.map((path) => `path=${encodeURIComponent(path)}`).join("&")}`;
        const response = await fetch(`${URL_NODE}/${encodeURIComponent(node)}/metrics/pg${query}`, {
            headers: authHeaders(),
            cache: "no-cache",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const current = {at: Date.now(), ...readPgScopes(await response.text())};
        // The one before again: no time between them to count a rate over; read after the window.
        if (sameReading(readings[node], current) && (wantedPaths.get(node)?.size ?? 0) === 0) {
            later(node, PG_SAME_RETRY_MS);
            return;
        }
        const usage = nodeUsage(readings[node], current);
        const total = opensvcUsage(readings[node], current);
        const nsSlices = namespaceSlicesUsage(readings[node], current);
        const host = hostUsage(readings[node], current);
        const slices = topSlicesUsage(readings[node], current);
        const details = detailsUsage(readings[node], current);
        readings[node] = current;
        // A node no longer asked for while it was read is dropped.
        if (!wanted.has(node)) return;
        const {[node]: _cleared, ...errors} = state.errors;
        const {[node]: _untold, ...totals} = state.totals;
        const {[node]: _noHost, ...hosts} = state.hosts;
        publish({
            usage: {...state.usage, [node]: usage},
            totals: total === undefined ? totals : {...totals, [node]: total},
            namespaces: {...state.namespaces, [node]: nsSlices},
            hosts: host === undefined ? hosts : {...hosts, [node]: host},
            slices: {...state.slices, [node]: slices},
            details: {...state.details, [node]: details},
            errors,
        });
    } catch (error) {
        logger.warn(`Failed to read the cgroup metrics of ${node}:`, error);
        if (!wanted.has(node)) return;
        publish({...state, errors: {...state.errors, [node]: error.message || String(error)}});
    }
}

/** The reads planned soon, by node: one at most each. */
const soon = new Map();

/** A node read again in `ms`, still asked for then. */
function later(node, ms) {
    if (soon.has(node)) return;
    soon.set(node, setTimeout(() => {
        soon.delete(node);
        if (wanted.has(node)) void readNode(node);
    }, ms));
}

/** A node read now, and again shortly after: its rates told within seconds. */
function readTwice(node) {
    void readNode(node);
    later(node, PG_FIRST_RATE_MS);
}

function readAll() {
    for (const node of wanted.keys()) void readNode(node);
}

/** The objects asked for on a node, counted; a new one reads the node at once. */
function wantPaths(nodes, paths) {
    for (const node of nodes) {
        if (!wantedPaths.has(node)) wantedPaths.set(node, new Map());
        const byPath = wantedPaths.get(node);
        let added = false;
        for (const path of paths) {
            const count = byPath.get(path) ?? 0;
            byPath.set(path, count + 1);
            if (count === 0) added = true;
        }
        if (added && (wanted.get(node) ?? 0) > 0) readTwice(node);
    }
}

function releasePaths(nodes, paths) {
    for (const node of nodes) {
        const byPath = wantedPaths.get(node);
        if (!byPath) continue;
        for (const path of paths) {
            const count = (byPath.get(path) ?? 1) - 1;
            if (count > 0) byPath.set(path, count);
            else byPath.delete(path);
        }
        if (byPath.size === 0) wantedPaths.delete(node);
    }
}

function want(nodes) {
    for (const node of nodes) {
        const count = wanted.get(node) ?? 0;
        wanted.set(node, count + 1);
        if (count === 0) readTwice(node);
    }
    if (timer === null && wanted.size > 0) timer = setInterval(readAll, PG_POLL_MS);
}

function release(nodes) {
    for (const node of nodes) {
        const count = (wanted.get(node) ?? 1) - 1;
        if (count > 0) {
            wanted.set(node, count);
            continue;
        }
        wanted.delete(node);
        delete readings[node];
        if (Object.values(state).some((byNode) => byNode[node] !== undefined)) {
            publish(Object.fromEntries(Object.entries(state).map(([key, byNode]) => {
                const {[node]: _gone, ...others} = byNode;
                return [key, others];
            })));
        }
    }
    if (wanted.size === 0 && timer !== null) {
        clearInterval(timer);
        timer = null;
    }
}

/** Forgets every reading: for the tests. */
export function resetPgUsage() {
    wanted.clear();
    wantedPaths.clear();
    for (const pending of soon.values()) clearTimeout(pending);
    soon.clear();
    for (const node of Object.keys(readings)) delete readings[node];
    if (timer !== null) clearInterval(timer);
    timer = null;
    state = EMPTY;
    listeners.clear();
}

const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};
const snapshot = () => state;

const pick = (byNode, key) => {
    const list = key === "" ? [] : key.split(",");
    return Object.fromEntries(list.filter((node) => byNode[node] !== undefined).map((node) => [node, byNode[node]]));
};

/**
 * The cgroup usage of the instances on `nodes` (`ClusterUsage`): the cpu in cpus,
 * from the second reading of a node, the memory and its limit. Read while asked.
 * `totals`: the usage of the opensvc slice of each node told, by node; `namespaces`:
 * that of its namespace slices, by node then namespace; `hosts`: that of the whole
 * host, by node; `slices`: that of its other top-level slices, by node then name;
 * `details`: that of the subsets and resources of the objects of `paths`, by node then
 * object, read on those nodes while asked; `errors`: why the last reading of a node
 * failed, by node.
 */
export function usePgReadings(nodes, {paths = []} = {}) {
    const key = [...new Set(nodes)].sort().join(",");
    const pathsKey = [...new Set(paths)].sort().join("\n");
    useEffect(() => {
        const list = key === "" ? [] : key.split(",");
        const objects = pathsKey === "" ? [] : pathsKey.split("\n");
        // The objects asked for before the nodes: the first reading of a node asks for them.
        wantPaths(list, objects);
        want(list);
        return () => {
            release(list);
            releasePaths(list, objects);
        };
    }, [key, pathsKey]);
    const current = useSyncExternalStore(subscribe, snapshot);
    return useMemo(
        () => Object.fromEntries(Object.entries(current).map(([name, byNode]) => [name, pick(byNode, key)])),
        [current, key],
    );
}

/** The cgroup usage of the instances on `nodes` (usePgReadings), without the errors. */
export function usePgUsage(nodes) {
    return usePgReadings(nodes).usage;
}

const selectNodeStatus = (s) => s.nodeStatus;
const selectInstances = (s) => s.objectInstanceStatus;

/** The nodes of the cluster: those the store knows, and those running an instance. */
export function useClusterNodes() {
    const nodeStatus = useEventStore(selectNodeStatus);
    const instances = useEventStore(selectInstances);
    return useMemo(() => {
        const nodes = new Set(Object.keys(nodeStatus ?? {}));
        for (const byNode of Object.values(instances ?? {})) {
            for (const node of Object.keys(byNode ?? {})) nodes.add(node);
        }
        return [...nodes].sort();
    }, [nodeStatus, instances]);
}
