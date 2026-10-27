import React, {useEffect, useMemo, useState} from "react";
import {Link} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {URL_RESOURCES, URL_STORE} from "../config/apiPath.js";
import {groupState, meshLinks} from "../app/heartbeat-mesh";
import {CrossLink} from "../app/CrossLink";
import {storeSource} from "../app/store-config";
import {kindOf, useMenuState} from "../hooks/useSidebarAlerts";
import {useClusterNodeOrder} from "../hooks/useClusterNodeOrder";
import {usePgReadings} from "../hooks/usePgUsage";
import {IO_FIGURES, sumUsage} from "../app/pg-usage";
import {ioFigure} from "./ClusterUsage";
import {formatCpu} from "../app/namespace-usage";
import {formatBytes} from "../ui/lib/format";
import {ObjectIcon} from "../ui/components/ObjectIcon";
import {UsageBar} from "../ui/components/UsageBar";
import {FrozenMark} from "../ui/components/FrozenMark";
import {Overall} from "./HeartbeatMesh";
import {RING_INK, StateRing} from "./StateRing";
import {formatAge} from "./AgeTime";
import {read} from "./SectionConfig";

/** The lists read for the overview alone, the stores and the resources, again at this period. */
export const OVERVIEW_REFRESH_MS = 30_000;
/** The items a card lists at most: the worst first. */
const SHOWN = 5;
const ZERO_TIME = "0001-01-01T00:00:00Z";
const ACTORS = ["svc", "vol"];

/** The nodes by their state, the worst first: dropped, its status gone; overloaded; optimal. [state, arc, dot, ink] */
const NODE_STATES = [
    ["dropped", "stroke-state-down", "bg-state-down", "text-state-down"],
    ["overloaded", "stroke-state-warn", "bg-state-warn", "text-state-warn"],
    ["optimal", "stroke-state-up", "bg-state-up", ""],
];

/** The services and the volumes by their availability, the worst first, n/a last. [state, arc, dot] */
const AVAIL_STATES = [
    ["down", "stroke-state-down", "bg-state-down"],
    ["warn", "stroke-state-warn", "bg-state-warn"],
    ["up", "stroke-state-up", "bg-state-up"],
    ["na", "stroke-line-strong", "bg-line-strong"],
];

/** The resources: those in warn, the others of any state. [state, arc, dot] */
const RESOURCE_STATES = [
    ["warn", "stroke-state-warn", "bg-state-warn"],
    ["other", "stroke-line-strong", "bg-line-strong"],
];

/** The arbitrators, as the nodes see them: up, or not reached. [state, arc, dot] */
const ARBITRATOR_STATES = [
    ["down", "stroke-state-down", "bg-state-down"],
    ["up", "stroke-state-up", "bg-state-up"],
];

/** The tint of a heartbeat in the list of the links card: none of its links beating, some, all. */
const HB_INK = {down: "text-state-down", warn: "text-state-warn", up: ""};

/** A count or a name of the overview as a badge, opening its page filtered on it. */
const FILTER_BADGE = "inline-flex items-center gap-1 rounded-full border border-line bg-surface px-1.5 text-data hover:border-line-strong hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-accent has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-accent";

/** The address of the objects of all the lists filtered by `params`: a kind, a namespace, a global state. */
const objectsUrl = (params) => `/objects?${new URLSearchParams({list: "any", ...params})}`;
/** The services and the volumes by their global state, as the objects page filters it: n/a so written. */
const availUrl = (state) => objectsUrl({kind: ACTORS.join(","), globalState: state === "na" ? "n/a" : state});

/** The state of a node: dropped without a status, a node of the cluster configuration not heard from; else overloaded or optimal. */
const nodeState = (status) => (status === undefined ? "dropped" : status.is_overloaded ? "overloaded" : "optimal");

/**
 * Things by their state at a glance: a ring, its arcs the `states` ([state, arc, dot],
 * the words of `words`.<state>), and in it how many are in the `shown` one, the `good`
 * one unless said, out of all, `label` under, and a word for it, optimal when all are in
 * the `good` one; their counts under it, each a badge opening its page filtered on its
 * state when `link` gives it an address and it counts some.
 */
