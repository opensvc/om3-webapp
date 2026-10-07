import React, {useCallback, useEffect, useState, useRef, useMemo} from "react";
import {useParams} from "react-router-dom";
import useEventStore from "../hooks/useEventStore.js";
import {URL_NODE} from "../config/apiPath.js";
import {getResponseErrorMessage} from "../services/api.jsx";
import {INSTANCE_ACTIONS, RESOURCE_ACTIONS} from "../constants/actions";
import {parseObjectPath} from "../utils/objectUtils.jsx";
import {ObjectIcon, om3ObjectKind} from "../ui/components/ObjectIcon";
import {StoppedMark, RpoBreachedMark} from "../ui/components/StateMarks";
import {startEventReception, closeEventSource} from "../eventSourceManager.jsx";
import EventLogger from "../components/EventLogger";
import LogsViewer from "./LogsViewer";
import ConsoleTerminal from "./ConsoleTerminal.jsx";
import {Table, HeaderRow, HeaderCell, Row, Cell, EmptyRow} from "../ui/components/Table";
import {StatusBadge} from "../ui/components/StatusBadge";
import {StatusMark} from "../ui/components/StatusMark";
import {FrozenMark} from "../ui/components/FrozenMark";
import {MenuButton} from "../ui/components/MenuButton";
import {Button, IconButton} from "../ui/components/Button";
import {Checkbox} from "../ui/components/Field";
import {Dialog} from "../ui/components/Dialog";
import {SlideOver} from "../ui/components/SlideOver";
import {Alert} from "../ui/components/Alert";
import {Spinner} from "../ui/components/Spinner";
import {AlertTriangleIcon, CloseIcon, FileIcon, MoreIcon} from "../ui/icons";

const DEFAULT_CHECKBOXES = {failover: false};
const DEFAULT_STOP_CHECKBOX = false;
const DEFAULT_UNPROVISION_CHECKBOXES = {dataLoss: false, serviceInterruption: false};
const DEFAULT_PURGE_CHECKBOXES = {dataLoss: false, configLoss: false, serviceInterruption: false};

/** The feedback message hides itself after a while, as the snackbar did. */
const FEEDBACK_DURATION_MS = 5000;
const TONES = {info: "info", success: "success", warning: "warning", error: "error"};

/** Number of columns of the resource table, for the rows spanning all of them. */
const COLUMNS = 6;

/** Class names of the menu entry icons: the action icons squared to 16px. */
const ICON = "flex h-4 w-4 items-center justify-center text-ink-muted [&>svg]:h-4! [&>svg]:w-4!";

const capitalize = (name) => name.charAt(0).toUpperCase() + name.slice(1);

/** The state of a resource or an instance status, as the coloured dot told it. */
const toState = (status) => {
    if (status === "up" || status === true) return "up";
    if (status === "down" || status === false) return "down";
    if (status === "warn") return "warn";
    return "unknown";
};

const LOG_INK = {warn: "text-state-warn", error: "text-state-down"};

const NotProvisionedMark = ({label}) => (
    <span role="img" aria-label={label} title="Not Provisioned" className="inline-flex text-state-down">
        <AlertTriangleIcon className="h-3.5 w-3.5"/>
    </span>
);

/** A line of the table under a resource, spanning all columns: a note or the resource logs. */
const NoteRow = ({isEncap, children}) => (
    <tr className="border-b border-line last:border-b-0">
        <td colSpan={COLUMNS} className={`px-2 py-1 text-ink-muted ${isEncap ? "pl-8" : "pl-6"}`}>
            {children}
        </td>
    </tr>
);

const ZERO_TIME = "0001-01-01T00:00:00Z";
const hasTimestamp = (v) => !!v && v !== ZERO_TIME;

