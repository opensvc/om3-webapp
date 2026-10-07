import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useParams, useNavigate} from "react-router-dom";
import {Alert} from "../ui/components/Alert";
import {IconButton} from "../ui/components/Button";
import {MenuButton} from "../ui/components/MenuButton";
import {SlideOver} from "../ui/components/SlideOver";
import {Spinner} from "../ui/components/Spinner";
import {CloseIcon} from "../ui/icons";
import useEventStore from "../hooks/useEventStore.js";
import {closeEventSource, startEventReception} from "../eventSourceManager.jsx";
import {URL_NODE, URL_OBJECT} from "../config/apiPath.js";
import {getResponseErrorMessage} from "../services/api.jsx";
import ActionDialogManager from "../components/ActionDialogManager";
import HeaderSection from "./HeaderSection";
import ConfigSection from "./ConfigSection";
import KeysSection from "./KeysSection";
import InstanceCard from "./InstanceCard.jsx";
import LogsViewer from "./LogsViewer";
import {INSTANCE_ACTIONS, OBJECT_ACTIONS} from "../constants/actions";
import {parseObjectPath} from "../utils/objectUtils.jsx";
import EventLogger from "../components/EventLogger";
import logger from "../utils/logger";

const DEFAULT_CHECKBOXES = {failover: false};
const DEFAULT_STOP_CHECKBOX = false;
const DEFAULT_UNPROVISION_CHECKBOXES = {dataLoss: false, serviceInterruption: false};
const DEFAULT_PURGE_CHECKBOXES = {dataLoss: false, configLoss: false, serviceInterruption: false};

/** The feedback message hides itself after a while, as the snackbar did. */
const FEEDBACK_DURATION_MS = 5000;
const TONES = {info: "info", success: "success", warning: "warning", error: "error"};

/** Icon of an action in a menu: the action icons are sized to the menu line. */
const ICON = "flex h-4 w-4 items-center justify-center text-ink-muted [&>svg]:h-4! [&>svg]:w-4!";
const DANGER_ICON = "flex h-4 w-4 items-center justify-center text-state-down [&>svg]:h-4! [&>svg]:w-4!";

const PANEL = "rounded-(--radius-panel) border border-line bg-surface-raised";

const capitalize = (name) => name.charAt(0).toUpperCase() + name.slice(1);

const ZERO_TIME = "0001-01-01T00:00:00Z";
const hasTimestamp = (v) => !!v && v !== ZERO_TIME;

export const getResourceType = (rid, nodeData) => {
    if (!rid || !nodeData) return '';
    const topLevelType = nodeData?.resources?.[rid]?.type;
    if (topLevelType) return topLevelType;
    const encapData = nodeData?.encap || {};
    for (const containerId of Object.keys(encapData)) {
        const encapType = encapData[containerId]?.resources?.[rid]?.type;
        if (encapType) return encapType;
    }
    return '';
};

export const parseProvisionedState = (state) => {
    if (typeof state === "string") return state.toLowerCase() === "true";
    return !!state;
};