function CountsRing({name, states, counts, good, shown = good, label, words, link}) {
    const {t} = useTranslation();
    const total = states.reduce((sum, [key]) => sum + counts[key], 0);
    const state = counts[good] === total ? "up" : counts[good] === 0 ? "down" : "warn";
    return (
        <div data-ring={name} data-state={state} className="flex flex-col items-center gap-2 py-1">
            <StateRing parts={states.map(([key, stroke]) => [key, counts[key], stroke])} total={total}>
                <span className="text-2xl font-semibold tabular-nums">{counts[shown]}/{total}</span>
                <span className="text-ink-muted">{label}</span>
                <span className={`font-semibold ${RING_INK[state]}`}>{t(`heartbeats.mesh.overall.${state}`)}</span>
            </StateRing>
            <dl data-ring-legend="" className="flex flex-wrap justify-center gap-x-3 text-data">
                {states.map(([key, , dot]) => {
                    const to = counts[key] > 0 ? link?.(key) : undefined;
                    const word = t(`${words}.${key}`);
                    return (
                        // Linked, the whole item a badge: its link over its word and its count.
                        <div key={key} className={to ? `relative ${FILTER_BADGE}` : "inline-flex items-center gap-1"}>
                            <span aria-hidden="true" className={`size-2 rounded-full ${dot}`}/>
                            <dt className="text-ink-muted">{word}</dt>
                            <dd className="tabular-nums">
                                {to ? (
                                    <Link
                                        to={to}
                                        title={t("clusterView.filtered", {state: word})}
                                        aria-label={`${t("clusterView.filtered", {state: word})}: ${counts[key]}`}
                                        // Static, unlike the card's other links (Card): stretched over the whole badge, not the count alone.
                                        style={{position: "static"}}
                                        className="outline-none after:absolute after:inset-0 after:rounded-full"
                                    >
                                        {counts[key]}
                                    </Link>
                                ) : counts[key]}
                            </dd>
                        </div>
                    );
                })}
            </dl>
        </div>
    );
}

/**
 * What opensvc uses on the nodes, every opensvc cgroup of each the daemon's included
 * (the opensvc slice, `usePgReadings` totals): the cpu and the memory over all the
 * nodes, then node by node. The cpu from a second reading of a node on; the whole of
 * a node shown to whom the whole node may be, said to the others.
 */
