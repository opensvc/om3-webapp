import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {useSearchParams} from "react-router-dom";
import {URL_RESOURCES} from "../config/apiPath.js";
import useEventStore from "../hooks/useEventStore.js";
import {retainEventReception} from "../eventSourceManager";
import {getResponseErrorMessage} from "../services/api.jsx";
import {Table, HeaderRow, HeaderCell, SortHeaderCell, Row, Cell, EmptyRow, LIST_PAGE_FIT, LIST_RAIL_QUERY} from "../ui/components/Table";
import {Alert} from "../ui/components/Alert";
import {Button} from "../ui/components/Button";
import {Checkbox, Select} from "../ui/components/Field";
import {MenuButton} from "../ui/components/MenuButton";
import {Spinner} from "../ui/components/Spinner";
import {StatusMark} from "../ui/components/StatusMark";
import {MoreRows, useRowsOnDemand} from "../ui/components/RowsOnDemand";
import {toObjectState} from "../ui/components/status";
import {BoltIcon, RefreshIcon} from "../ui/icons";
import {actionLabel} from "../constants/actions";
import {actionDescription, explainedMenu} from "../app/action-menu";
import {commonResourceActions, resourceTargets} from "../app/resource-selection";
import {syncVariant} from "./objectActions";
import {actionIcon, useActionRunner} from "./InstanceActions";
import {CrossLink} from "../app/CrossLink";
import {resourceId} from "../app/peek";
import {facetCounts, toggled} from "../app/facets";
import {useMediaQuery} from "../ui/lib/media";
import {FilterRail} from "./FilterRail";
import {InstanceLink} from "./RecordLinks";
import {FilterField, matches} from "./NodePanel";
import {BADGE} from "./ObjectCells";

/*
 * The resources of the cluster, every object on every node, as `om <selector>
 * resource ls` lists them (GET /resource): a line per resource of an instance, its
 * object, its node and its resource each a badge opening its record, the resource
 * on that instance alone. Filtered by words, by status, by node and by driver
 * group, several values of each kept at once; on a wide screen, the filters as facets
 * beside the table, each value counted, in the address too (status, node, group,
 * comma-separated), for a link to open the list filtered. Read again as the
 * instances report.
 * Selected, every one the filters keep or some, the resources are acted on together:
 * an action every one of them takes, posted once per instance.
 * The table scaled down to its room a step at a time, the least missed first: the
 * flags dropped; the label dropped; the type a badge by the resource; the node a
 * badge by the object.
 */

/** A burst of instance reports reads the list once. */
const REREAD_DELAY_MS = 2000;
const EVENTS = ["InstanceStatusUpdated"];
/** The value of a select whose filter keeps several values, from the facets of a wider window. */
const MANY = "\u0000many";

/** The steps of the scaling down: past the last one, the table scrolls sideways. */
export const RESOURCE_LAYOUT_STEPS = 4;

/** What the table shows at a step of its scaling down, 0 the whole of it. */
export const resourceLayout = (step) => ({
    flags: step < 1,
    label: step < 2,
    typeColumn: step < 3,
    nodeColumn: step < 4,
});

/** The columns of a layout, after the checkbox, each the key it sorts by and its title. */
export const resourceColumns = (layout) => [
    {key: "object", labelKey: "resources.columns.object"},
    ...(layout.nodeColumn ? [{key: "node", labelKey: "common.node"}] : []),
    {key: "rid", labelKey: "resources.columns.resource"},
    ...(layout.typeColumn ? [{key: "type", labelKey: "common.type"}] : []),
    {key: "status", labelKey: "common.status"},
    ...(layout.flags ? [{key: "flags", labelKey: "resources.columns.flags"}] : []),
    ...(layout.label ? [{key: "label", labelKey: "resources.columns.label"}] : []),
];