const ResourceRow = React.memo(({
                                    rid,
                                    resource,
                                    isEncap = false,
                                    instanceConfig,
                                    instanceMonitor,
                                    encapData = {},
                                    getResourceStatusLetters,
                                    menuItems,
                                    actionInProgress = false,
                                }) => {
    const {statusString, tooltipText} = getResourceStatusLetters(
        rid,
        resource,
        instanceConfig,
        instanceMonitor,
        isEncap,
        encapData
    );

    const labelText = resource.label || "N/A";
    const infoText = resource.info?.actions === "disabled" ? "info: actions disabled" : "";
    const resourceType = resource.type || "N/A";
    const isContainer = resourceType.toLowerCase().includes("container");
    const provisionedState = isContainer && encapData[rid]?.provisioned !== undefined
        ? encapData[rid].provisioned
        : resource?.provisioned?.state;
    const isResourceNotProvisioned = provisionedState === "false" || provisionedState === false || provisionedState === "n/a";
    const logs = resource.log || [];
    const statusLabel = resource.status || "unknown";

    return (
        <>
            <Row aria-label={`Resource ${rid}`}>
                <Cell className={`whitespace-nowrap ${isEncap ? "pl-6" : ""}`}>{rid}</Cell>
                <Cell className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                        <StatusMark state={toState(resource.status)} label={statusLabel}/>
                        <span aria-hidden="true">{statusLabel}</span>
                        {isResourceNotProvisioned && (
                            <NotProvisionedMark label={`Resource ${rid} is not provisioned`}/>
                        )}
                    </span>
                </Cell>
                <Cell className="whitespace-nowrap">
                    <span
                        role="img"
                        aria-label={`Resource ${rid} status: ${statusString}`}
                        title={tooltipText}
                        className="font-mono"
                    >
                        {statusString}
                    </span>
                </Cell>
                <Cell className="whitespace-nowrap">{resourceType}</Cell>
                <Cell className="w-full max-w-0">
                    <span className="block truncate" title={infoText ? `${labelText} ${infoText}` : labelText}>
                        {labelText}
                        {infoText && <span className="ml-2 text-ink-muted">{infoText}</span>}
                    </span>
                </Cell>
                <Cell align="center">
                    <MenuButton
                        label={`Resource ${rid} actions`}
                        icon={<MoreIcon className="h-4 w-4"/>}
                        compact
                        align="end"
                        className="inline-flex align-middle"
                        disabled={actionInProgress}
                        items={menuItems}
                    />
                </Cell>
            </Row>
            {logs.length > 0 && (
                <NoteRow isEncap={isEncap}>
                    <ul aria-label={`Logs of resource ${rid}`} className="space-y-0.5 text-data">
                        {logs.map((log, index) => (
                            <li key={index} className={`break-words ${LOG_INK[log.level] ?? "text-ink-muted"}`}>
                                {log.level}: {log.message}
                            </li>
                        ))}
                    </ul>
                </NoteRow>
            )}
        </>
    );
});