function OpensvcUsage({nodes}) {
    const {t, i18n} = useTranslation();
    const {usage, totals, hosts, errors} = usePgReadings(nodes);
    const told = nodes.filter((node) => totals[node] !== undefined);
    const read = nodes.filter((node) => usage[node] !== undefined || errors[node] !== undefined);
    const failed = nodes.filter((node) => errors[node] !== undefined);
    const all = sumUsage(told.map((node) => totals[node]));
    const figures = IO_FIGURES.filter((key) => all[key] !== undefined);
    // The whole hosts, every node told: what opensvc uses of what they use, and of what they have.
    const host = told.every((node) => hosts[node] !== undefined) ? sumUsage(told.map((node) => hosts[node])) : undefined;
    const share = (part, whole) => (typeof part === "number" && typeof whole === "number" && whole > 0
        ? `${(100 * part / whole).toLocaleString(i18n.language, {maximumFractionDigits: part / whole < 0.1 ? 1 : 0})} %`
        : undefined);
    const cpuShare = host && share(all.cpu, host.cpu);
    const memoryShare = host && share(all.memory, host.memory);
    const cpu = (value) => (value === null || value === undefined ? "…" : formatCpu(value, i18n.language));
    const memory = (value) => formatBytes(value, i18n.language) || "-";
    if (told.length === 0) {
        return (
            <p className="text-data text-ink-muted">
                {read.length === 0 ? t("clusterView.reading") : failed.length === read.length ? t("clusterView.opensvc.unread") : t("clusterView.opensvc.notShown")}
            </p>
        );
    }
    return (
        <>
            <dl data-opensvc-total="" className="grid grid-cols-2 gap-3">
                <div>
                    <dt className="text-data text-ink-muted">{t("clusterView.opensvc.cpu")}</dt>
                    <dd className="text-2xl font-semibold tabular-nums">{cpu(all.cpu)}</dd>
                    {cpuShare && (
                        <dd data-share="cpu" className="text-data text-ink-muted">
                            {t("clusterView.opensvc.cpuShare", {share: cpuShare, used: cpu(host.cpu), count: host.cpus ?? 0})}
                        </dd>
                    )}
                </div>
                <div>
                    <dt className="text-data text-ink-muted">{t("clusterView.opensvc.memory")}</dt>
                    <dd className="text-2xl font-semibold tabular-nums">{memory(all.memory)}</dd>
                    {memoryShare && (
                        <dd data-share="memory" className="text-data text-ink-muted">
                            {t("clusterView.opensvc.memoryShare", {share: memoryShare, used: memory(host.memory), total: memory(host.limit)})}
                        </dd>
                    )}
                </div>
            </dl>
            {/* The tasks and the io, where the readings tell them: a line of their own, under the cpu and the memory. */}
            {figures.length > 0 && (
                <dl data-opensvc-io="" className="grid grid-cols-3 gap-3">
                    {figures.map((key) => (
                        <div key={key} data-figure={key}>
                            <dt className="text-data text-ink-muted">{t(`clusterUsage.${key}`)}</dt>
                            <dd className="text-lg font-semibold tabular-nums">{ioFigure(key, all[key], i18n.language)}</dd>
                        </div>
                    ))}
                </dl>
            )}
            <p className="text-data text-ink-muted">{t("clusterView.opensvc.over", {count: told.length, total: nodes.length})}</p>
            <ul aria-label={t("clusterView.opensvc.byNode")} className="space-y-0.5 text-data">
                {told.map((node) => (
                    <li key={node} data-node={node} className="flex items-center gap-2">
                        <CrossLink kind="node" id={node}>{node}</CrossLink>
                        <span className="ml-auto tabular-nums">{cpu(totals[node].cpu)}</span>
                        <span className="w-20 text-right tabular-nums">{memory(totals[node].memory)}</span>
                    </li>
                ))}
            </ul>
            {failed.length > 0 && (
                <p className="text-data text-state-warn">{t("clusterView.opensvc.failed", {nodes: failed.join(", ")})}</p>
            )}
        </>
    );
}

/** A list read for the overview, again every while: its items, undefined while read, or why not. */
function usePolled(url) {
    const [state, setState] = useState({items: undefined, error: null});
    useEffect(() => {
        let live = true;
        const load = () => read(url).then(
            (data) => live && setState({items: data.items ?? [], error: null}),
            (err) => live && setState((s) => ({items: s.items ?? [], error: err.message})),
        );
        void load();
        const timer = setInterval(load, OVERVIEW_REFRESH_MS);
        return () => {
            live = false;
            clearInterval(timer);
        };
    }, [url]);
    return state;
}

/**
 * A card of the overview: the pictogram and the name of a menu entry, its count, the
 * name a link to its page, stretched over the whole card; then what it sums up of it.
 * Without `to`, a card of no page: its name alone.
 */
