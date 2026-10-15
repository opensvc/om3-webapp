import React, {useCallback, useDeferredValue, useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {retainEventReception} from "../eventSourceManager.jsx";
import EventLogger from "../components/EventLogger";
import useEventStore from "../hooks/useEventStore";
import {useNamespaceClaims, useNamespacePg} from "../hooks/useNamespaceUsage";
import {computeLimit, kindCounts, networkUsage, poolUsage} from "../app/namespace-usage";
import {Table, HeaderRow, SortHeaderCell, Row, Cell, EmptyRow} from "../ui/components/Table";
import {CountPill} from "../ui/components/CountPill";
import {SegmentedBar} from "../ui/components/SegmentedBar";
import {Sparkline} from "../ui/components/Sparkline";
import {HoverCard} from "../ui/components/HoverCard";
import {formatBytes} from "../ui/lib/format";
import {usePanelSearch} from "../app/panel-search";
import {NamespaceDetailPanel} from "./RecordPanels";
import {Pager} from "../ui/components/Pager";
import {usePaging} from "../app/paging";

/** The availabilities a service or volume pill counts, in the order they are shown. */
const AVAILS = [["up", "up"], ["warn", "warn"], ["down", "down"], ["n/a", "na"]];

/** The tab of the Objects page listing a kind, absent for the first one, the services. */
const LIST_OF = {svc: undefined, vol: "volumes", sec: "secrets", cfg: "configs"};

const selectObjectStatus = (state) => state.objectStatus;

const objectsUrl = (namespace, {kind, globalState} = {}) => {
    const params = new URLSearchParams({namespace});
    if (LIST_OF[kind]) params.set("list", LIST_OF[kind]);
    if (globalState) params.set("globalState", globalState);
    return `/objects?${params}`;
};

const totalOf = (byAvail) => Object.values(byAvail ?? {}).reduce((n, c) => n + c, 0);
const last = (values) => (values?.length ? values[values.length - 1] : undefined);

/** A size, "0" rather than nothing for none. */
const size = (bytes, locale) => (bytes > 0 ? formatBytes(bytes, locale) : "0");

/** How much of a total is used, rounded: "<1%" for a little, never "0%" for some. */
const percentOf = (used, total, locale) => {
    if (!(total > 0)) return "–";
    const ratio = used / total;
    if (ratio > 0 && ratio < 0.01) return "<1%";
    return (Math.round(ratio * 100) / 100).toLocaleString(locale, {style: "percent"});
};

/** The figures behind a cell, in its hover card: a title, then a label and a value a line. */
function Figures({title, lines, notes = []}) {
    return (
        <div className="space-y-1.5">
            <p className="font-semibold">{title}</p>
            <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5">
                {lines.map(([label, value]) => (
                    <React.Fragment key={label}>
                        <dt className="text-ink-muted">{label}</dt>
                        <dd className="text-right tabular-nums">{value}</dd>
                    </React.Fragment>
                ))}
            </dl>
            {notes.length > 0 && (
                <ul className="space-y-0.5 border-t border-line pt-1.5">
                    {notes.map((note) => <li key={note}>{note}</li>)}
                </ul>
            )}
        </div>
    );
}

/** The services or volumes of a namespace: a pill per availability, the count in its tint. */
function AvailPills({namespace, kind, counts, onShow}) {
    const {t} = useTranslation();
    const shown = AVAILS.filter(([avail]) => (counts?.[avail] ?? 0) > 0);
    if (shown.length === 0) return <span className="text-ink-muted">–</span>;
    return (
        <span className="inline-flex gap-1">
            {shown.map(([avail, tone]) => (
                <CountPill
                    key={avail}
                    tone={tone}
                    count={counts[avail]}
                    label={t(`namespaces.show.${kind}`, {count: counts[avail], status: avail, namespace})}
                    onClick={() => onShow(objectsUrl(namespace, {kind, globalState: avail}))}
                />
            ))}
        </span>
    );
}

/** The secrets or configurations of a namespace: one grey pill, which have no availability. */
function KindPill({namespace, kind, count, onShow}) {
    const {t} = useTranslation();
    if (!count) return <span className="text-ink-muted">–</span>;
    return (
        <CountPill
            tone="neutral"
            count={count}
            label={t(`namespaces.show.${kind}`, {count, namespace})}
            onClick={() => onShow(objectsUrl(namespace, {kind}))}
        />
    );
}

/**
 * What a namespace holds of the pools or networks, out of what it may hold: the
 * share of the total, the total, and a bar with a segment for each pool or network.
 * Free, used and total, and each pool or network, in the hover card.
 */
function UsageCell({usage, format, title, locale}) {
    const {t} = useTranslation();
    if (usage.segments.length === 0) return <span className="text-ink-muted">–</span>;
    const parts = usage.segments.map((s) => t(s.claimed ? "namespaces.usage.claimed" : "namespaces.usage.unclaimed", {
        name: s.name, used: format(s.used), total: format(s.total), percent: percentOf(s.used, s.total, locale),
    }));
    return (
        <HoverCard
            focusable
            card={
                <Figures
                    title={title}
                    lines={[
                        [t("namespaces.usage.free"), format(usage.free)],
                        [t("namespaces.usage.used"), format(usage.used)],
                        [t("namespaces.usage.total"), format(usage.total)],
                    ]}
                    notes={parts}
                />
            }
        >
            <span className="inline-flex flex-col gap-1">
                <span className="whitespace-nowrap tabular-nums">
                    {t("namespaces.usage.percentOf", {percent: percentOf(usage.used, usage.total, locale), total: format(usage.total)})}
                </span>
                <SegmentedBar
                    segments={usage.segments.map((s) => ({name: s.name, value: s.used}))}
                    total={usage.total}
                    label={`${title}: ${parts.join(", ")}`}
                />
            </span>
        </HoverCard>
    );
}

const NamespaceRow = React.memo(({namespace, counts, pools, networks, cpu, memory, locale, onShow, onOpenMetrics}) => {
    const {t} = useTranslation();
    const cpuUsed = last(cpu.series);
    const memoryUsed = last(memory.series);
    const cpus = (n) => t("namespaces.cpu.count", {count: Number(n.toFixed(2)), value: n.toLocaleString(locale, {maximumFractionDigits: 2})});
    const metricsButton = (content) => (
        <button
            type="button"
            className="inline-flex items-center gap-2 rounded-(--radius-control) text-left hover:underline"
            aria-label={t("namespaces.viewMetrics", {namespace})}
            onClick={(event) => {
                event.stopPropagation();
                onOpenMetrics(namespace);
            }}
        >
            {content}
        </button>
    );
    return (
        <Row onActivate={() => onShow(objectsUrl(namespace))}>
            <Cell className="font-medium">{namespace}</Cell>
            <Cell><AvailPills namespace={namespace} kind="svc" counts={counts.svc} onShow={onShow}/></Cell>
            <Cell><AvailPills namespace={namespace} kind="vol" counts={counts.vol} onShow={onShow}/></Cell>
            <Cell><KindPill namespace={namespace} kind="sec" count={counts.sec} onShow={onShow}/></Cell>
            <Cell><KindPill namespace={namespace} kind="cfg" count={counts.cfg} onShow={onShow}/></Cell>
            <Cell><UsageCell usage={pools} format={(n) => size(n, locale)} title={t("namespaces.columns.pools")} locale={locale}/></Cell>
            <Cell><UsageCell usage={networks} format={(n) => n.toLocaleString(locale)} title={t("namespaces.columns.nets")} locale={locale}/></Cell>
            <Cell>
                <HoverCard card={<Figures title={t("namespaces.columns.cpu")} lines={[
                    [t("namespaces.usage.used"), cpuUsed === undefined ? "–" : cpus(cpuUsed)],
                    [t("namespaces.usage.cap"), cpu.cap === undefined ? t("namespaces.usage.noClaim") : cpus(cpu.cap)],
                    ...(cpu.cap === undefined ? [] : [[t("namespaces.usage.free"), cpus(Math.max(0, cpu.cap - (cpuUsed ?? 0)))]]),
                ]}/>}>
                    {metricsButton(
                        <>
                            <span className="whitespace-nowrap tabular-nums">
                                {cpu.cap === undefined
                                    ? cpuUsed === undefined ? "–" : cpus(cpuUsed)
                                    : t("namespaces.usage.percentOf", {percent: cpuUsed === undefined ? "–" : percentOf(cpuUsed, cpu.cap, locale), total: cpus(cpu.cap)})}
                            </span>
                            <Sparkline values={cpu.series} max={cpu.cap} label={t("namespaces.cpu.trend", {namespace})}/>
                        </>
                    )}
                </HoverCard>
            </Cell>
            <Cell>
                <HoverCard card={<Figures title={t("namespaces.columns.memory")} lines={[
                    [t("namespaces.usage.used"), memoryUsed === undefined ? "–" : size(memoryUsed, locale)],
                    [t("namespaces.usage.cap"), memory.cap === undefined ? t("namespaces.usage.noClaim") : size(memory.cap, locale)],
                    ...(memory.cap === undefined ? [] : [[t("namespaces.usage.free"), size(Math.max(0, memory.cap - (memoryUsed ?? 0)), locale)]]),
                ]}/>}>
                    {metricsButton(
                        <>
                            <span className="whitespace-nowrap tabular-nums">
                                {memory.cap === undefined
                                    ? t("namespaces.memory.used", {used: memoryUsed === undefined ? "–" : size(memoryUsed, locale)})
                                    : t("namespaces.usage.percentOf", {percent: memoryUsed === undefined ? "–" : percentOf(memoryUsed, memory.cap, locale), total: size(memory.cap, locale)})}
                            </span>
                            <Sparkline values={memory.series} max={memory.cap} label={t("namespaces.memory.trend", {namespace})}/>
                        </>
                    )}
                </HoverCard>
            </Cell>
        </Row>
    );
});

/** The value a column sorts a row by. */
const SORT = {
    namespace: (row) => row.namespace,
    services: (row) => totalOf(row.counts.svc),
    volumes: (row) => totalOf(row.counts.vol),
    sec: (row) => row.counts.sec,
    cfg: (row) => row.counts.cfg,
    pools: (row) => row.pools.used,
    nets: (row) => row.networks.used,
    cpu: (row) => last(row.cpu.series) ?? -1,
    memory: (row) => last(row.memory.series) ?? -1,
};

const COLUMNS = ["namespace", "services", "volumes", "sec", "cfg", "pools", "nets", "cpu", "memory"];

/**
 * The namespaces: what each holds, its services and volumes by availability, its
 * secrets and configurations, and what it takes of the cluster, out of what its
 * claims allow: the pools, the networks, the cpu and the memory. `embedded` in a
 * tab of the Objects page, which pads it.
 */
const Namespaces = ({embedded = false}) => {
    const {t, i18n} = useTranslation();
    const navigate = useNavigate();
    const locale = i18n.language;

    const [sortColumn, setSortColumn] = useState("namespace");
    const [sortDirection, setSortDirection] = useState("asc");
    // The namespace whose usage panel is open, in the URL.
    const {sel: metricsNamespace, select: selectNamespace} = usePanelSearch();

    const objectStatus = useEventStore(selectObjectStatus);
    const counts = useMemo(() => kindCounts(objectStatus ?? {}), [objectStatus]);
    const namespaces = useMemo(() => [...counts.keys()].sort(), [counts]);
    const claims = useNamespaceClaims(namespaces);
    const pg = useNamespacePg();

    const deferredSortColumn = useDeferredValue(sortColumn);
    const deferredSortDirection = useDeferredValue(sortDirection);

    const namespaceEventTypes = useMemo(() => [
        'ObjectStatusUpdated',
        'InstanceStatusUpdated',
        'ObjectDeleted',
        'InstanceConfigUpdated'
    ], []);

    useEffect(() => {
        const token = localStorage.getItem("authToken");
        const release = token ? retainEventReception(token, namespaceEventTypes) : null;
        return () => {
            release?.();
        };
    }, [namespaceEventTypes]);

    const rows = useMemo(() => namespaces.map((namespace) => {
        const own = claims.claims[namespace] ?? [];
        return {
            namespace,
            counts: counts.get(namespace),
            pools: poolUsage(namespace, claims.poolsHeld, claims.pools, own),
            networks: networkUsage(namespace, claims.networksHeld, claims.networks, own),
            cpu: {series: pg[namespace]?.cpu ?? [], cap: computeLimit(own, "cpu")},
            memory: {series: pg[namespace]?.memory ?? [], cap: computeLimit(own, "memory")},
        };
    }), [namespaces, counts, claims, pg]);

    const sortedRows = useMemo(() => {
        const key = SORT[deferredSortColumn] ?? SORT.namespace;
        const sorted = [...rows].sort((a, b) => {
            const [x, y] = [key(a), key(b)];
            const diff = typeof x === "string" ? x.localeCompare(y) : x - y;
            // Ties in the order of the names, whatever the direction.
            return diff || a.namespace.localeCompare(b.namespace) * (deferredSortDirection === "asc" ? 1 : -1);
        });
        return deferredSortDirection === "asc" ? sorted : sorted.reverse();
    }, [rows, deferredSortColumn, deferredSortDirection]);

    // The rows of the page shown, as oc3 pages its lists.
    const paging = usePaging("namespaces", sortedRows.length);
    const {page: pageOf, setOffset: setPageOffset} = paging;
    const visibleRows = useMemo(() => pageOf(sortedRows), [pageOf, sortedRows]);

    const handleSort = useCallback((column) => {
        setSortColumn((prev) => {
            if (prev === column) {
                setSortDirection((dir) => (dir === "asc" ? "desc" : "asc"));
                return column;
            }
            setSortDirection("asc");
            return column;
        });
        // Sorted again, the list starts over: from its first page.
        setPageOffset(0);
    }, [setPageOffset]);

    const handleShow = useCallback((url) => navigate(url), [navigate]);
    const handleOpenMetrics = useCallback((namespace) => selectNamespace(namespace), [selectNamespace]);
    const handleCloseMetrics = useCallback(() => selectNamespace(undefined), [selectNamespace]);

    return (
        <div className={embedded ? "flex h-full flex-col gap-3" : "flex h-full flex-col gap-3 p-4"}>
            <Pager paging={paging}/>

            <Table
                sticky
                data-testid="table-container"
                aria-label={t("namespaces.tableLabel")}
                className="min-h-0 flex-1 overflow-auto"
            >
                <thead>
                    <HeaderRow>
                        {COLUMNS.map((column) => (
                            <SortHeaderCell
                                key={column}
                                label={t(`namespaces.columns.${column}`)}
                                active={sortColumn === column}
                                direction={sortDirection}
                                onSort={() => handleSort(column)}
                            />
                        ))}
                    </HeaderRow>
                </thead>
                <tbody>
                    {visibleRows.map((row) => (
                        <NamespaceRow
                            key={row.namespace}
                            {...row}
                            locale={locale}
                            onShow={handleShow}
                            onOpenMetrics={handleOpenMetrics}
                        />
                    ))}
                    {visibleRows.length === 0 && (
                        <EmptyRow colSpan={COLUMNS.length}>
                            <span data-testid="no-namespaces-message">{t("namespaces.empty")}</span>
                        </EmptyRow>
                    )}
                </tbody>
            </Table>
            {claims.error && <p className="text-ink-muted">{t("namespaces.usage.error", {message: claims.error})}</p>}

            <NamespaceDetailPanel name={metricsNamespace ?? undefined} onClose={handleCloseMetrics}/>

            <EventLogger
                eventTypes={namespaceEventTypes}
                title={t("namespaces.eventsLogger")}
                buttonLabel={t("namespaces.events")}
            />
        </div>
    );
};

export default Namespaces;
