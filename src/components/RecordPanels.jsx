import React, {useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import useEventStore from "../hooks/useEventStore.js";
import {RecordPanel} from "../app/RecordPanel";
import {Select} from "../ui/components/Field";
import {parseObjectPath} from "../utils/objectUtils.jsx";
import ObjectDetail from "./ObjectDetails";
import ObjectStatus from "./ObjectStatus";
import ObjectConfig from "./ObjectConfig";
import NetworkDetails from "./NetworkDetails";
import NamespaceMetrics from "./NamespaceMetrics";
import LogsViewer from "./LogsViewer";

/*
 * The record panels, one per kind of record (`peek.ts`), as oc3 gives each object its
 * detail panel. A view opens the panel of its own rows (`sel` in the URL); any view
 * opens any of them over itself (`peek`, see `PeekPanel`). Each takes the id of its
 * record (undefined: closed), the tab open and what changes it, and what closes it.
 */

/** Kinds without instances to act on nor logs to read: their keys are the record. */
const KEY_KINDS = ["cfg", "sec", "usr"];

/** The logs of an instance on one of the nodes the object has instances on. */
function InstanceLogs({path, nodes, node, onNodeChange}) {
    const {t} = useTranslation();
    const {namespace, kind, name} = parseObjectPath(path);
    if (nodes.length === 0) return <p className="py-4 text-center text-ink-muted">{t("panel.logs.noNode")}</p>;
    const shown = nodes.includes(node) ? node : nodes[0];
    return (
        <div className="flex h-[calc(100dvh-10rem)] flex-col gap-2">
            {nodes.length > 1 && (
                <label className="flex items-center gap-2 text-ink-muted">
                    {t("common.node")}
                    <Select className="h-7 w-auto" value={shown} onChange={(e) => onNodeChange(e.target.value)}>
                        {nodes.map((n) => <option key={n} value={n}>{n}</option>)}
                    </Select>
                </label>
            )}
            <div className="min-h-0 flex-1">
                <LogsViewer
                    key={shown}
                    nodename={shown}
                    type="instance"
                    namespace={namespace}
                    kind={kind}
                    instanceName={name}
                    height="100%"
                />
            </div>
        </div>
    );
}

/**
 * An object. A service or a volume shows its status as `om <path> status` does, with
 * its actions (ObjectStatus), then the logs of its instances, then its configuration
 * (ObjectConfig).
 * A configuration, a secret or a user, which om shows no status of, shows its keys
 * (ObjectDetail), then its configuration, as a service does.
 */
export function ObjectDetailPanel({path, tab, onTabChange, onClose}) {
    const {t} = useTranslation();
    const open = path !== undefined;
    const {kind} = parseObjectPath(path ?? "");
    const keysOnly = KEY_KINDS.includes(kind);
    const instances = useEventStore((s) => (path === undefined ? undefined : s.objectInstanceStatus[path]));
    const nodes = useMemo(() => Object.keys(instances ?? {}).sort(), [instances]);
    const [logsNode, setLogsNode] = useState(null);
    useEffect(() => setLogsNode(null), [path]);

    const tabs = keysOnly
        ? [
            {key: "keys", label: t("panel.tabs.keys")},
            {key: "config", label: t("panel.tabs.config")},
        ]
        : [
            {key: "status", label: t("panel.tabs.status")},
            {key: "logs", label: t("panel.tabs.logs")},
            {key: "config", label: t("panel.tabs.config")},
        ];

    return (
        <RecordPanel
            open={open}
            kind="object"
            recordId={path}
            title={path ?? ""}
            onClose={onClose}
            tabs={tabs}
            tab={tab}
            onTabChange={onTabChange}
            closeOnOutsideClick={false}
        >
            {(active) => (
                <>
                    {/* Kept mounted under the other tabs: its stream and its state hold. */}
                    <div hidden={active !== tabs[0].key}>
                        {keysOnly
                            ? <ObjectDetail key={path} path={path} embedded/>
                            : <ObjectStatus key={path} path={path}/>}
                    </div>
                    {active === "logs" && (
                        <InstanceLogs path={path} nodes={nodes} node={logsNode} onNodeChange={setLogsNode}/>
                    )}
                    {active === "config" && <ObjectConfig path={path}/>}
                </>
            )}
        </RecordPanel>
    );
}

/** A network: the addresses it hands out. */
export function NetworkDetailPanel({name, onClose}) {
    return (
        <RecordPanel open={name !== undefined} kind="network" recordId={name} title={name ?? ""} onClose={onClose} size="wide">
            {() => <NetworkDetails key={name} name={name} embedded/>}
        </RecordPanel>
    );
}

/** A namespace: the resources its objects use. */
export function NamespaceDetailPanel({name, onClose}) {
    const {t} = useTranslation();
    return (
        <RecordPanel
            open={name !== undefined}
            kind="namespace"
            recordId={name}
            title={name === undefined ? "" : t("namespaces.metricsOf", {namespace: name})}
            onClose={onClose}
            size="wide"
        >
            {() => <NamespaceMetrics key={name} namespace={name}/>}
        </RecordPanel>
    );
}