function Card({id, icon, title, to, count, children}) {
    const {t} = useTranslation();
    return (
        <section
            aria-labelledby={`cluster-card-${id}`}
            data-card={id}
            className={`relative mb-3 break-inside-avoid space-y-2 rounded-(--radius-panel) border border-line bg-surface-raised p-3 ${to ? "hover:border-line-strong has-[a[data-card-link]:focus-visible]:outline-2 has-[a[data-card-link]:focus-visible]:outline-accent" : ""}`}
        >
            <h2 id={`cluster-card-${id}`} className="flex items-center gap-2 font-semibold">
                <ObjectIcon kind={icon} className="h-4 w-4"/>
                {/* The whole card its link: stretched over it, under what the card holds that is clicked or hovered on its own. */}
                {to ? (
                    <Link
                        to={to}
                        data-card-link=""
                        className="outline-none after:absolute after:inset-0 after:rounded-(--radius-panel)"
                        aria-label={t("clusterView.open", {page: title})}
                    >
                        {title}
                    </Link>
                ) : <span>{title}</span>}
                {count !== undefined && <span className="ml-auto font-normal text-ink-muted tabular-nums">{count}</span>}
            </h2>
            <div data-card-body="" className="space-y-2 [&_a]:relative [&_button]:relative [&_[title]]:relative">{children}</div>
        </section>
    );
}