const ObjectDetail = () => {
    const {objectName} = useParams();
    const decodedObjectName = decodeURIComponent(objectName);
    const {namespace, kind, name} = parseObjectPath(decodedObjectName);
    const navigate = useNavigate();

    const objectStatus = useEventStore((s) => s.objectStatus[decodedObjectName]);
    const objectInstanceStatus = useEventStore((s) => s.objectInstanceStatus[decodedObjectName]);
    const instanceMonitor = useEventStore((s) => s.instanceMonitor);
    const instanceConfig = useEventStore((s) => s.instanceConfig[decodedObjectName]);

    const [configNode, setConfigNode] = useState(/** @type {string | null} */ (null));
    const [configDialogOpen, setConfigDialogOpen] = useState(false);
    const [configRefreshTrigger, setConfigRefreshTrigger] = useState(0);

    const [selectedNodes, setSelectedNodes] = useState(/** @type {string[]} */ ([]));

    const [pendingAction, setPendingAction] = useState(/** @type {any} */ (null));
    const [actionInProgress, setActionInProgress] = useState(false);

    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [stopDialogOpen, setStopDialogOpen] = useState(false);
    const [unprovisionDialogOpen, setUnprovisionDialogOpen] = useState(false);
    const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
    const [simpleDialogOpen, setSimpleDialogOpen] = useState(false);
    const [checkboxes, setCheckboxes] = useState(DEFAULT_CHECKBOXES);
    const [stopCheckbox, setStopCheckbox] = useState(DEFAULT_STOP_CHECKBOX);
    const [unprovisionCheckboxes, setUnprovisionCheckboxes] = useState(DEFAULT_UNPROVISION_CHECKBOXES);
    const [purgeCheckboxes, setPurgeCheckboxes] = useState(DEFAULT_PURGE_CHECKBOXES);
    const [snackbar, setSnackbar] = useState({open: false, message: "", severity: "success"});

    const [initialLoading, setInitialLoading] = useState(true);
    const [initialDataError, setInitialDataError] = useState(/** @type {string | null} */ (null));

    const [logsDrawerOpen, setLogsDrawerOpen] = useState(false);
    const [selectedNodeForLogs, setSelectedNodeForLogs] = useState(/** @type {string | null} */ (null));
    const [selectedInstanceForLogs, setSelectedInstanceForLogs] = useState(/** @type {string | null} */ (null));

    const objectEventTypes = useMemo(() => [
        "ObjectStatusUpdated",
        "InstanceStatusUpdated",
        "ObjectDeleted",
        "InstanceMonitorUpdated",
        "InstanceConfigUpdated",
        "InstanceConfigDeleted",
        "CONNECTION_OPENED",
        "CONNECTION_ERROR",
        "RECONNECTION_ATTEMPT",
        "MAX_RECONNECTIONS_REACHED",
        "CONNECTION_CLOSED"
    ], []);

    const fallbackTimer = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
    const hasFallbackFired = useRef(false);
    const [fallbackCompleted, setFallbackCompleted] = useState(false);

    const objectData = useMemo(() => {
        const avail = objectStatus?.avail || "n/a";
        const frozen = objectStatus?.frozen === "frozen" ? "frozen" : "unfrozen";
        let globalExpect = null;
        let hasAnyNodeStopped = false;
        let hasAnyNodeLagging = false;

        if (objectInstanceStatus) {
            for (const node of Object.keys(objectInstanceStatus)) {
                const monitorKey = `${node}:${decodedObjectName}`;
                const monitor = instanceMonitor[monitorKey] || {};
                if (!globalExpect && monitor.global_expect && monitor.global_expect !== "none") {
                    globalExpect = monitor.global_expect;
                }
                const ns = objectInstanceStatus[node] || {};
                if (hasTimestamp(ns.stopped_at)) hasAnyNodeStopped = true;
                if (hasTimestamp(ns.rpo_breached_at)) hasAnyNodeLagging = true;
            }
        }
        return {avail, frozen, globalExpect, hasAnyNodeStopped, hasAnyNodeLagging};
    }, [objectStatus, objectInstanceStatus, instanceMonitor, decodedObjectName]);

    const nodesList = useMemo(() => {
        if (!objectInstanceStatus) return [];
        return Object.keys(objectInstanceStatus).sort();
    }, [objectInstanceStatus]);

    const memoizedObjectData = useMemo(() => {
        if (!objectInstanceStatus) return {};
        const enhanced = {};
        Object.keys(objectInstanceStatus).forEach(node => {
            enhanced[node] = {
                ...objectInstanceStatus[node],
                instanceConfig: instanceConfig?.[node] || {resources: {}},
                instanceMonitor: instanceMonitor[`${node}:${decodedObjectName}`] || {resources: {}},
            };
        });
        return enhanced;
    }, [objectInstanceStatus, instanceConfig, instanceMonitor, decodedObjectName]);

    const fetchFallbackData = useCallback(async () => {
        if (hasFallbackFired.current) return;
        hasFallbackFired.current = true;

        const token = localStorage.getItem("authToken");
        if (!token) {
            setInitialDataError("Auth token not found");
            setInitialLoading(false);
            setFallbackCompleted(true);
            return;
        }

        const {namespace, kind, name: objName} = parseObjectPath(decodedObjectName);
        const encodedNamespace = encodeURIComponent(namespace);
        const encodedKind = encodeURIComponent(kind);
        const encodedName = encodeURIComponent(objName);

        try {
            const objRes = await fetch(
                `${URL_OBJECT}/${encodedNamespace}/${encodedKind}/${encodedName}`,
                {headers: {Authorization: `Bearer ${token}`}, cache: "no-cache"}
            );
            let objectData = null;
            if (objRes.ok) objectData = await objRes.json();

            const instRes = await fetch(
                `${URL_NODE}/all/instance/path/${encodedNamespace}/${encodedKind}/${encodedName}`,
                {headers: {Authorization: `Bearer ${token}`}, cache: "no-cache"}
            );
            let instancesData = {};
            if (instRes.ok) instancesData = await instRes.json();

            const currentState = useEventStore.getState();
            const hasInstances = currentState.objectInstanceStatus[decodedObjectName] &&
                Object.keys(currentState.objectInstanceStatus[decodedObjectName]).length > 0;

            if (!hasInstances) {
                if (objectData) currentState.setObjectStatuses({[decodedObjectName]: objectData});
                if (instancesData) {
                    currentState.setInstanceStatuses({[decodedObjectName]: instancesData}, true);
                } else {
                    currentState.setInstanceStatuses({[decodedObjectName]: {}}, true);
                }
            }
        } catch (err) {
            logger.error("Fallback fetch failed:", err);
            setInitialDataError(err.message);
        } finally {
            setInitialLoading(false);
            setFallbackCompleted(true);
        }
    }, [decodedObjectName]);

    useEffect(() => {
        useEventStore.getState().removeObject(decodedObjectName);
        setInitialLoading(true);
        setInitialDataError(null);
        setFallbackCompleted(false);
        hasFallbackFired.current = false;
        setConfigNode(null);

        const token = localStorage.getItem("authToken");
        if (token) {
            startEventReception(token, objectEventTypes, decodedObjectName);
        }

        fallbackTimer.current = setTimeout(() => {
            fetchFallbackData().catch((err) => {
                logger.error("[ObjectDetail] fetchFallbackData failed:", err);
            });
        }, 5000);

        return () => {
            if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
            closeEventSource();
        };
    }, [decodedObjectName, objectEventTypes, fetchFallbackData]);

    useEffect(() => {
        if (initialLoading && (objectInstanceStatus !== undefined || fallbackCompleted)) {
            setInitialLoading(false);
            if (fallbackTimer.current) {
                clearTimeout(fallbackTimer.current);
                fallbackTimer.current = null;
            }
            hasFallbackFired.current = true;
        }
    }, [initialLoading, objectInstanceStatus, fallbackCompleted]);

    useEffect(() => {
        if (configNode || !objectInstanceStatus) return;
        const nodes = Object.keys(objectInstanceStatus);
        if (nodes.length === 0) return;
        const best = nodes.find((node) => {
            const nodeData = objectInstanceStatus[node];
            return nodeData?.encap && Object.values(nodeData.encap).some(
                (container) => container.resources && Object.keys(container.resources).length > 0
            );
        }) || nodes[0];
        setConfigNode(best);
    }, [objectInstanceStatus, configNode]);

    useEffect(() => {
        if (!configNode || !objectInstanceStatus) return;
        const currentNodes = Object.keys(objectInstanceStatus);
        if (currentNodes.length === 0) {
            setConfigNode(null);
            setConfigDialogOpen(false);
            return;
        }
        if (!currentNodes.includes(configNode)) {
            logger.debug(`[ObjectDetail] configNode "${configNode}" removed, switching to "${currentNodes[0]}"`);
            setConfigNode(currentNodes[0]);
        }
    }, [objectInstanceStatus, configNode]);

    const prevInstanceConfigRef = useRef(instanceConfig);
    useEffect(() => {
        if (instanceConfig === prevInstanceConfigRef.current) return;
        prevInstanceConfigRef.current = instanceConfig;
        setConfigRefreshTrigger((n) => n + 1);
    }, [instanceConfig]);

    const openSnackbar = useCallback((msg, sev = "success") => {
        setSnackbar({open: true, message: msg, severity: sev});
    }, []);
    const closeSnackbar = useCallback(() => setSnackbar((s) => ({...s, open: false})), []);

    useEffect(() => {
        if (!snackbar.open) return;
        const timer = setTimeout(closeSnackbar, FEEDBACK_DURATION_MS);
        return () => clearTimeout(timer);
    }, [snackbar, closeSnackbar]);

    const postActionUrl = useCallback(({node, objectName, action}) => {
        const {namespace, kind, name} = parseObjectPath(objectName);
        const endpoint = INSTANCE_ACTIONS.find((a) => a.name === action)?.endpoint ?? action;
        return `${URL_NODE}/${encodeURIComponent(node)}/instance/path/${encodeURIComponent(namespace)}/${encodeURIComponent(kind)}/${encodeURIComponent(name)}/action/${endpoint}`;
    }, []);

    const postObjectAction = useCallback(async ({action}) => {
        const token = localStorage.getItem("authToken");
        if (!token) return openSnackbar("Auth token not found.", "error");
        setActionInProgress(true);
        openSnackbar(`Executing ${action} on object…`, "info");
        const endpoint = OBJECT_ACTIONS.find((a) => a.name === action)?.endpoint ?? `action/${action}`;
        const url = `${URL_OBJECT}/${encodeURIComponent(namespace)}/${encodeURIComponent(kind)}/${encodeURIComponent(name)}/${endpoint}`;
        try {
            const res = await fetch(url, {method: "POST", headers: {Authorization: `Bearer ${token}`}});
            if (!res.ok) {
                const serverError = await getResponseErrorMessage(res);
                openSnackbar(`Failed to execute ${action}: HTTP error! status: ${res.status}${serverError ? ` - ${serverError}` : ""}`, "error");
                return;
            }
            openSnackbar(`'${action}' succeeded on object`);
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
        } finally {
            setActionInProgress(false);
        }
    }, [decodedObjectName, openSnackbar, namespace, kind, name]);

    const postNodeAction = useCallback(async ({node, action}) => {
        const token = localStorage.getItem("authToken");
        if (!token) return openSnackbar("Auth token not found.", "error");
        setActionInProgress(true);
        openSnackbar(`Executing ${action} on node ${node}…`, "info");
        const url = postActionUrl({node, objectName: decodedObjectName, action});
        try {
            const res = await fetch(url, {method: "POST", headers: {Authorization: `Bearer ${token}`}});
            if (!res.ok) {
                const serverError = await getResponseErrorMessage(res);
                openSnackbar(`Failed to execute ${action}: HTTP error! status: ${res.status}${serverError ? ` - ${serverError}` : ""}`, "error");
                return;
            }
            openSnackbar(`'${action}' succeeded on node '${node}'`);
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
        } finally {
            setActionInProgress(false);
        }
    }, [decodedObjectName, openSnackbar, postActionUrl]);

    const openActionDialog = useCallback((action, context = null) => {
        setPendingAction({action, ...(context ? context : {})});
        if (action === "freeze") {
            setCheckboxes(DEFAULT_CHECKBOXES);
            setConfirmDialogOpen(true);
        } else if (action === "stop") {
            setStopCheckbox(DEFAULT_STOP_CHECKBOX);
            setStopDialogOpen(true);
        } else if (action === "unprovision") {
            setUnprovisionCheckboxes(DEFAULT_UNPROVISION_CHECKBOXES);
            setUnprovisionDialogOpen(true);
        } else if (action === "purge") {
            setPurgeCheckboxes(DEFAULT_PURGE_CHECKBOXES);
            setPurgeDialogOpen(true);
        } else {
            setSimpleDialogOpen(true);
        }
    }, []);

    const handleDialogConfirm = useCallback(() => {
        if (!pendingAction || !pendingAction.action) {
            setPendingAction(null);
            setConfirmDialogOpen(false);
            setStopDialogOpen(false);
            setUnprovisionDialogOpen(false);
            setPurgeDialogOpen(false);
            setSimpleDialogOpen(false);
            return;
        }
        if (pendingAction.batch === "nodes") {
            selectedNodes.forEach(node => {
                if (!node) return;
                postNodeAction({node, action: pendingAction.action}).catch((err) => {
                    logger.error("[ObjectDetail] postNodeAction failed:", err);
                });
            });
            setSelectedNodes([]);
        } else if (pendingAction.node && !pendingAction.rid) {
            postNodeAction({node: pendingAction.node, action: pendingAction.action}).catch((err) => {
                logger.error("[ObjectDetail] postNodeAction failed:", err);
            });
        } else {
            postObjectAction({action: pendingAction.action}).catch((err) => {
                logger.error("[ObjectDetail] postObjectAction failed:", err);
            });
        }
        setPendingAction(null);
        setConfirmDialogOpen(false);
        setStopDialogOpen(false);
        setUnprovisionDialogOpen(false);
        setPurgeDialogOpen(false);
        setSimpleDialogOpen(false);
    }, [pendingAction, selectedNodes, postNodeAction, postObjectAction]);

    const toggleNode = useCallback((node) => {
        setSelectedNodes(prev => prev.includes(node) ? prev.filter(n => n !== node) : [...prev, node]);
    }, []);

    const handleBatchNodeActionClick = (action) => {
        openActionDialog(action, {batch: "nodes"});
    };

    const handleIndividualNodeActionClick = useCallback((node, action) => {
        if (!node) return;
        openActionDialog(action, {node});
    }, [openActionDialog]);

    const handleObjectActionClick = (action) => {
        openActionDialog(action);
    };

    const handleViewInstance = useCallback((node) => {
        navigate(`/nodes/${node}/objects/${encodeURIComponent(decodedObjectName)}`);
    }, [decodedObjectName, navigate]);

    const handleOpenLogs = useCallback((node, instanceName = null) => {
        setSelectedNodeForLogs(node);
        setSelectedInstanceForLogs(instanceName);
        setLogsDrawerOpen(true);
    }, []);

    const handleCloseLogsDrawer = useCallback(() => {
        setLogsDrawerOpen(false);
        setSelectedNodeForLogs(null);
        setSelectedInstanceForLogs(null);
    }, []);

    const getNodeState = useCallback((node) => {
        const nodeStatus = objectInstanceStatus?.[node] || {};
        const monitor = instanceMonitor[`${node}:${decodedObjectName}`] || {};
        const avail = nodeStatus.avail || '';
        const frozen = nodeStatus.frozen_at && nodeStatus.frozen_at !== ZERO_TIME ? "frozen" : "unfrozen";
        const state = monitor.state !== "idle" ? monitor.state : null;
        const isStopped = hasTimestamp(nodeStatus.stopped_at);
        const isLagging = hasTimestamp(nodeStatus.rpo_breached_at);
        return {avail, frozen, state, isStopped, isLagging};
    }, [objectInstanceStatus, instanceMonitor, decodedObjectName]);

    const filterActionsForNode = useCallback((actions, node) => {
        const {frozen} = getNodeState(node);
        return actions.filter(({name}) => {
            if (name === 'freeze') return frozen !== 'frozen';
            if (name === 'unfreeze') return frozen === 'frozen';
            return true;
        });
    }, [getNodeState]);

    const filterActionsForMultipleNodes = useCallback((actions, nodes) => {
        if (!nodes || nodes.length === 0) return actions;
        const states = nodes.map(node => getNodeState(node).frozen);
        const allFrozen = states.every(f => f === 'frozen');
        const allUnfrozen = states.every(f => f !== 'frozen');
        return actions.filter(({name}) => {
            if (name === 'freeze') return !allFrozen;
            if (name === 'unfreeze') return !allUnfrozen;
            return true;
        });
    }, [getNodeState]);

    const batchFilteredActions = useMemo(() => {
        return filterActionsForMultipleNodes(INSTANCE_ACTIONS, selectedNodes);
    }, [selectedNodes, filterActionsForMultipleNodes]);

    useEffect(() => {
        let unsubscribe = null;
        try {
            const maybeUnsubscribe = useEventStore.subscribe(
                (state) => state.instanceConfig,
                (newConfig) => {
                    const config = newConfig[decodedObjectName];
                    if (config && configNode) {
                        openSnackbar("Instance configuration updated", "info");
                    }
                }
            );
            if (typeof maybeUnsubscribe === 'function') {
                unsubscribe = maybeUnsubscribe;
            } else {
                logger.warn("[ObjectDetail] Subscription is not a function:", maybeUnsubscribe);
            }
        } catch (err) {
            logger.warn("[ObjectDetail] Failed to subscribe to instanceConfig:", err);
        }
        return () => {
            if (typeof unsubscribe === 'function') unsubscribe();
        };
    }, [decodedObjectName, configNode, openSnackbar]);

    const showKeys = ["cfg", "sec"].includes(kind);

    const feedback = snackbar.open && (
        <Alert
            tone={TONES[snackbar.severity] ?? "info"}
            action={
                <IconButton label="Close" bare onClick={closeSnackbar}>
                    <CloseIcon className="h-4 w-4"/>
                </IconButton>
            }
        >
            {snackbar.message}
        </Alert>
    );

    const configSection = (
        <ConfigSection
            decodedObjectName={decodedObjectName}
            configNode={configNode}
            setConfigNode={setConfigNode}
            openSnackbar={openSnackbar}
            configDialogOpen={configDialogOpen}
            setConfigDialogOpen={setConfigDialogOpen}
            configRefreshTrigger={configRefreshTrigger}
        />
    );

    if (initialLoading) {
        return (
            <div className="flex min-h-[80vh] items-center justify-center gap-2 p-4">
                <Spinner label="Loading object data"/>
                <span className="text-ink-muted">Loading object data...</span>
            </div>
        );
    }

    if (nodesList.length === 0 && !initialDataError) {
        return (
            <div className="p-4 space-y-3">
                <h1 className="text-title font-semibold">{decodedObjectName}</h1>
                {feedback}
                <p className="py-4 text-center text-ink-muted">No information available for object.</p>
                {showKeys && <KeysSection decodedObjectName={decodedObjectName} openSnackbar={openSnackbar}/>}
                {configSection}
            </div>
        );
    }

    const logsTitle = selectedInstanceForLogs
        ? `Instance Logs - ${selectedInstanceForLogs}`
        : selectedNodeForLogs
            ? `Node Logs - ${selectedNodeForLogs}`
            : "Logs";

    return (
        <div className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                    <HeaderSection
                        decodedObjectName={decodedObjectName}
                        kind={kind}
                        globalStatus={objectStatus}
                        actionInProgress={actionInProgress}
                        handleObjectActionClick={handleObjectActionClick}
                        getObjectStatus={() => objectData}
                    />
                </div>
                <div className="shrink-0">{configSection}</div>
            </div>

            {feedback}

            {pendingAction && (
                <ActionDialogManager
                    pendingAction={pendingAction}
                    handleConfirm={handleDialogConfirm}
                    target={`object ${decodedObjectName}`}
                    supportedActions={
                        pendingAction?.batch === "nodes" || pendingAction?.node
                            ? INSTANCE_ACTIONS.map(a => a.name)
                            : OBJECT_ACTIONS.map(a => a.name)
                    }
                    onClose={() => {
                        setPendingAction(null);
                        setConfirmDialogOpen(false);
                        setStopDialogOpen(false);
                        setUnprovisionDialogOpen(false);
                        setPurgeDialogOpen(false);
                        setSimpleDialogOpen(false);
                    }}
                    confirmDialogOpen={confirmDialogOpen}
                    stopDialogOpen={stopDialogOpen}
                    unprovisionDialogOpen={unprovisionDialogOpen}
                    purgeDialogOpen={purgeDialogOpen}
                    simpleDialogOpen={simpleDialogOpen}
                    checkboxes={checkboxes}
                    setCheckboxes={setCheckboxes}
                    stopCheckbox={stopCheckbox}
                    setStopCheckbox={setStopCheckbox}
                    unprovisionCheckboxes={unprovisionCheckboxes}
                    setUnprovisionCheckboxes={setUnprovisionCheckboxes}
                    purgeCheckboxes={purgeCheckboxes}
                    setPurgeCheckboxes={setPurgeCheckboxes}
                />
            )}

            {showKeys && <KeysSection decodedObjectName={decodedObjectName} openSnackbar={openSnackbar}/>}

            {!["sec", "cfg", "usr"].includes(kind) && (
                <section aria-labelledby="object-instances" className={PANEL}>
                    <div className="flex items-center gap-3 border-b border-line px-3 py-2">
                        <h2 id="object-instances" className="font-semibold">
                            Instances ({nodesList.length})
                        </h2>
                        <MenuButton
                            label={`Actions on selected nodes (${selectedNodes.length})`}
                            disabled={selectedNodes.length === 0}
                            className="ml-auto"
                            align="end"
                            items={batchFilteredActions.map(({name, icon, color}) => ({
                                key: name,
                                label: capitalize(name),
                                icon: <span aria-hidden="true" className={color === "red" ? DANGER_ICON : ICON}>{icon}</span>,
                                disabled: actionInProgress,
                                onSelect: () => handleBatchNodeActionClick(name),
                            }))}
                        />
                    </div>
                    <div className="divide-y divide-line">
                        {nodesList.map(node => (
                            <InstanceCard
                                key={node}
                                node={node}
                                nodeData={memoizedObjectData[node] || {}}
                                selectedNodes={selectedNodes}
                                toggleNode={toggleNode}
                                actionInProgress={actionInProgress}
                                actions={filterActionsForNode(INSTANCE_ACTIONS, node)}
                                onAction={handleIndividualNodeActionClick}
                                getNodeState={getNodeState}
                                instanceName={name}
                                onOpenLogs={handleOpenLogs}
                                onViewInstance={handleViewInstance}
                            />
                        ))}
                    </div>
                </section>
            )}

            <SlideOver
                open={logsDrawerOpen && selectedNodeForLogs !== null}
                title={logsTitle}
                onClose={handleCloseLogsDrawer}
                closeLabel="Close logs"
                size="wide"
                resizeLabel="Resize drawer"
                closeOnOutsideClick={false}
            >
                {logsDrawerOpen && selectedNodeForLogs !== null && (
                    <LogsViewer
                        nodename={selectedNodeForLogs}
                        type={selectedInstanceForLogs ? "instance" : "node"}
                        namespace={namespace}
                        kind={kind}
                        instanceName={selectedInstanceForLogs}
                        height="100%"
                    />
                )}
            </SlideOver>

            <EventLogger eventTypes={objectEventTypes} objectName={decodedObjectName}
                         title={`Events - ${decodedObjectName}`} buttonLabel="Object Events"/>
        </div>
    );
};

export default ObjectDetail;
