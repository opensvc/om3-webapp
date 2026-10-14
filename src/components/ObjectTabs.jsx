import React, {useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {URL_OBJECT} from "../config/apiPath.js";
import {parseObjectPath} from "../utils/objectUtils.jsx";
import {Table, HeaderRow, HeaderCell, Row, Cell} from "../ui/components/Table";
import {RelativeTime} from "../ui/components/RelativeTime";
import {DataTable, FilterField, Loaded, Section, isSet, matches, useApiResource} from "./NodePanel";

/*
 * Tabs of the object panel, read from the daemon API as om reads them: the daemon
 * answers for all the instances of the object, each item telling its node.
 */

const objectUrl = (path, suffix) => {
    const {namespace, kind, name} = parseObjectPath(path);
    return `${URL_OBJECT}/${[namespace, kind, name].map(encodeURIComponent).join("/")}/${suffix}`;
};

/** A list long enough to need a filter. */
const FILTER_FROM = 10;

/** The tasks the daemon schedules for the object, on each node (`om <path> schedule list`). */
export function ObjectSchedules({path}) {
    const {t, i18n} = useTranslation();
    const schedules = useApiResource(objectUrl(path, "schedule"));
    const [filter, setFilter] = useState("");
    const when = (value) => (isSet(value) ? <RelativeTime value={value} locale={i18n.language}/> : "–");
    const requirements = (s) => [
        s.require,
        s.require_collector ? t("nodePanel.schedules.collector") : "",
        s.require_provisioned ? t("nodePanel.schedules.provisioned") : "",
    ].filter(Boolean).join(", ");

    // Each item is one task on one node: by task, then by node.
    const all = useMemo(
        () => (schedules.data?.items ?? [])
            .map((item) => ({...item.data, node: item.meta?.node ?? ""}))
            .sort((a, b) => String(a.action).localeCompare(String(b.action)) || a.node.localeCompare(b.node)),
        [schedules.data],
    );
    const rows = all.filter((s) => matches(filter, s.action, s.node, s.schedule, s.key));

    return (
        <div className="space-y-2">
            {all.length >= FILTER_FROM && (
                <div className="flex">
                    <FilterField label={t("objectTabs.schedules.filter")} value={filter} onChange={setFilter}/>
                </div>
            )}
            <Loaded resource={schedules}>
                <DataTable
                    label={t("panel.tabs.schedules")}
                    rowKey={(s) => `${s.node}/${s.key}`}
                    rows={rows}
                    empty={t("objectTabs.schedules.none")}
                    columns={[
                        {key: "action", label: t("nodePanel.columns.action"), className: "font-medium"},
                        {key: "node", label: t("common.node")},
                        {key: "schedule", label: t("nodePanel.columns.schedule"), className: "font-mono text-data", render: (s) => s.schedule || t("nodePanel.schedules.unscheduled")},
                        {key: "last_run_at", label: t("nodePanel.columns.lastRun"), render: (s) => when(s.last_run_at)},
                        {key: "next_run_at", label: t("nodePanel.columns.nextRun"), render: (s) => when(s.next_run_at)},
                        {key: "require", label: t("nodePanel.columns.requires"), className: "text-ink-muted", render: requirements},
                        {key: "key", label: t("nodePanel.columns.keyword"), className: "font-mono text-data text-ink-muted"},
                    ]}
                />
            </Loaded>
        </div>
    );
}

/**
 * What the resources of the object report on each node (`om <path> resource info
 * list`): a table per resource, a line per key, a column per node, for the values
 * of the nodes to be compared at a glance.
 */
export function ObjectResources({path}) {
    const {t} = useTranslation();
    const info = useApiResource(objectUrl(path, "resource/info"));
    const [filter, setFilter] = useState("");

    const items = useMemo(() => info.data?.items ?? [], [info.data]);
    const nodes = useMemo(() => [...new Set(items.map((i) => i.node))].sort(), [items]);
    // rid → key → node → value, the resources and their keys in their order.
    const resources = useMemo(() => {
        const byRid = new Map();
        for (const {rid, key, node, value} of items) {
            if (!byRid.has(rid)) byRid.set(rid, new Map());
            const keys = byRid.get(rid);
            if (!keys.has(key)) keys.set(key, {});
            keys.get(key)[node] = value;
        }
        return [...byRid.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([rid, keys]) => ({rid, keys: [...keys.entries()].sort(([a], [b]) => a.localeCompare(b))}));
    }, [items]);

    // A resource whose name matches shows all its keys; otherwise, the keys that match.
    const shown = resources
        .map(({rid, keys}) => ({
            rid,
            keys: matches(filter, rid) ? keys : keys.filter(([key, values]) => matches(filter, key, ...Object.values(values))),
        }))
        .filter(({keys}) => keys.length > 0);

    return (
        <div className="space-y-6">
            {resources.length > 0 && (
                <div className="flex">
                    <FilterField label={t("objectTabs.resources.filter")} value={filter} onChange={setFilter}/>
                </div>
            )}
            <Loaded resource={info}>
                {resources.length === 0 && <p className="text-ink-muted">{t("objectTabs.resources.none")}</p>}
                {resources.length > 0 && shown.length === 0 && <p className="text-ink-muted">{t("objectTabs.resources.noMatch")}</p>}
                {shown.map(({rid, keys}) => (
                    <Section key={rid} id={`object-resource-${path}-${rid}`} title={rid} count={keys.length}>
                        <Table aria-label={rid}>
                            <thead>
                            <HeaderRow>
                                <HeaderCell>{t("objectTabs.resources.key")}</HeaderCell>
                                {nodes.map((node) => <HeaderCell key={node}>{node}</HeaderCell>)}
                            </HeaderRow>
                            </thead>
                            <tbody>
                            {keys.map(([key, values]) => (
                                <Row key={key}>
                                    <Cell className="font-medium">{key}</Cell>
                                    {nodes.map((node) => (
                                        <Cell key={node} className="font-mono text-data break-all">
                                            {values[node] ?? <span className="text-ink-muted">–</span>}
                                        </Cell>
                                    ))}
                                </Row>
                            ))}
                            </tbody>
                        </Table>
                    </Section>
                ))}
            </Loaded>
        </div>
    );
}