/** The fullest of a list of pools or networks, a bar each, the full ones counted. */
function Fullest({items, kind}) {
    const {t} = useTranslation();
    const sized = items.filter((i) => typeof i.size === "number" && i.size > 0);
    const full = sized.filter((i) => i.used >= i.size).length;
    const fullest = [...sized].sort((a, b) => b.used / b.size - a.used / a.size || a.name.localeCompare(b.name)).slice(0, SHOWN);
    if (fullest.length === 0) return <p className="text-ink-muted">{t("clusterView.usage.none")}</p>;
    return (
        <div className="space-y-1">
            {full > 0 && <p className="text-data text-state-down">{t("clusterView.usage.full", {count: full})}</p>}
            <ul aria-label={t("clusterView.usage.fullest")} className="space-y-0.5">
                {fullest.map((i) => (
                    <li key={i.name} className="flex items-center justify-between gap-2">
                        <CrossLink kind={kind} id={i.name}>{i.name}</CrossLink>
                        <UsageBar value={(i.used / i.size) * 100} label={i.name}/>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/**
 * The overview of the cluster, the default view: a card for each entry of the menu,
 * what its page holds summed up, in a masonry, as wide as the window lets it:
 *
 * - the links, the ring of the heartbeats page, each heartbeat its links beating;
 * - the nodes, a ring of those dropped, overloaded, optimal; those frozen said;
 * - what opensvc uses, its cpu and memory over the nodes, then node by node;
 * - the arbitrators, a ring of the nodes reaching them, each listed; none, with an even
 *   number of nodes, the risk of a tied vote said;
 * - the objects, a ring of the services and the volumes by availability; the objects by kind;
 * - the namespaces, the busiest;
 * - the networks and the pools, the fullest;
 * - the stores, their snapshots, those unreached said;
 * - the resources, a ring of those in warn and the others, how many in warn in it.
 *
 * Live as the menu is: its event stream and its polls (`useMenuState`); the stores
 * and the resources read here, again every while.
 */
export default function ClusterView() {
    const {t, i18n} = useTranslation();
    const {objects, nodeStatus, heartbeatStatus, pools, networks, ready} = useMenuState();
    const stores = usePolled(URL_STORE);
    const resources = usePolled(URL_RESOURCES);

    const links = useMemo(() => meshLinks(heartbeatStatus ?? {}), [heartbeatStatus]);
    // The heartbeats, by name, each its links: the state they make, how many beat out of all.
    const heartbeats = Object.entries(links.reduce((acc, l) => ({...acc, [l.hb]: [...(acc[l.hb] ?? []), l]}), {}))
        .sort(([a], [b]) => a.localeCompare(b, undefined, {numeric: true}))
        .map(([hb, hbLinks]) => ({hb, state: groupState(hbLinks), beating: hbLinks.filter((l) => l.state === "up").length, total: hbLinks.length}));
    // The nodes of the cluster configuration and those reporting: one of the first not reporting, dropped.
    const clusterNodes = useClusterNodeOrder();
    const nodes = [...new Set([...(clusterNodes ?? []), ...Object.keys(nodeStatus ?? {})])]
        .sort((a, b) => a.localeCompare(b))
        .map((node) => [node, nodeStatus?.[node]]);
    const nodeCounts = {dropped: 0, overloaded: 0, optimal: 0};
    for (const [, s] of nodes) nodeCounts[nodeState(s)] += 1;
    const frozen = nodes.filter(([, s]) => s?.frozen_at && s.frozen_at !== ZERO_TIME).length;

    // The arbitrators, each as the nodes see it: how many reach it out of all the nodes, a dropped one none.
    const arbitrators = [...new Set(nodes.flatMap(([, s]) => Object.keys(s?.arbitrators ?? {})))]
        .sort((a, b) => a.localeCompare(b, undefined, {numeric: true}))
        .map((name) => {
            const seen = nodes.map(([, s]) => s?.arbitrators?.[name]);
            const up = seen.filter((a) => a?.status === "up").length;
            return {name, url: seen.find((a) => a?.url)?.url, up, total: nodes.length, state: up === nodes.length ? "up" : up === 0 ? "down" : "warn"};
        });
    const arbitratorCounts = {
        up: arbitrators.reduce((sum, a) => sum + a.up, 0),
        down: arbitrators.reduce((sum, a) => sum + a.total - a.up, 0),
    };
    // No arbitrator to break a tie: an even number of nodes split in halves, neither has a majority of the votes.
    const tieRisk = arbitrators.length === 0 && nodes.length > 0 && nodes.length % 2 === 0;

    const paths = Object.keys(objects ?? {}).sort();
    const actors = paths.filter((p) => ACTORS.includes(kindOf(p)));
    const avail = {up: 0, warn: 0, down: 0, na: 0};
    for (const p of actors) {
        const a = objects[p]?.avail;
        if (a === "up" || a === "warn" || a === "down") avail[a] += 1;
        else avail.na += 1;
    }
    const kinds = Object.entries(paths.reduce((acc, p) => ({...acc, [kindOf(p)]: (acc[kindOf(p)] ?? 0) + 1}), {}))
        .sort(([a], [b]) => a.localeCompare(b));

    // The namespaces, by the objects they hold: "ns/kind/name" of its namespace, "kind/name" and a bare name of the root one.
    const byNamespace = paths.reduce((acc, p) => {
        const parts = p.split("/");
        const ns = parts.length === 3 ? parts[0] : "root";
        if (kindOf(p) !== "ccfg") acc[ns] = (acc[ns] ?? 0) + 1;
        return acc;
    }, {});
    const busiest = Object.entries(byNamespace).sort(([a, x], [b, y]) => y - x || a.localeCompare(b)).slice(0, SHOWN);

    const storeItems = stores.items ?? [];
    const snapshots = storeItems.reduce((sum, s) => sum + (s.stats?.runs ?? 0), 0);
    const unreached = storeItems.filter((s) => s.stats?.check_error).length;

    const resourcesWarn = (resources.items ?? []).filter((r) => r.data?.status?.status === "warn").length;
    const resourceCounts = {warn: resourcesWarn, other: (resources.items ?? []).length - resourcesWarn};

    return (
        <div className="@container p-4">
            <h1 className="sr-only">{t("clusterView.title")}</h1>
            <div aria-label={t("clusterView.cards")} role="group" className="gap-3 @3xl:columns-2 @6xl:columns-3">
                <Card id="links" icon="heartbeat" title={t("nav.routes.heartbeats")} to="/heartbeats" count={links.length}>
                    {ready ? <Overall links={links}/> : <p className="text-ink-muted">{t("clusterView.reading")}</p>}
                    {heartbeats.length > 0 && (
                        <ul aria-label={t("clusterView.links.heartbeats")} className="flex flex-wrap justify-center gap-x-3 gap-y-1">
                            {heartbeats.map(({hb, state, beating, total}) => (
                                <li key={hb} data-hb={hb} data-state={state}>
                                    {/* Its streams on the heartbeats page. */}
                                    <Link
                                        to={`/heartbeats?${new URLSearchParams({view: "data", id: hb})}`}
                                        title={t("clusterView.links.beating", {beating, total})}
                                        className={`${FILTER_BADGE} font-medium ${HB_INK[state]}`}
                                    >
                                        {hb}
                                        {state !== "up" && <span className="sr-only">{t(`heartbeats.mesh.overall.${state}`)}</span>}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                <Card id="nodes" icon="node" title={t("nav.routes.nodes")} to="/nodes" count={nodes.length}>
                    {ready ? (
                        <CountsRing name="nodes" states={NODE_STATES} counts={nodeCounts} good="optimal" label={t("clusterView.nodes.operational")} words="clusterView.nodes"/>
                    ) : <p className="text-ink-muted">{t("clusterView.reading")}</p>}
                    {frozen > 0 && <p className="text-center text-data text-ink-muted">{t("clusterView.nodes.frozen", {count: frozen})}</p>}
                    <ul aria-label={t("nav.routes.nodes")} className="flex flex-wrap justify-center gap-1.5">
                        {nodes.map(([node, s]) => {
                            const state = nodeState(s);
                            return (
                                <li key={node} data-node={node} data-state={state} className={`inline-flex items-center gap-1 ${NODE_STATES.find(([key]) => key === state)[3]}`}>
                                    <CrossLink kind="node" id={node}>{node}</CrossLink>
                                    {state !== "optimal" && <span className="sr-only">{t(`clusterView.nodes.${state}`)}</span>}
                                    <FrozenMark frozen={Boolean(s?.frozen_at && s.frozen_at !== ZERO_TIME)}/>
                                </li>
                            );
                        })}
                    </ul>
                </Card>

                {/* Its tree, as systemd-cgtop shows the cgroups: the usage tab of the cluster's panel. */}
                <Card id="opensvc" icon="chart" title={t("clusterView.opensvc.title")} to={{search: "?peek=object:cluster&peektab=usage"}}>
                    <OpensvcUsage nodes={nodes.filter(([, s]) => s !== undefined).map(([node]) => node)}/>
                </Card>

                <Card id="arbitrators" icon="cluster" title={t("clusterView.arbitrators.title")} count={arbitrators.length}>
                    {!ready ? <p className="text-ink-muted">{t("clusterView.reading")}</p> : arbitrators.length > 0 ? (
                        <>
                            <CountsRing
                                name="arbitrators"
                                states={ARBITRATOR_STATES}
                                counts={arbitratorCounts}
                                good="up"
                                label={t("clusterView.arbitrators.operational", {count: arbitrators.length})}
                                words="clusterView.arbitrators"
                            />
                            <ul aria-label={t("clusterView.arbitrators.title")} className="flex flex-wrap justify-center gap-x-3 gap-y-1">
                                {arbitrators.map(({name, url, up, total, state}) => (
                                    <li
                                        key={name}
                                        data-arbitrator={name}
                                        data-state={state}
                                        title={[url, t("clusterView.arbitrators.seen", {up, total})].filter(Boolean).join("\n")}
                                        className={`font-medium ${HB_INK[state]}`}
                                    >
                                        {name}
                                        {state !== "up" && <span className="sr-only">{t(`heartbeats.mesh.overall.${state}`)}</span>}
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : tieRisk ? (
                        <p role="alert" data-tie-risk="" className="text-data text-state-warn">{t("clusterView.arbitrators.tieRisk", {count: nodes.length})}</p>
                    ) : <p className="text-data text-ink-muted">{t("clusterView.arbitrators.none")}</p>}
                </Card>

                <Card id="objects" icon="service" title={t("nav.sections.objects")} to="/objects" count={paths.length}>
                    {ready ? (
                        <CountsRing name="objects" states={AVAIL_STATES} counts={avail} good="up" label={t("clusterView.objects.operational")} words="clusterView.objects" link={availUrl}/>
                    ) : <p className="text-ink-muted">{t("clusterView.reading")}</p>}
                    <dl aria-label={t("clusterView.objects.kinds")} className="flex flex-wrap justify-center gap-x-3 text-data">
                        {kinds.map(([kind, n]) => (
                            <div key={kind} className={`relative ${FILTER_BADGE}`}>
                                <dt className="text-ink-muted">{kind}</dt>
                                <dd className="tabular-nums">
                                    <Link
                                        to={objectsUrl({kind})}
                                        title={t("clusterView.objects.ofKind", {kind})}
                                        aria-label={`${t("clusterView.objects.ofKind", {kind})}: ${n}`}
                                        // Static, unlike the card's other links (Card): stretched over the whole badge, not the count alone.
                                        style={{position: "static"}}
                                        className="outline-none after:absolute after:inset-0 after:rounded-full"
                                    >
                                        {n}
                                    </Link>
                                </dd>
                            </div>
                        ))}
                    </dl>
                </Card>

                <Card id="namespaces" icon="namespace" title={t("nav.routes.namespaces")} to="/namespaces" count={Object.keys(byNamespace).length}>
                    <ul aria-label={t("clusterView.namespaces.busiest")} className="space-y-0.5">
                        {busiest.map(([ns, n]) => (
                            <li key={ns} className="flex items-center justify-between gap-2">
                                <CrossLink kind="namespace" id={ns}>{ns}</CrossLink>
                                <Link to={objectsUrl({namespace: ns})} className={`${FILTER_BADGE} text-ink-muted tabular-nums`}>
                                    {t("clusterView.namespaces.objects", {count: n})}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </Card>

                <Card id="networks" icon="network" title={t("nav.routes.networks")} to="/network" count={(networks ?? []).length}>
                    <Fullest items={networks ?? []} kind="network"/>
                </Card>

                <Card id="pools" icon="pool" title={t("nav.routes.pools")} to="/pools" count={(pools ?? []).length}>
                    <Fullest items={pools ?? []} kind="pool"/>
                </Card>

                <Card id="stores" icon="store" title={t("nav.routes.stores")} to="/stores" count={stores.items?.length}>
                    {stores.items === undefined ? <p className="text-ink-muted">{t("clusterView.reading")}</p> : (
                        <>
                            <p className="text-data text-ink-muted">
                                {t("clusterView.stores.snapshots", {count: snapshots})}
                                {unreached > 0 && <span className="text-state-warn">{` · ${t("clusterView.stores.unreached", {count: unreached})}`}</span>}
                            </p>
                            <ul aria-label={t("nav.routes.stores")} className="space-y-0.5">
                                {[...storeItems].sort((a, b) => a.ref.localeCompare(b.ref)).slice(0, SHOWN).map((s) => (
                                    <li key={s.ref} className="flex items-center justify-between gap-2">
                                        <CrossLink kind="store" id={s.ref}>{storeSource(s.ref).name}</CrossLink>
                                        <span className={`text-data tabular-nums ${s.stats?.check_error ? "text-state-warn" : "text-ink-muted"}`}>
                                            {[t("clusterView.stores.snapshots", {count: s.stats?.runs ?? 0}),
                                                s.stats?.last_created_at && t("clusterView.stores.latest", {age: formatAge(s.stats.last_created_at, t, i18n.language)})]
                                                .filter(Boolean).join(" · ")}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </Card>

                <Card id="resources" icon="app" title={t("nav.routes.resources")} to="/resources" count={resources.items?.length}>
                    {resources.error && <p className="text-data text-state-warn">{t("clusterView.resources.unread", {message: resources.error})}</p>}
                    {resources.items === undefined && !resources.error ? <p className="text-ink-muted">{t("clusterView.reading")}</p> : (
                        <CountsRing
                            name="resources"
                            states={RESOURCE_STATES}
                            counts={resourceCounts}
                            good="other"
                            shown="warn"
                            label={t("clusterView.resources.operational")}
                            words="clusterView.resources"
                            // Those in warn on the resources page; the others, of any other state, no filter says.
                            link={(state) => (state === "warn" ? "/resources?status=warn" : undefined)}
                        />
                    )}
                </Card>
            </div>
        </div>
    );
}
