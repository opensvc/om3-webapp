import React, {useEffect, useMemo, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import useEventStore from "../hooks/useEventStore.js";
import {RecordPanel} from "../app/RecordPanel";
import {Select} from "../ui/components/Field";
import {parseObjectPath} from "../utils/objectUtils.jsx";
import ObjectDetail from "./ObjectDetails";
import ObjectStatus from "./ObjectStatus";
import ObjectConfig from "./ObjectConfig";
import {ObjectResources, ObjectSchedules} from "./ObjectTabs";
import NetworkDetails from "./NetworkDetails";
import {NamespaceConfig, NamespaceUsage} from "./NamespacePanel";
import {NamespaceClaims} from "./NamespaceClaims";
import {NAMESPACE_LISTS, NamespaceObjects, useNamespaceObjectTabs} from "./NamespaceObjects";
import LogsViewer from "./LogsViewer";
import {OrchestrationLogsFilter} from "./OrchestrationLogsFilter";
import {KEY_KINDS} from "../constants/actions";

/*
 * The record panels, one per kind of record (`peek.ts`), as oc3 gives each object its
 * detail panel. A view opens the panel of its own rows (`sel` in the URL); any view
 * opens any of them over itself (`peek`, see `PeekPanel`). Each takes the id of its
 * record (undefined: closed), the tab open and what changes it, and what closes it.
 */

/**
 * The logs of an instance on one of the nodes the object has instances on, or of
 * one orchestration of it only.
 */
function InstanceLogs({path, nodes, node, onNodeChange, orchestration, onClearOrchestration}) {
    const {t} = useTranslation();
    const {namespace, kind, name} = parseObjectPath(path);
    if (nodes.length === 0) return <p className="py-4 text-center text-ink-muted">{t("panel.logs.noNode")}</p>;
    const shown = nodes.includes(node) ? node : nodes[0];
    return (
        <div className="flex h-[calc(100dvh-10rem)] flex-col gap-2">
            <OrchestrationLogsFilter id={orchestration} onClear={onClearOrchestration}/>
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
                    key={`${shown}/${orchestration}`}
                    nodename={shown}
                    type="instance"
                    namespace={namespace}
                    kind={kind}
                    instanceName={name}
                    height="100%"
                    filters={orchestration ? [`ORCHESTRATION_ID=${orchestration}`] : []}
                />
            </div>
        </div>
    );
}

/**
 * An object. A service or a volume shows its status as `om <path> status` does, with
 * its actions (ObjectStatus), then what its resources report and the tasks scheduled
 * for it on each node (ObjectTabs), then the logs of its instances, then its
 * configuration (ObjectConfig).
 * A configuration, a secret or a user, which om shows no status of, shows its keys
 * (ObjectDetail), then its logs and its configuration, as a service does. The
 * badge of an orchestration in progress opens the logs of that orchestration.
 */
export function ObjectDetailPanel({path, tab, onTabChange, onClose}) {
    const {t} = useTranslation();
    const open = path !== undefined;
    const {kind} = parseObjectPath(path ?? "");
    const keysOnly = KEY_KINDS.includes(kind);
    const instances = useEventStore((s) => (path === undefined ? undefined : s.objectInstanceStatus[path]));
    const nodes = useMemo(() => Object.keys(instances ?? {}).sort(), [instances]);
    const [logsNode, setLogsNode] = useState(null);
    const [logsOrchestration, setLogsOrchestration] = useState(null);
    useEffect(() => {
        setLogsNode(null);
        setLogsOrchestration(null);
    }, [path]);
    const showOrchestrationLogs = (id) => {
        setLogsOrchestration(id);
        onTabChange("logs");
    };

    // An object deleted or purged, from the panel or anywhere else, leaves the
    // store: its panel closes. Only once it was seen there, for an object the store
    // does not hold yet to keep its panel.
    const known = useEventStore((s) => path !== undefined && s.objectStatus?.[path] !== undefined);
    const seen = useRef(false);
    useEffect(() => {
        seen.current = false;
    }, [path]);
    useEffect(() => {
        if (known) seen.current = true;
        else if (seen.current) {
            seen.current = false;
            onClose();
        }
    }, [known, onClose]);

    const tabs = keysOnly
        ? [
            {key: "keys", label: t("panel.tabs.keys")},
            {key: "logs", label: t("panel.tabs.logs")},
            {key: "config", label: t("panel.tabs.config")},
        ]
        : [
            {key: "status", label: t("panel.tabs.status")},
            {key: "resources", label: t("panel.tabs.resources")},
            {key: "schedules", label: t("panel.tabs.schedules")},
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
                            ? <ObjectDetail key={path} path={path} embedded onOrchestrationLogs={showOrchestrationLogs}/>
                            : <ObjectStatus key={path} path={path} onOrchestrationLogs={showOrchestrationLogs}/>}
                    </div>
                    {active === "resources" && <ObjectResources key={path} path={path}/>}
                    {active === "schedules" && <ObjectSchedules key={path} path={path}/>}
                    {active === "logs" && (
                        <InstanceLogs path={path} nodes={nodes} node={logsNode} onNodeChange={setLogsNode}
                                      orchestration={logsOrchestration} onClearOrchestration={() => setLogsOrchestration(null)}/>
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

/**
 * A namespace: what it claims and its objects use, then its configuration object,
 * a tab each. The tab in the URL, as for the other records.
 */
export function NamespaceDetailPanel({name, tab, onTabChange, onClose}) {
    const {t} = useTranslation();
    // Its objects by kind after its usage and claims, its configuration last.
    const kindTabs = useNamespaceObjectTabs(name);
    const tabs = [
        {key: "usage", label: t("namespaces.panel.tabs.usage")},
        {key: "claims", label: t("namespaces.panel.tabs.claims")},
        ...kindTabs,
        {key: "config", label: t("namespaces.panel.tabs.config")},
    ];
    return (
        <RecordPanel
            open={name !== undefined}
            kind="namespace"
            recordId={name}
            title={name ?? ""}
            onClose={onClose}
            tabs={tabs}
            tab={tab}
            onTabChange={onTabChange}
            size="wide"
            closeOnOutsideClick={false}
        >
            {(active) => (active === "config"
                ? <NamespaceConfig key={name} namespace={name}/>
                : active === "claims"
                    ? <NamespaceClaims key={name} namespace={name}/>
                    : NAMESPACE_LISTS.includes(active)
                        ? <NamespaceObjects key={`${name}:${active}`} namespace={name} list={active}/>
                        : <NamespaceUsage key={name} namespace={name}/>)}
        </RecordPanel>
    );
}
