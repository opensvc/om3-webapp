import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {URL_METRICS_PG, URL_NETWORK, URL_NETWORK_IP, URL_OBJECT, URL_POOL} from "../config/apiPath.js";
import {namespaceOf, networkHoldings, parseClaims, poolHoldings} from "../app/namespace-usage";
import {parsePrometheusText} from "../utils/cgroupMetrics";
import logger from "../utils/logger.js";

/** How often the pools, networks and claims are read again. */
export const USAGE_REFRESH_MS = 60000;
/** How often the cgroup metrics are read: a point of the sparklines each time. */
export const PG_REFRESH_MS = 10000;
/** How soon the second reading follows the first: a cpu rate needs two. */
export const PG_FIRST_RATE_MS = 2000;
/** The points a sparkline keeps: five minutes at one every ten seconds. */
export const PG_POINTS = 30;

const authHeaders = () => ({Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`});

async function readJson(url) {
    const response = await fetch(url, {headers: authHeaders(), cache: "no-cache"});
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return response.json();
}

/**
 * The configuration file of a namespace, which holds its claims: its claims, and
 * whether it exists; none when it has no nscfg.
 */
async function readClaims(namespace) {
    const response = await fetch(`${URL_OBJECT}/${encodeURIComponent(namespace)}/nscfg/namespace/config/file`, {
        headers: authHeaders(),
        cache: "no-cache",
    });
    if (response.status === 404) return {claims: [], exists: false};
    if (!response.ok) throw new Error(`${namespace}/nscfg/namespace: HTTP ${response.status}`);
    return {claims: parseClaims(await response.text()), exists: true};
}

/**
 * The pools and networks of the cluster, what each namespace holds of them, and
 * the claims of each namespace of `namespaces`, read again every minute, and at
 * once on `reload`, after a change of the claims. `configured` says which have a
 * namespace configuration, where the claims are written.
 */
export function useNamespaceClaims(namespaces) {
    const [state, setState] = useState({pools: [], networks: [], poolsHeld: new Map(), networksHeld: new Map(), claims: {}, configured: {}, error: null, loaded: false});
    const [generation, setGeneration] = useState(0);
    const reload = useCallback(() => setGeneration((n) => n + 1), []);
    const key = namespaces.join(",");
    useEffect(() => {
        let cancelled = false;
        const read = async () => {
            try {
                const [pools, volumes, networks, addresses] = await Promise.all(
                    [URL_POOL, `${URL_POOL}/volume`, URL_NETWORK, URL_NETWORK_IP].map(readJson)
                );
                const read = Object.fromEntries(await Promise.all(
                    namespaces.map(async (ns) => [ns, await readClaims(ns).catch((error) => {
                        logger.warn("Failed to read the claims of", ns, error);
                        return {claims: [], exists: undefined};
                    })])
                ));
                const claims = Object.fromEntries(Object.entries(read).map(([ns, r]) => [ns, r.claims]));
                const configured = Object.fromEntries(Object.entries(read).map(([ns, r]) => [ns, r.exists]));
                if (cancelled) return;
                setState({
                    pools: pools.items ?? [],
                    networks: networks.items ?? [],
                    poolsHeld: poolHoldings(volumes.items ?? []),
                    networksHeld: networkHoldings(addresses.items ?? []),
                    claims,
                    configured,
                    error: null,
                    loaded: true,
                });
            } catch (error) {
                if (!cancelled) setState((previous) => ({...previous, error: error.message, loaded: true}));
            }
        };
        void read();
        const timer = setInterval(read, USAGE_REFRESH_MS);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, generation]);
    return useMemo(() => ({...state, reload}), [state, reload]);
}

/**
 * The cpu and memory the objects of each namespace use, summed over their cgroups,
 * and the last PG_POINTS readings of each for the sparklines. The cpu is a rate
 * between two readings, in cpus: none on the first one.
 *
 * The daemon serves the cgroup metrics at /metrics/pg for its own node only, and
 * the API relays no other node's: this is the node the webapp is served from.
 */
export function useNamespacePg() {
    const [series, setSeries] = useState({});
    const previous = useRef(null);
    useEffect(() => {
        let cancelled = false;
        const read = async () => {
            try {
                const response = await fetch(URL_METRICS_PG, {cache: "no-cache"});
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const now = Date.now();
                const usec = {};
                const memory = {};
                for (const {name, labels, value} of parsePrometheusText(await response.text())) {
                    if (!labels.path) continue;
                    const ns = labels.namespace || namespaceOf(labels.path);
                    if (name === "opensvc_pg_cgroup_cpu_usage_usec") usec[labels.path] = {ns, value};
                    else if (name === "opensvc_pg_cgroup_memory_current_bytes") memory[ns] = (memory[ns] ?? 0) + value;
                }
                const last = previous.current;
                previous.current = {at: now, usec};
                const cpu = {};
                if (last) {
                    const elapsedUsec = (now - last.at) * 1000;
                    for (const [path, {ns, value}] of Object.entries(usec)) {
                        const before = last.usec[path]?.value;
                        // A counter gone back is a cgroup recreated: no rate this time.
                        if (before === undefined || value < before || elapsedUsec <= 0) continue;
                        cpu[ns] = (cpu[ns] ?? 0) + (value - before) / elapsedUsec;
                    }
                }
                if (cancelled) return;
                setSeries((old) => {
                    const out = {};
                    for (const ns of new Set([...Object.keys(old), ...Object.keys(memory), ...Object.keys(cpu)])) {
                        const was = old[ns] ?? {cpu: [], memory: []};
                        out[ns] = {
                            cpu: last ? [...was.cpu, cpu[ns] ?? 0].slice(-PG_POINTS) : was.cpu,
                            memory: [...was.memory, memory[ns] ?? 0].slice(-PG_POINTS),
                        };
                    }
                    return out;
                });
            } catch (error) {
                logger.warn("Failed to read the cgroup metrics:", error);
            }
        };
        void read();
        // The cpu shows a couple of seconds after the page, not after a whole period.
        const first = setTimeout(read, PG_FIRST_RATE_MS);
        const timer = setInterval(read, PG_REFRESH_MS);
        return () => {
            cancelled = true;
            clearTimeout(first);
            clearInterval(timer);
        };
    }, []);
    return series;
}