const ObjectInstanceView = () => {
    const {node: nodeName, objectName} = useParams();
    const decodedObjectName = decodeURIComponent(objectName);
    const {namespace, kind, name} = parseObjectPath(decodedObjectName);

    const objectInstanceStatus = useEventStore((s) => s.objectInstanceStatus);
    const instanceMonitor = useEventStore((s) => s.instanceMonitor);
    const instanceConfig = useEventStore((s) => s.instanceConfig);

    const instanceData = objectInstanceStatus?.[decodedObjectName]?.[nodeName] || {};
    const monitorData = instanceMonitor[`${nodeName}:${decodedObjectName}`] || {};
    const configData = instanceConfig[decodedObjectName]?.[nodeName] || {resources: {}};

    const resources = instanceData.resources || {};
    const encapResources = instanceData.encap || {};

    const [actionInProgress, setActionInProgress] = useState(false);
    const [snackbar, setSnackbar] = useState({open: false, message: "", severity: "success"});

    const [pendingAction, setPendingAction] = useState(null);
    // The resource a console is open on, null when none is.
    const [consoleTarget, setConsoleTarget] = useState(null);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [stopDialogOpen, setStopDialogOpen] = useState(false);
    const [unprovisionDialogOpen, setUnprovisionDialogOpen] = useState(false);
    const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
    const [simpleDialogOpen, setSimpleDialogOpen] = useState(false);
    const [checkboxes, setCheckboxes] = useState(DEFAULT_CHECKBOXES);
    const [stopCheckbox, setStopCheckbox] = useState(DEFAULT_STOP_CHECKBOX);
    const [unprovisionCheckboxes, setUnprovisionCheckboxes] = useState(DEFAULT_UNPROVISION_CHECKBOXES);
    const [purgeCheckboxes, setPurgeCheckboxes] = useState(DEFAULT_PURGE_CHECKBOXES);

    const [logsDrawerOpen, setLogsDrawerOpen] = useState(false);

    const [initialLoading, setInitialLoading] = useState(true);

    const isMounted = useRef(true);

    const instanceEventTypes = useMemo(() => [
        "InstanceStatusUpdated",
        "InstanceMonitorUpdated",
        "InstanceConfigUpdated",
    ], []);

    useEffect(() => {
        isMounted.current = true;

        const token = localStorage.getItem("authToken");
        if (token) {
            startEventReception(token, instanceEventTypes, decodedObjectName);
        }

        const timer = setTimeout(() => {
            if (isMounted.current) {
                setInitialLoading(false);
            }
        }, 500);

        return () => {
            isMounted.current = false;
            closeEventSource();
            clearTimeout(timer);
        };
    }, [decodedObjectName, nodeName, instanceEventTypes]);

    useEffect(() => {
        if (!snackbar.open) return;
        const timer = setTimeout(() => {
            setSnackbar((prev) => ({...prev, open: false}));
        }, FEEDBACK_DURATION_MS);
        return () => clearTimeout(timer);
    }, [snackbar]);

    const openSnackbar = useCallback((msg, sev = "success") => {
        if (isMounted.current) {
            setSnackbar({open: true, message: msg, severity: sev});
        }
    }, []);

    const closeSnackbar = useCallback(() => {
        if (isMounted.current) {
            setSnackbar((s) => ({...s, open: false}));
        }
    }, []);

    const openActionDialog = useCallback((action, context = null) => {
        if (isMounted.current) {
            if (action === "console") {
                // A console is no action to confirm: it opens a terminal
                // on the resource.
                if (context?.rid) {
                    setConsoleTarget({node: nodeName, namespace, kind, name, rid: context.rid});
                }
                return;
            }
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
        }
    }, [nodeName, namespace, kind, name]);

    const handleDialogConfirm = useCallback(async () => {
        if (!pendingAction || !pendingAction.action) {
            console.warn("No valid pendingAction or action provided:", pendingAction);
            setPendingAction(null);
            setConfirmDialogOpen(false);
            setStopDialogOpen(false);
            setUnprovisionDialogOpen(false);
            setPurgeDialogOpen(false);
            setSimpleDialogOpen(false);
            return;
        }

        const token = localStorage.getItem("authToken");
        if (!token) {
            openSnackbar("Auth token not found.", "error");
            return;
        }

        setActionInProgress(true);
        const {action} = pendingAction;

        try {
            let url;
            let message;
            const endpoint = INSTANCE_ACTIONS.find((a) => a.name === action)?.endpoint ?? action;

            if (pendingAction.rid) {
                url = `${URL_NODE}/${nodeName}/instance/path/${namespace}/${kind}/${name}/action/${action}?rid=${encodeURIComponent(pendingAction.rid)}`;
                message = `Executing ${action} on resource ${pendingAction.rid}...`;
            } else {
                url = `${URL_NODE}/${nodeName}/instance/path/${namespace}/${kind}/${name}/action/${endpoint}`;
                message = `Executing ${action} on instance...`;
            }

            openSnackbar(message, "info");

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const serverError = await getResponseErrorMessage(response);
                openSnackbar(
                    `Failed: HTTP ${response.status}${serverError ? ` - ${serverError}` : ""}`,
                    "error"
                );
                return;
            }

            openSnackbar(`Action '${action}' succeeded`, "success");
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
        } finally {
            if (isMounted.current) {
                setActionInProgress(false);
                setPendingAction(null);
                setConfirmDialogOpen(false);
                setStopDialogOpen(false);
                setUnprovisionDialogOpen(false);
                setPurgeDialogOpen(false);
                setSimpleDialogOpen(false);
            }
        }
    }, [nodeName, namespace, kind, name, pendingAction, openSnackbar]);

    const handleInstanceAction = useCallback((action) => {
        openActionDialog(action, {node: nodeName});
    }, [nodeName, openActionDialog]);

    const handleResourceAction = useCallback((action, rid) => {
        openActionDialog(action, {node: nodeName, rid});
    }, [nodeName, openActionDialog]);

    const getResourceStatusLetters = useCallback((rid, resourceData, instanceConfig, instanceMonitor, isEncap = false, encapData = {}) => {
        const letters = [".", ".", ".", ".", ".", ".", ".", "."];
        const tooltipDescriptions = [
            "Not Running",
            "Not Monitored",
            "Enabled",
            "Not Optional",
            isEncap ? "Encap" : "Not Encap",
            "Provisioned",
            "Not Standby",
            "No Restart",
        ];

        if (resourceData?.running !== undefined) {
            letters[0] = resourceData.running ? "R" : ".";
            tooltipDescriptions[0] = resourceData.running ? "Running" : "Not Running";
        }

        const isMonitored = instanceConfig?.resources?.[rid]?.is_monitored;
        if (isMonitored === true || isMonitored === "true") {
            letters[1] = "M";
            tooltipDescriptions[1] = "Monitored";
        }

        const isDisabled = instanceConfig?.resources?.[rid]?.is_disabled;
        if (isDisabled === true || isDisabled === "true") {
            letters[2] = "D";
            tooltipDescriptions[2] = "Disabled";
        }

        if (resourceData?.optional === true || resourceData?.optional === "true") {
            letters[3] = "O";
            tooltipDescriptions[3] = "Optional";
        }

        if (isEncap) {
            letters[4] = "E";
            tooltipDescriptions[4] = "Encap";
        }

        let provisionedState = resourceData?.provisioned?.state;
        const isContainer = resourceData?.type?.toLowerCase().includes("container");
        if (isContainer && encapData[rid]?.provisioned !== undefined) {
            provisionedState = encapData[rid].provisioned;
        }

        if (provisionedState === "false" || provisionedState === false || provisionedState === "n/a") {
            letters[5] = "P";
            tooltipDescriptions[5] = "Not Provisioned";
        } else if (provisionedState === "true" || provisionedState === true) {
            tooltipDescriptions[5] = "Provisioned";
        } else {
            tooltipDescriptions[5] = "Provisioned";
        }

        const isStandby = instanceConfig?.resources?.[rid]?.is_standby;
        if (isStandby === true || isStandby === "true") {
            letters[6] = "S";
            tooltipDescriptions[6] = "Standby";
        }

        const configRestarts = instanceConfig?.resources?.[rid]?.restart;
        const monitorRestarts = instanceMonitor?.resources?.[rid]?.restart?.remaining;
        let remainingRestarts;
        if (typeof configRestarts === "number" && configRestarts > 0) {
            remainingRestarts = configRestarts;
        } else if (typeof monitorRestarts === "number") {
            remainingRestarts = monitorRestarts;
        }

        if (typeof remainingRestarts === "number") {
            letters[7] = remainingRestarts === 0 ? "." : remainingRestarts > 10 ? "+" : remainingRestarts.toString();
            tooltipDescriptions[7] =
                remainingRestarts === 0
                    ? "No Restart"
                    : remainingRestarts > 10
                        ? "More than 10 Restarts"
                        : `${remainingRestarts} Restart${remainingRestarts === 1 ? "" : "s"} Remaining`;
        }

        const statusString = letters.join("");
        const tooltipText = tooltipDescriptions.join(", ");
        return {statusString, tooltipText};
    }, []);

    const getFilteredResourceActions = useCallback((resourceType) => {
        if (!resourceType) {
            return RESOURCE_ACTIONS;
        }
        const typePrefix = resourceType.split('.')[0].toLowerCase();
        if (typePrefix === 'task') {
            return RESOURCE_ACTIONS.filter(action => action.name === 'run');
        }
        if (['fs', 'disk', 'app'].includes(typePrefix)) {
            return RESOURCE_ACTIONS.filter(action => action.name !== 'run' && action.name !== 'console');
        }
        if (typePrefix === 'container') {
            return RESOURCE_ACTIONS.filter(action => action.name !== 'run');
        }
        return RESOURCE_ACTIONS;
    }, []);

    const getResourceType = useCallback((rid) => {
        const topLevelType = resources[rid]?.type;
        if (topLevelType) {
            return topLevelType;
        }
        for (const containerId of Object.keys(encapResources)) {
            const encapType = encapResources[containerId]?.resources?.[rid]?.type;
            if (encapType) {
                return encapType;
            }
        }
        return '';
    }, [resources, encapResources]);

    /** The entries of the action menu of a resource, filtered by its type. */
    const resourceMenuItems = useCallback((rid) =>
        getFilteredResourceActions(getResourceType(rid)).map(({name, icon}) => ({
            key: name,
            label: capitalize(name),
            icon: <span aria-hidden="true" className={ICON}>{icon}</span>,
            onSelect: () => handleResourceAction(name, rid),
        })), [getFilteredResourceActions, getResourceType, handleResourceAction]);

    const instanceStatus = instanceData.avail || 'unknown';
    const isFrozen = hasTimestamp(instanceData.frozen_at);
    const isStopped = hasTimestamp(instanceData.stopped_at);
    const isLagging = hasTimestamp(instanceData.rpo_breached_at);
    const isInstanceNotProvisioned = instanceData.provisioned !== undefined ? !instanceData.provisioned : false;

    const filteredInstanceActions = useMemo(() => {
        return INSTANCE_ACTIONS.filter(({name}) => {
            if (name === 'freeze') return !isFrozen;
            if (name === 'unfreeze') return isFrozen;
            return true;
        });
    }, [isFrozen]);

    if (initialLoading) {
        return (
            <div className="flex justify-center p-4 py-8">
                <Spinner label="Loading instance data..."/>
            </div>
        );
    }

    const resourceIds = Object.keys(resources);
    const rowProps = {
        instanceConfig: configData,
        instanceMonitor: monitorData,
        getResourceStatusLetters,
        actionInProgress,
    };

    return (
        <div className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="min-w-0">
                    {/* The kind icon before the name, as in the object page header. */}
                    <h1 className="flex items-center gap-2 text-title font-semibold break-all">
                        <ObjectIcon kind={om3ObjectKind(parseObjectPath(decodedObjectName).kind)} className="h-5 w-5"/>
                        {decodedObjectName}
                    </h1>
                    <p className="text-ink-muted">Node: {nodeName}</p>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                    <StatusBadge state={toState(instanceStatus)} label={instanceStatus}/>
                    {monitorData.state && monitorData.state !== 'idle' && (
                        <span className="text-ink-muted">{monitorData.state}</span>
                    )}
                    {isStopped && <StoppedMark stoppedAt={instanceData.stopped_at} label="Instance is stopped"/>}
                    {isLagging && <RpoBreachedMark/>}
                    {isInstanceNotProvisioned && <NotProvisionedMark label="Instance is not provisioned"/>}
                    <FrozenMark frozen={!!isFrozen}/>
                    <IconButton label={`View logs for instance ${decodedObjectName}`} onClick={() => setLogsDrawerOpen(true)}>
                        <FileIcon className="h-4 w-4"/>
                    </IconButton>
                    <MenuButton
                        label="Instance actions"
                        align="end"
                        disabled={actionInProgress}
                        items={filteredInstanceActions.map(({name, icon}) => ({
                            key: name,
                            label: capitalize(name),
                            icon: <span aria-hidden="true" className={ICON}>{icon}</span>,
                            onSelect: () => handleInstanceAction(name),
                        }))}
                    />
                </div>
            </div>

            {actionInProgress && <Spinner label="Action in progress"/>}

            {snackbar.open && (
                <Alert
                    tone={TONES[snackbar.severity] ?? "info"}
                    action={
                        <IconButton label="Dismiss" bare onClick={closeSnackbar}>
                            <CloseIcon className="h-4 w-4"/>
                        </IconButton>
                    }
                >
                    {snackbar.message}
                </Alert>
            )}

            <h2 className="font-semibold">Resources ({resourceIds.length})</h2>

            {/* Wider than a phone: the table scrolls sideways there rather than wrap its 30px rows. */}
            <Table aria-label="Resources" tableClassName="min-w-[40rem]">
                <thead>
                <HeaderRow>
                    <HeaderCell>Resource</HeaderCell>
                    <HeaderCell>Status</HeaderCell>
                    <HeaderCell>Flags</HeaderCell>
                    <HeaderCell>Type</HeaderCell>
                    <HeaderCell>Label</HeaderCell>
                    <HeaderCell align="center"><span className="sr-only">Actions</span></HeaderCell>
                </HeaderRow>
                </thead>
                <tbody>
                {resourceIds.length === 0 ? (
                    <EmptyRow colSpan={COLUMNS}>No resources found on this instance.</EmptyRow>
                ) : resourceIds.map((rid) => {
                    const res = resources[rid] || {};
                    const isContainer = res.type?.toLowerCase().includes("container") || false;
                    const encapRes = isContainer && encapResources[rid]?.resources ? encapResources[rid].resources : {};
                    const encapResIds = Object.keys(encapRes);
                    return (
                        <React.Fragment key={rid}>
                            <ResourceRow
                                rid={rid}
                                resource={res}
                                isEncap={false}
                                encapData={encapResources}
                                menuItems={resourceMenuItems(rid)}
                                {...rowProps}
                            />
                            {isContainer && !encapResources[rid] && (
                                <NoteRow isEncap>No encapsulated data available for {rid}.</NoteRow>
                            )}
                            {isContainer && encapResources[rid] && !encapResources[rid].resources && (
                                <NoteRow isEncap>
                                    Encapsulated data found for {rid}, but no resources defined.
                                </NoteRow>
                            )}
                            {isContainer && encapResIds.length > 0 && res.status !== "down" &&
                                encapResIds.map((encapRid) => (
                                    <ResourceRow
                                        key={encapRid}
                                        rid={encapRid}
                                        resource={encapRes[encapRid] || {}}
                                        isEncap={true}
                                        encapData={encapResources[rid] || {}}
                                        menuItems={resourceMenuItems(encapRid)}
                                        {...rowProps}
                                    />
                                ))}
                            {isContainer && encapResIds.length === 0 && encapResources[rid]?.resources !== undefined && (
                                <NoteRow isEncap>No encapsulated resources available for {rid}.</NoteRow>
                            )}
                        </React.Fragment>
                    );
                })}
                </tbody>
            </Table>

            <Dialog
                open={confirmDialogOpen}
                title="Confirm Freeze"
                onClose={() => setConfirmDialogOpen(false)}
                size="md"
                footer={
                    <>
                        <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
                        <Button variant="primary" onClick={handleDialogConfirm} disabled={!checkboxes.failover}>
                            Confirm
                        </Button>
                    </>
                }
            >
                <Checkbox
                    checked={checkboxes.failover}
                    onChange={(e) => setCheckboxes({...checkboxes, failover: e.target.checked})}
                    label="I understand that the selected service orchestration will be paused."
                />
            </Dialog>

            <Dialog
                open={stopDialogOpen}
                title="Confirm Stop"
                onClose={() => setStopDialogOpen(false)}
                size="md"
                footer={
                    <>
                        <Button onClick={() => setStopDialogOpen(false)}>Cancel</Button>
                        <Button variant="primary" onClick={handleDialogConfirm} disabled={!stopCheckbox}>
                            Stop
                        </Button>
                    </>
                }
            >
                <Checkbox
                    checked={stopCheckbox}
                    onChange={(e) => setStopCheckbox(e.target.checked)}
                    label="I understand that this may interrupt services."
                />
            </Dialog>

            <Dialog
                open={unprovisionDialogOpen}
                title="Confirm Unprovision"
                onClose={() => setUnprovisionDialogOpen(false)}
                size="md"
                footer={
                    <>
                        <Button onClick={() => setUnprovisionDialogOpen(false)}>Cancel</Button>
                        <Button
                            variant="primary"
                            onClick={handleDialogConfirm}
                            disabled={!unprovisionCheckboxes.dataLoss || !unprovisionCheckboxes.serviceInterruption}
                        >
                            Confirm
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-2">
                    <Checkbox
                        checked={unprovisionCheckboxes.dataLoss}
                        onChange={(e) => setUnprovisionCheckboxes({
                            ...unprovisionCheckboxes,
                            dataLoss: e.target.checked
                        })}
                        label="I understand data will be lost."
                    />
                    <Checkbox
                        checked={unprovisionCheckboxes.serviceInterruption}
                        onChange={(e) => setUnprovisionCheckboxes({
                            ...unprovisionCheckboxes,
                            serviceInterruption: e.target.checked
                        })}
                        label="I understand the selected services may be temporarily interrupted during failover, or durably interrupted if no failover is configured."
                    />
                </div>
            </Dialog>

            <Dialog
                open={purgeDialogOpen}
                title="Confirm Purge"
                onClose={() => setPurgeDialogOpen(false)}
                size="md"
                footer={
                    <>
                        <Button onClick={() => setPurgeDialogOpen(false)}>Cancel</Button>
                        <Button
                            variant="primary"
                            onClick={handleDialogConfirm}
                            disabled={!purgeCheckboxes.dataLoss || !purgeCheckboxes.configLoss || !purgeCheckboxes.serviceInterruption}
                        >
                            Confirm
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-2">
                    <Checkbox
                        checked={purgeCheckboxes.dataLoss}
                        onChange={(e) => setPurgeCheckboxes({...purgeCheckboxes, dataLoss: e.target.checked})}
                        label="I understand data will be lost."
                    />
                    <Checkbox
                        checked={purgeCheckboxes.configLoss}
                        onChange={(e) => setPurgeCheckboxes({...purgeCheckboxes, configLoss: e.target.checked})}
                        label="I understand the configuration will be lost."
                    />
                    <Checkbox
                        checked={purgeCheckboxes.serviceInterruption}
                        onChange={(e) => setPurgeCheckboxes({
                            ...purgeCheckboxes,
                            serviceInterruption: e.target.checked
                        })}
                        label="I understand the selected services may be temporarily interrupted during failover, or durably interrupted if no failover is configured."
                    />
                </div>
            </Dialog>

            <ConsoleTerminal
                open={consoleTarget !== null}
                target={consoleTarget}
                onClose={() => setConsoleTarget(null)}
            />

            <Dialog
                open={simpleDialogOpen}
                title={`Confirm ${pendingAction?.action ? capitalize(pendingAction.action) : 'Action'}`}
                onClose={() => setSimpleDialogOpen(false)}
                footer={
                    <>
                        <Button onClick={() => setSimpleDialogOpen(false)}>Cancel</Button>
                        <Button variant="primary" onClick={handleDialogConfirm}>Confirm</Button>
                    </>
                }
            >
                <p>
                    Are you sure you want to{' '}
                    <strong>{pendingAction?.action || 'perform this action'}</strong>{' '}
                    {pendingAction?.rid ? `on resource ${pendingAction.rid}` : 'on this instance'}?
                </p>
            </Dialog>

            <EventLogger
                eventTypes={instanceEventTypes}
                objectName={decodedObjectName}
                nodeName={nodeName}
                title={`Instance Events - ${nodeName}/${decodedObjectName}`}
                buttonLabel="Instance Events"
            />

            <SlideOver
                open={logsDrawerOpen}
                title={`Instance Logs - ${nodeName}/${decodedObjectName}`}
                onClose={() => setLogsDrawerOpen(false)}
                closeLabel="Close instance logs"
                size="wide"
                resizeLabel="Resize drawer"
                closeOnOutsideClick={false}
            >
                {logsDrawerOpen && (
                    <LogsViewer
                        nodename={nodeName}
                        type="instance"
                        namespace={namespace}
                        kind={kind}
                        instanceName={name}
                        height="100%"
                    />
                )}
            </SlideOver>
        </div>
    );
};

export default ObjectInstanceView;
