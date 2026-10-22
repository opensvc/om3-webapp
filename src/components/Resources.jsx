import React, {useEffect, useMemo, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {URL_RESOURCE} from "../config/apiPath.js";
import useEventStore from "../hooks/useEventStore.js";
import {retainEventReception} from "../eventSourceManager";
import {getResponseErrorMessage} from "../services/api.jsx";
import {Table, HeaderRow, SortHeaderCell, Row, Cell, EmptyRow} from "../ui/components/Table";
import {Alert} from "../ui/components/Alert";
import {Button} from "../ui/components/Button";
import {Select} from "../ui/components/Field";
import {Spinner} from "../ui/components/Spinner";
import {StatusMark} from "../ui/components/StatusMark";
import {Pager} from "../ui/components/Pager";
import {toObjectState} from "../ui/components/status";
import {RefreshIcon} from "../ui/icons";
import {CrossLink} from "../app/CrossLink";
import {resourceId} from "../app/peek";
import {useLocalPaging} from "../app/paging";
import {InstanceLink} from "./RecordLinks";
import {FilterField, matches} from "./NodePanel";

/*
 * The resources of the cluster, every object on every node, as `om <selector>
 * resource ls` lists them (GET /resource): a line per resource of an instance, its
 * object, its node and its resource each a badge opening its record, the resource
 * on that instance alone. Filtered by words, by status, by node and by driver
 * group; read again as the instances report.
 */

/** Every object: an unfiltered read is refused by some daemons, a selector of all is not. */
const ALL = "*";
/** A burst of instance reports reads the list once. */
const REREAD_DELAY_MS = 2000;
const EVENTS = ["InstanceStatusUpdated"];

const COLUMNS = [
    {key: "object", labelKey: "resources.columns.object"},
    {key: "node", labelKey: "common.node"},
    {key: "rid", labelKey: "resources.columns.resource"},
    {key: "type", labelKey: "common.type"},
    {key: "status", labelKey: "common.status"},
    {key: "flags", labelKey: "resources.columns.flags"},
    {key: "label", labelKey: "resources.columns.label"},
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
    const [status, setStatus] = useState("");
    const [node, setNode] = useState("");
    const [group, setGroup] = useState("");
    const [sortColumn, setSortColumn] = useState("object");
    const [sortDirection, setSortDirection] = useState("asc");

    useEffect(() => {
        let live = true;
        setLoading(true);
        fetch(`${URL_RESOURCE}?path=${encodeURIComponent(ALL)}`, {
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
        return lines
            .filter((l) => (status === "" || l.status === status)
                && (node === "" || l.node === node)
                && (group === "" || l.group === group)
                && matches(filter, l.object, l.rid, l.type, l.label, l.node))
            .sort((a, b) => (sortDirection === "asc" ? sort(a, b) : -sort(a, b)));
    }, [lines, status, node, group, filter, sortColumn, sortDirection]);
    const paging = useLocalPaging("resources", shown.length);
    // A filter changed: back to the first page.
    useEffect(() => paging.setOffset(0), [status, node, group, filter]); // eslint-disable-line react-hooks/exhaustive-deps

    const sortBy = (column) => {
        if (sortColumn === column) setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
        else {
            setSortColumn(column);
            setSortDirection("asc");
        }
    };

    const choice = (label, value, set, options) => (
        <label className="flex items-center gap-1 text-ink-muted">
            {label}
            <Select className="h-7" value={value} onChange={(e) => set(e.target.value)}>
                <option value="">{t("resources.all")}</option>
                {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
        </label>
    );

    if (items === null && error === "") {
        return <div className="flex justify-center py-8"><Spinner label={t("resources.loading")}/></div>;
    }

    return (
        <div className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
                {choice(t("common.status"), status, setStatus, statuses)}
                {choice(t("common.node"), node, setNode, nodes)}
                {choice(t("resources.group"), group, setGroup, groups)}
                <span className="text-ink-muted tabular-nums">{t("resources.count", {shown: shown.length, total: lines.length})}</span>
                {/* The words filter, at the right end, as on the other lists. */}
                <FilterField label={t("resources.filter")} value={filter} onChange={setFilter}/>
                <Button
                    size="sm"
                    icon={<RefreshIcon className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"}/>}
                    onClick={() => setRead((n) => n + 1)}
                >
                    {t("resources.refresh")}
                </Button>
            </div>
            {error && (
                <Alert action={<Button size="sm" onClick={() => setRead((n) => n + 1)}>{t("common.retry")}</Button>}>
                    {t("resources.loadError", {message: error})}
                </Alert>
            )}
            <Pager paging={paging}/>
            <Table sticky aria-label={t("resources.caption")}>
                <thead>
                    <HeaderRow>
                        {COLUMNS.map(({key, labelKey}) => (
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
                    {paging.page(shown).map((l) => (
                        <Row key={l.key}>
                            <Cell className="whitespace-nowrap"><CrossLink kind="object" id={l.object}>{l.object}</CrossLink></Cell>
                            <Cell className="whitespace-nowrap"><InstanceLink path={l.object} node={l.hostNode} label={l.node}/></Cell>
                            <Cell className="whitespace-nowrap">
                                <CrossLink kind="resource" id={resourceId(l.object, l.rid, l.hostNode)}>{l.rid}</CrossLink>
                            </Cell>
                            <Cell className="text-ink-muted">{l.type}</Cell>
                            <Cell className="whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5">
                                    <StatusMark state={toObjectState(l.status)} label={l.status || t("instance.unknown")}/>
                                    {l.status || "-"}
                                    {l.notProvisioned && <span className="text-state-warn">{t("resources.notProvisioned")}</span>}
                                </span>
                            </Cell>
                            <Cell className="text-ink-muted">
                                {[
                                    ...l.flags.map((f) => t(`resources.flags.${f}`)),
                                    ...(l.restarts === undefined ? [] : [t("resources.restarts", {count: l.restarts})]),
                                ].join(", ") || "-"}
                            </Cell>
                            <Cell className="break-all">{l.label}</Cell>
                        </Row>
                    ))}
                    {shown.length === 0 && (
                        <EmptyRow colSpan={COLUMNS.length}>{lines.length === 0 ? t("resources.empty") : t("resources.noMatch")}</EmptyRow>
                    )}
                </tbody>
            </Table>
        </div>
    );
};

export default Resources;