/** The flags of a resource on a node, in words, as the status board marks them. */
const FLAGS = [
    ["disabled", (r) => r.config?.is_disabled || r.status?.disable],
    ["standby", (r) => r.config?.is_standby || r.status?.standby],
    ["monitored", (r) => r.config?.is_monitored || r.status?.monitor],
    ["optional", (r) => r.status?.optional],
    ["encap", (r) => r.status?.encap],
];

/** A line of the list: what is shown and sorted of a resource item. */
export const toLine = (item) => {
    const meta = item?.meta ?? {};
    const data = item?.data ?? {};
    const node = meta.encap_node || meta.node || "";
    return {
        key: `${meta.object}|${meta.node}|${meta.encap_node ?? ""}|${meta.rid}`,
        object: meta.object ?? "",
        node,
        hostNode: meta.node ?? "",
        rid: meta.rid ?? "",
        group: String(meta.rid ?? "").split("#")[0],
        type: data.status?.type ?? "",
        status: data.status?.status ?? "",
        label: data.status?.label ?? "",
        flags: FLAGS.filter(([, test]) => test(data)).map(([name]) => name),
        restarts: data.monitor?.restart?.remaining,
        notProvisioned: data.status?.provisioned?.state === "false",
    };
};

const byText = (key) => (a, b) => String(a[key]).localeCompare(String(b[key]));
const SORTS = {
    object: (a, b) => byText("object")(a, b) || byText("node")(a, b) || byText("rid")(a, b),
    node: (a, b) => byText("node")(a, b) || byText("object")(a, b) || byText("rid")(a, b),
    rid: (a, b) => byText("rid")(a, b) || byText("object")(a, b) || byText("node")(a, b),
    type: (a, b) => byText("type")(a, b) || SORTS.object(a, b),
    status: (a, b) => byText("status")(a, b) || SORTS.object(a, b),
    flags: (a, b) => a.flags.join().localeCompare(b.flags.join()) || SORTS.object(a, b),
    label: (a, b) => byText("label")(a, b) || SORTS.object(a, b),
};

const Resources = () => {
    const {t} = useTranslation();
    const [items, setItems] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [read, setRead] = useState(0);
    const [filter, setFilter] = useState("");
    // The values kept of each filter, none keeping every line: from the address first.
    const [params, setParams] = useSearchParams();
    const fromAddress = (key) => (params.get(key) ?? "").split(",").filter(Boolean);
    const [status, setStatus] = useState(() => fromAddress("status"));
    const [node, setNode] = useState(() => fromAddress("node"));
    const [group, setGroup] = useState(() => fromAddress("group"));
    // Then written back as they change, the other parameters kept: a panel open, say.
    useEffect(() => {
        setParams((prev) => {
            const next = new URLSearchParams(prev);
            for (const [key, values] of [["status", status], ["node", node], ["group", group]]) {
                if (values.length > 0) next.set(key, values.join(","));
                else next.delete(key);
            }
            return next.toString() === prev.toString() ? prev : next;
        }, {replace: true});
    }, [status, node, group, setParams]);
    const hasRail = useMediaQuery(LIST_RAIL_QUERY);
    const [sortColumn, setSortColumn] = useState("object");
    const [sortDirection, setSortDirection] = useState("asc");

    useEffect(() => {
        let live = true;
        setLoading(true);
        fetch(URL_RESOURCES, {
            headers: {Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`},
            cache: "no-cache",
        })
            .then(async (response) => {
                if (!response.ok) throw new Error((await getResponseErrorMessage(response)) || `HTTP ${response.status}`);
                return response.json();
            })
            .then((body) => {
                if (!live) return;
                setItems(Array.isArray(body?.items) ? body.items : []);
                setError("");
            })
            .catch((err) => {
                if (live) setError(err.message);
            })
            .finally(() => {
                if (live) setLoading(false);
            });
        return () => {
            live = false;
        };
    }, [read]);

    // The instances report: the list read again, once a burst of their reports is over.
    useEffect(() => {
        const token = localStorage.getItem("authToken");
        const release = token ? retainEventReception(token, EVENTS) : null;
        return () => release?.();
    }, []);
    const reports = useEventStore((s) => s.objectInstanceStatus);
    const first = useRef(true);
    useEffect(() => {
        if (first.current) {
            first.current = false;
            return undefined;
        }
        const timer = setTimeout(() => setRead((n) => n + 1), REREAD_DELAY_MS);
        return () => clearTimeout(timer);
    }, [reports]);

    const lines = useMemo(() => (items ?? []).map(toLine), [items]);
    const nodes = useMemo(() => [...new Set(lines.map((l) => l.node))].sort(), [lines]);
    const statuses = useMemo(() => [...new Set(lines.map((l) => l.status))].filter(Boolean).sort(), [lines]);
    const groups = useMemo(() => [...new Set(lines.map((l) => l.group))].filter(Boolean).sort(), [lines]);
    const shown = useMemo(() => {
        const sort = SORTS[sortColumn] ?? SORTS.object;
        const keeps = (selected, value) => selected.length === 0 || selected.includes(value);
        return lines
            .filter((l) => keeps(status, l.status)
                && keeps(node, l.node)
                && keeps(group, l.group)
                && matches(filter, l.object, l.rid, l.type, l.label, l.node))
            .sort((a, b) => (sortDirection === "asc" ? sort(a, b) : -sort(a, b)));
    }, [lines, status, node, group, filter, sortColumn, sortDirection]);
    // Beside the table, each value of the filters counted under the others.
    const counts = useMemo(() => (hasRail ? facetCounts(lines, {
        match: (l) => matches(filter, l.object, l.rid, l.type, l.label, l.node),
        facets: {
            status: {selected: status, valuesOf: (l) => (l.status ? [l.status] : [])},
            node: {selected: node, valuesOf: (l) => [l.node]},
            group: {selected: group, valuesOf: (l) => (l.group ? [l.group] : [])},
        },
    }) : null), [hasRail, lines, filter, status, node, group]);
    // The rows drawn as the end of the table nears; a filter or the sort changed, the first ones again.
    const drawn = useRowsOnDemand(shown.length, [status, node, group, filter, sortColumn, sortDirection]);

    // The resources selected, by their line; one a filter hides, or gone, leaves the selection.
    const [selected, setSelected] = useState(() => new Set());
    useEffect(() => {
        const kept = new Set(shown.map((l) => l.key));
        setSelected((prev) => ([...prev].every((key) => kept.has(key)) ? prev : new Set([...prev].filter((key) => kept.has(key)))));
    }, [shown]);
    const selectedLines = useMemo(() => shown.filter((l) => selected.has(l.key)), [shown, selected]);
    const allSelected = shown.length > 0 && selectedLines.length === shown.length;
    const clearSelection = () => setSelected(new Set());
    // All, every resource the filters keep, drawn yet or not; unticked, none.
    const selectAll = (checked) => setSelected(checked ? new Set(shown.map((l) => l.key)) : new Set());
    const toggle = (key) => setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
    });
    const {ask, running, dialogs} = useActionRunner(undefined);
    const actionItems = commonResourceActions(selectedLines).map((a) => {
        const variant = syncVariant(a.name, selectedLines.map((l) => l.type));
        const targets = resourceTargets(selectedLines);
        return {
            key: a.name,
            label: actionLabel(a.name),
            icon: actionIcon(a),
            description: actionDescription(t, "resource", a.name, variant),
            onSelect: () => ask(a.name, {
                targets,
                subject: t("resources.selection.subject", {
                    count: selectedLines.length,
                    instances: t("resources.selection.instances", {count: targets.length}),
                }),
                names: selectedLines.map((l) => `${l.object}@${l.hostNode} ${l.rid}`),
                variant,
                onDone: clearSelection,
            }),
        };
    });

    // Scaled down to its room a step at a time, while it overflows its frame
    // (`resourceLayout`); the page resized, the whole table tried again. The page
    // watched once drawn, after the spinner of the first read.
    const drawnPage = items !== null || error !== "";
    const page = useRef(null);
    const frame = useRef(null);
    const [step, setStep] = useState(0);
    useLayoutEffect(() => {
        const element = frame.current;
        if (element && step < RESOURCE_LAYOUT_STEPS && element.scrollWidth > element.clientWidth + 1) setStep((n) => n + 1);
    });
    useEffect(() => {
        const element = page.current;
        if (!element || typeof ResizeObserver !== "function") return undefined;
        let width = element.clientWidth;
        const observer = new ResizeObserver(() => {
            if (element.clientWidth === width) return;
            width = element.clientWidth;
            setStep(0);
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [drawnPage]);
    const layout = resourceLayout(step);
    const columns = resourceColumns(layout);

    const sortBy = (column) => {
        if (sortColumn === column) setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
        else {
            setSortColumn(column);
            setSortDirection("asc");
        }
    };

    // A filter as a select: all, one value; several kept from the facets of a wider window, said.
    const choice = (label, selected, set, options) => (
        <label className="flex items-center gap-1 text-ink-muted">
            {label}
            <Select
                className="h-7"
                value={selected.length === 0 ? "" : selected.length === 1 ? selected[0] : MANY}
                onChange={(e) => set(e.target.value === "" ? [] : [e.target.value])}
            >
                <option value="">{t("resources.all")}</option>
                {selected.length > 1 && <option value={MANY} disabled>{t("resources.chosen", {count: selected.length})}</option>}
                {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
        </label>
    );
    const facet = (key, label, selected, set, options, mark) => ({
        label,
        options: options.map((value) => ({value, text: value, mark: mark?.(value)})),
        selected,
        counts: counts?.[key] ?? {},
        onToggle: (value) => set((prev) => toggled(prev, value)),
        onClear: () => set([]),
    });
    const refresh = (
        <Button
            size="sm"
            icon={<RefreshIcon className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"}/>}
            onClick={() => setRead((n) => n + 1)}
        >
            {t("resources.refresh")}
        </Button>
    );
    const count = <span className="text-ink-muted tabular-nums">{t("resources.count", {shown: shown.length, total: lines.length})}</span>;
    // Nothing selected, nothing to act on: how to select, in the place of the actions.
    const actions = selectedLines.length > 0 ? (
        <>
            <span className="whitespace-nowrap text-ink-muted">{t("common.selected", {count: selectedLines.length})}</span>
            <Button size="sm" onClick={clearSelection}>{t("resources.selection.clear")}</Button>
            <MenuButton
                // The actions: a solid pill.
                prominent
                icon={<BoltIcon className="h-3.5 w-3.5"/>}
                label={t("resources.selection.actions")}
                disabled={running || actionItems.length === 0}
                {...explainedMenu(t, "resource", actionItems)}
            />
        </>
    ) : <span className="text-ink-muted">{t("resources.selection.hint")}</span>;

    if (items === null && error === "") {
        return <div className="flex justify-center py-8"><Spinner label={t("resources.loading")}/></div>;
    }

    return (
        <div ref={page} className={`flex h-full gap-6 p-4 ${LIST_PAGE_FIT}`}>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
                {/* Wide, the tools at the head of the rail and the filters in it: their rows to the table. */}
                {!hasRail && (
                    <div className="flex flex-wrap items-center gap-3">
                        {choice(t("common.status"), status, setStatus, statuses)}
                        {choice(t("common.node"), node, setNode, nodes)}
                        {choice(t("resources.group"), group, setGroup, groups)}
                        {count}
                        {/* The words filter, at the right end, as on the other lists. */}
                        <FilterField label={t("resources.filter")} value={filter} onChange={setFilter}/>
                        {refresh}
                        <span className="ml-auto flex items-center gap-3">{actions}</span>
                    </div>
                )}
                {error && (
                    <Alert action={<Button size="sm" onClick={() => setRead((n) => n + 1)}>{t("common.retry")}</Button>}>
                        {t("resources.loadError", {message: error})}
                    </Alert>
                )}
                <Table ref={frame} sticky aria-label={t("resources.caption")} className="min-h-0 flex-1">
                    <thead>
                        <HeaderRow>
                            <HeaderCell className="w-8">
                                <Checkbox
                                    checked={allSelected}
                                    onChange={(e) => selectAll(e.target.checked)}
                                    aria-label={t("resources.selection.all")}
                                />
                            </HeaderCell>
                            {columns.map(({key, labelKey}) => (
                                <SortHeaderCell
                                    key={key}
                                    label={t(labelKey)}
                                    active={sortColumn === key}
                                    direction={sortDirection}
                                    onSort={() => sortBy(key)}
                                />
                            ))}
                        </HeaderRow>
                    </thead>
                    <tbody>
                        {drawn.rows(shown).map((l) => (
                            <Row key={l.key}>
                                <Cell className="w-8">
                                    <Checkbox
                                        checked={selected.has(l.key)}
                                        onChange={() => toggle(l.key)}
                                        aria-label={t("resources.selection.one", {rid: l.rid, path: l.object, node: l.node})}
                                    />
                                </Cell>
                                <Cell className="whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1.5">
                                        <CrossLink kind="object" id={l.object}>{l.object}</CrossLink>
                                        {/* No room for its column, the node a badge by the object, opening the instance (resourceLayout). */}
                                        {!layout.nodeColumn && <InstanceLink path={l.object} node={l.hostNode} label={l.node}/>}
                                    </span>
                                </Cell>
                                {layout.nodeColumn && <Cell className="whitespace-nowrap"><InstanceLink path={l.object} node={l.hostNode} label={l.node}/></Cell>}
                                <Cell className="whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1.5">
                                        <CrossLink kind="resource" id={resourceId(l.object, l.rid, l.hostNode)}>{l.rid}</CrossLink>
                                        {/* No room for its column, the type a badge by the resource (resourceLayout). */}
                                        {!layout.typeColumn && l.type && <span className={BADGE} title={t("common.type")}>{l.type}</span>}
                                    </span>
                                </Cell>
                                {layout.typeColumn && <Cell className="text-ink-muted">{l.type}</Cell>}
                                <Cell className="whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1.5">
                                        <StatusMark state={toObjectState(l.status)} label={l.status || t("instance.unknown")}/>
                                        {l.status || "-"}
                                        {l.notProvisioned && <span className="text-state-warn">{t("resources.notProvisioned")}</span>}
                                    </span>
                                </Cell>
                                {/* On one line, and the label no narrower than a few words: not fitting, dropped (resourceLayout). */}
                                {layout.flags && <Cell className="whitespace-nowrap text-ink-muted">
                                    {[
                                        ...l.flags.map((f) => t(`resources.flags.${f}`)),
                                        ...(l.restarts === undefined ? [] : [t("resources.restarts", {count: l.restarts})]),
                                    ].join(", ") || "-"}
                                </Cell>}
                                {layout.label && <Cell className="min-w-40 break-all">{l.label}</Cell>}
                            </Row>
                        ))}
                        <MoreRows rows={drawn} colSpan={columns.length + 1}/>
                        {shown.length === 0 && (
                            <EmptyRow colSpan={columns.length + 1}>{lines.length === 0 ? t("resources.empty") : t("resources.noMatch")}</EmptyRow>
                        )}
                    </tbody>
                </Table>
            </div>
            {hasRail && (
                <FilterRail
                    label={t("resources.rail")}
                    head={(
                        <>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">{refresh}{count}</div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">{actions}</div>
                        </>
                    )}
                    search={filter}
                    onSearch={(e) => setFilter(e.target.value)}
                    searchLabel={t("resources.filter")}
                    facets={[
                        facet("status", t("common.status"), status, setStatus, statuses,
                            (value) => <StatusMark state={toObjectState(value)} label={value}/>),
                        facet("node", t("common.node"), node, setNode, nodes),
                        facet("group", t("resources.group"), group, setGroup, groups),
                    ]}
                />
            )}
            {dialogs}
        </div>
    );
};

export default Resources;
