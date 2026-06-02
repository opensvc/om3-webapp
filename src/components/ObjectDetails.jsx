import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useParams, useNavigate} from "react-router-dom";
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Menu,
    MenuItem,
    Typography,
    Drawer,
    IconButton,
    TextField,
    useTheme,
    Grid,
    Snackbar,
    ListItemIcon,
    ListItemText,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {green, grey, orange, red} from "@mui/material/colors";
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
    const theme = useTheme();

    const objectStatus = useEventStore((s) => s.objectStatus[decodedObjectName]);
    const objectInstanceStatus = useEventStore((s) => s.objectInstanceStatus[decodedObjectName]);
    const instanceMonitor = useEventStore((s) => s.instanceMonitor);
    const instanceConfig = useEventStore((s) => s.instanceConfig[decodedObjectName]);
    const clearConfigUpdate = useEventStore((s) => s.clearConfigUpdate);

    const [configLoading, setConfigLoading] = useState(false);
    const [configError, setConfigError] = useState(null);
    const [configNode, setConfigNode] = useState(null);
    const [configDialogOpen, setConfigDialogOpen] = useState(false);

    const [selectedNodes, setSelectedNodes] = useState([]);
    const [actionsMenuAnchor, setActionsMenuAnchor] = useState(null);
    const [individualNodeMenuAnchor, setIndividualNodeMenuAnchor] = useState(null);
    const [currentNode, setCurrentNode] = useState(null);

    const [objectMenuAnchor, setObjectMenuAnchor] = useState(null);
    const [pendingAction, setPendingAction] = useState(null);
    const [actionInProgress, setActionInProgress] = useState(false);

    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [stopDialogOpen, setStopDialogOpen] = useState(false);
    const [unprovisionDialogOpen, setUnprovisionDialogOpen] = useState(false);
    const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
    const [simpleDialogOpen, setSimpleDialogOpen] = useState(false);
    const [consoleDialogOpen, setConsoleDialogOpen] = useState(false);
    const [consoleUrlDialogOpen, setConsoleUrlDialogOpen] = useState(false);
    const [currentConsoleUrl, setCurrentConsoleUrl] = useState(null);

    const [seats, setSeats] = useState(1);
    const [greetTimeout, setGreetTimeout] = useState("5s");
    const [checkboxes, setCheckboxes] = useState(DEFAULT_CHECKBOXES);
    const [stopCheckbox, setStopCheckbox] = useState(DEFAULT_STOP_CHECKBOX);
    const [unprovisionCheckboxes, setUnprovisionCheckboxes] = useState(DEFAULT_UNPROVISION_CHECKBOXES);
    const [purgeCheckboxes, setPurgeCheckboxes] = useState(DEFAULT_PURGE_CHECKBOXES);
    const [snackbar, setSnackbar] = useState({open: false, message: "", severity: "success"});

    const [initialLoading, setInitialLoading] = useState(true);
    const [initialDataError, setInitialDataError] = useState(null);

    const [logsDrawerOpen, setLogsDrawerOpen] = useState(false);
    const [selectedNodeForLogs, setSelectedNodeForLogs] = useState(null);
    const [selectedInstanceForLogs, setSelectedInstanceForLogs] = useState(null);
    const [drawerWidth, setDrawerWidth] = useState(600);
    const minDrawerWidth = 300;
    const maxDrawerWidth = window.innerWidth * 0.8;

    const objectEventTypes = useMemo(() => [
        "ObjectStatusUpdated",
        "InstanceStatusUpdated",
        "ObjectDeleted",
        "InstanceMonitorUpdated",
        "InstanceConfigUpdated",
        "CONNECTION_OPENED",
        "CONNECTION_ERROR",
        "RECONNECTION_ATTEMPT",
        "MAX_RECONNECTIONS_REACHED",
        "CONNECTION_CLOSED"
    ], []);

    const lastFetch = useRef({});
    const isProcessingConfigUpdate = useRef(false);
    const isMounted = useRef(true);

    const objectData = useMemo(() => {
        const avail = objectStatus?.avail || "n/a";
        const frozen = objectStatus?.frozen === "frozen" ? "frozen" : "unfrozen";
        let globalExpect = null;
        if (objectInstanceStatus) {
            for (const node of Object.keys(objectInstanceStatus)) {
                const monitorKey = `${node}:${decodedObjectName}`;
                const monitor = instanceMonitor[monitorKey] || {};
                if (monitor.global_expect && monitor.global_expect !== "none") {
                    globalExpect = monitor.global_expect;
                    break;
                }
            }
        }
        return {avail, frozen, globalExpect};
    }, [objectStatus, objectInstanceStatus, instanceMonitor, decodedObjectName]);

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

    const nodesList = useMemo(() => Object.keys(memoizedObjectData), [memoizedObjectData]);

    const fetchInitialObjectData = useCallback(async () => {
        setInitialDataError(null);
        const token = localStorage.getItem("authToken");
        if (!token) {
            setInitialDataError("Auth token not found");
            return;
        }
        try {
            const {namespace, kind, name: objName} = parseObjectPath(decodedObjectName);
            const objRes = await fetch(`${URL_OBJECT}/${namespace}/${kind}/${objName}`, {
                headers: {Authorization: `Bearer ${token}`},
                cache: "no-cache",
            });
            let objectData = null;
            if (objRes.ok) objectData = await objRes.json();

            const instRes = await fetch(`${URL_NODE}/all/instance/path/${namespace}/${kind}/${objName}`, {
                headers: {Authorization: `Bearer ${token}`},
                cache: "no-cache",
            });
            let instancesData = {};
            if (instRes.ok) instancesData = await instRes.json();

            const store = useEventStore.getState();
            if (objectData) store.setObjectStatuses({[decodedObjectName]: objectData});
            if (Object.keys(instancesData).length > 0) store.setInstanceStatuses({[decodedObjectName]: instancesData});
        } catch (err) {
            logger.error("Failed to fetch initial object data:", err);
            setInitialDataError(err.message);
        }
    }, [decodedObjectName]);

    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            const filters = objectEventTypes.map(type => {
                if (["CONNECTION_OPENED", "CONNECTION_ERROR", "RECONNECTION_ATTEMPT", "MAX_RECONNECTIONS_REACHED", "CONNECTION_CLOSED"].includes(type)) {
                    return type;
                } else {
                    return `${type},path=${decodedObjectName}`;
                }
            });
            startEventReception(token, filters);
        }
        return () => closeEventSource();
    }, [decodedObjectName, objectEventTypes]);

    useEffect(() => {
        const hasData = objectInstanceStatus && Object.keys(objectInstanceStatus).length > 0;
        if (!hasData) {
            fetchInitialObjectData().finally(() => setInitialLoading(false));
        } else {
            setInitialLoading(false);
        }
    }, [objectInstanceStatus, fetchInitialObjectData]);

    const openSnackbar = useCallback((msg, sev = "success") => {
        setSnackbar({open: true, message: msg, severity: sev});
    }, []);
    const closeSnackbar = useCallback(() => setSnackbar((s) => ({...s, open: false})), []);

    const postActionUrl = useCallback(({node, objectName, action}) => {
        const {namespace, kind, name} = parseObjectPath(objectName);
        return `${URL_NODE}/${node}/instance/path/${namespace}/${kind}/${name}/action/${action}`;
    }, []);

    const postConsoleAction = useCallback(async ({node, rid, seats = 1, greet_timeout = "5s"}) => {
        const token = localStorage.getItem("authToken");
        if (!token) {
            openSnackbar("Auth token not found.", "error");
            return;
        }
        setActionInProgress(true);
        openSnackbar(`Opening console for resource ${rid}...`, "info");
        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const url = `${URL_NODE}/${node}/instance/path/${namespace}/${kind}/${name}/console?rid=${encodeURIComponent(rid)}&seats=${seats}&greet_timeout=${encodeURIComponent(greet_timeout)}`;
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
            });
            if (!response.ok) {
                const serverError = await getResponseErrorMessage(response);
                openSnackbar(`Failed to open console: HTTP error! status: ${response.status}${serverError ? ` - ${serverError}` : ""}`, "error");
                return;
            }
            const consoleUrl = response.headers.get('Location');
            if (consoleUrl) {
                setCurrentConsoleUrl(consoleUrl);
                setConsoleUrlDialogOpen(true);
                openSnackbar(`Console URL retrieved for resource '${rid}'`);
            } else {
                openSnackbar('Failed to open console: Console URL not found in response', "error");
            }
        } catch (err) {
            openSnackbar(`Failed to open console: ${err.message}`, "error");
        } finally {
            setActionInProgress(false);
        }
    }, [decodedObjectName, openSnackbar]);

    const postObjectAction = useCallback(async ({action}) => {
        const token = localStorage.getItem("authToken");
        if (!token) return openSnackbar("Auth token not found.", "error");
        setActionInProgress(true);
        openSnackbar(`Executing ${action} on object…`, "info");
        const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/action/${action}`;
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

    const fetchConfig = useCallback(async (node) => {
        if (!node || !decodedObjectName) {
            setConfigError("No node or object available to fetch configuration.");
            return;
        }
        const key = `${decodedObjectName}:${node}`;
        const now = Date.now();
        if (lastFetch.current[key] && now - lastFetch.current[key] < 1000) return;
        lastFetch.current[key] = now;
        if (configLoading) return;

        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken");
        if (!token) {
            setConfigError("Auth token not found.");
            return;
        }
        setConfigLoading(true);
        setConfigError(null);
        setConfigNode(node);
        const url = `${URL_NODE}/${node}/instance/path/${namespace}/${kind}/${name}/config/file`;
        try {
            const fetchResponse = await Promise.race([
                fetch(url, {headers: {Authorization: `Bearer ${token}`}, cache: "no-cache"}),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Fetch config timeout")), 10000)),
            ]);
            if (!fetchResponse.ok) {
                setConfigError(`Failed to fetch config: HTTP error! status: ${fetchResponse.status}`);
                return;
            }
            const text = await fetchResponse.text();
            if (isMounted.current) return text;
        } catch (err) {
            if (isMounted.current) setConfigError(err.message);
        } finally {
            if (isMounted.current) setConfigLoading(false);
        }
    }, [decodedObjectName, configLoading]);

    const openActionDialog = useCallback((action, context = null) => {
        setPendingAction({action, ...(context ? context : {})});
        setSeats(1);
        setGreetTimeout("5s");
        if (action === "console") {
            setConsoleDialogOpen(true);
        } else if (action === "freeze") {
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
            selectedNodes.forEach(node => node && postNodeAction({node, action: pendingAction.action}).catch(() => {
            }));
            setSelectedNodes([]);
        } else if (pendingAction.node && !pendingAction.rid) {
            postNodeAction({node: pendingAction.node, action: pendingAction.action}).catch(() => {
            });
        } else {
            postObjectAction({action: pendingAction.action}).catch(() => {
            });
        }
        setPendingAction(null);
        setConfirmDialogOpen(false);
        setStopDialogOpen(false);
        setUnprovisionDialogOpen(false);
        setPurgeDialogOpen(false);
        setSimpleDialogOpen(false);
    }, [pendingAction, selectedNodes, postNodeAction, postObjectAction]);

    const handleConsoleConfirm = useCallback(() => {
        if (pendingAction && pendingAction.action === "console" && pendingAction.node && pendingAction.rid) {
            postConsoleAction({
                node: pendingAction.node,
                rid: pendingAction.rid,
                seats,
                greet_timeout: greetTimeout
            }).catch(() => {
            });
        }
        setConsoleDialogOpen(false);
        setPendingAction(null);
    }, [pendingAction, seats, greetTimeout, postConsoleAction]);

    const toggleNode = useCallback((node) => {
        setSelectedNodes(prev => prev.includes(node) ? prev.filter(n => n !== node) : [...prev, node]);
    }, []);

    const handleBatchNodeActionClick = (action) => {
        openActionDialog(action, {batch: "nodes"});
        setActionsMenuAnchor(null);
    };

    const handleIndividualNodeActionClick = (action) => {
        if (!currentNode) return;
        openActionDialog(action, {node: currentNode});
        setIndividualNodeMenuAnchor(null);
    };

    const handleObjectActionClick = (action) => {
        openActionDialog(action);
        setObjectMenuAnchor(null);
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

    const getColor = useCallback((status) => {
        if (status === "up" || status === true) return green[500];
        if (status === "down" || status === false) return red[500];
        if (status === "warn") return orange[500];
        return grey[500];
    }, []);

    const getNodeState = useCallback((node) => {
        const nodeStatus = objectInstanceStatus?.[node] || {};
        const monitor = instanceMonitor[`${node}:${decodedObjectName}`] || {};
        const avail = nodeStatus.avail || '';
        const frozen = nodeStatus.frozen_at && nodeStatus.frozen_at !== "0001-01-01T00:00:00Z" ? "frozen" : "unfrozen";
        const state = monitor.state !== "idle" ? monitor.state : null;
        return {avail, frozen, state};
    }, [objectInstanceStatus, instanceMonitor, decodedObjectName]);

    const startResizing = useCallback((e) => {
        e.preventDefault();
        const isTouch = e.type === 'touchstart';
        const startX = isTouch ? e.touches[0].clientX : e.clientX;
        const startWidth = drawerWidth;
        const doResize = (moveEvent) => {
            const currentX = isTouch ? moveEvent.touches[0].clientX : moveEvent.clientX;
            const newWidth = startWidth + (startX - currentX);
            if (newWidth >= minDrawerWidth && newWidth <= maxDrawerWidth) setDrawerWidth(newWidth);
        };
        const stopResize = () => {
            if (isTouch) {
                document.removeEventListener("touchmove", doResize);
                document.removeEventListener("touchend", stopResize);
            } else {
                document.removeEventListener("mousemove", doResize);
                document.removeEventListener("mouseup", stopResize);
            }
            document.body.style.cursor = "default";
        };
        if (isTouch) {
            document.addEventListener("touchmove", doResize, {passive: false});
            document.addEventListener("touchend", stopResize);
        } else {
            document.addEventListener("mousemove", doResize);
            document.addEventListener("mouseup", stopResize);
        }
        document.body.style.cursor = "ew-resize";
    }, [drawerWidth, minDrawerWidth, maxDrawerWidth]);

    useEffect(() => {
        const loadInitialConfig = async () => {
            if (objectInstanceStatus && Object.keys(objectInstanceStatus).length > 0) {
                const nodes = Object.keys(objectInstanceStatus);
                const initialNode = nodes.find((node) => {
                    const nodeData = objectInstanceStatus[node];
                    return nodeData?.encap && Object.values(nodeData.encap).some(
                        (container) => container.resources && Object.keys(container.resources).length > 0
                    );
                }) || nodes[0];
                if (initialNode) {
                    await fetchConfig(initialNode);
                }
            }
        };
        loadInitialConfig();
    }, [objectInstanceStatus, fetchConfig]);

    useEffect(() => {
        let unsubscribe = null;
        try {
            const maybeUnsubscribe = useEventStore.subscribe(
                (state) => state.configUpdates,
                async (updates) => {
                    if (!isMounted.current || isProcessingConfigUpdate.current) return;
                    isProcessingConfigUpdate.current = true;
                    try {
                        const {name} = parseObjectPath(decodedObjectName);
                        const matchingUpdate = updates.find(
                            (u) => (u.name === name || u.fullName === decodedObjectName) && u.node
                        );
                        if (matchingUpdate && matchingUpdate.node) {
                            await fetchConfig(matchingUpdate.node);
                            setConfigDialogOpen(true);
                            openSnackbar("Configuration updated", "info");
                            clearConfigUpdate(decodedObjectName);
                        }
                    } catch (err) {
                        openSnackbar("Failed to load updated configuration", "error");
                    } finally {
                        isProcessingConfigUpdate.current = false;
                    }
                },
                {fireImmediately: false}
            );
            if (typeof maybeUnsubscribe === 'function') {
                unsubscribe = maybeUnsubscribe;
            } else {
                logger.warn("[ObjectDetail] Subscription is not a function:", maybeUnsubscribe);
            }
        } catch (err) {
            logger.warn("[ObjectDetail] Failed to subscribe to configUpdates:", err);
        }
        return () => {
            if (typeof unsubscribe === 'function') unsubscribe();
        };
    }, [decodedObjectName, clearConfigUpdate, fetchConfig, openSnackbar]);

    useEffect(() => {
        let unsubscribe = null;
        try {
            const maybeUnsubscribe = useEventStore.subscribe(
                (state) => state.instanceConfig,
                (newConfig) => {
                    const config = newConfig[decodedObjectName];
                    if (config && configNode) {
                        setConfigDialogOpen(true);
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

    if (initialLoading) {
        return (
            <Box p={4} display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
                <CircularProgress/>
                <Typography ml={2}>Loading object data...</Typography>
            </Box>
        );
    }

    if (nodesList.length === 0 && !initialDataError) {
        return (
            <Box p={4}>
                <Typography variant="h5" sx={{mb: 2}}>{decodedObjectName}</Typography>
                <Typography align="center" color="textSecondary" fontSize="1.2rem">
                    No information available for object.
                </Typography>
                {showKeys && <KeysSection decodedObjectName={decodedObjectName} openSnackbar={openSnackbar}/>}
                <ConfigSection
                    decodedObjectName={decodedObjectName}
                    configNode={configNode}
                    setConfigNode={setConfigNode}
                    openSnackbar={openSnackbar}
                    configDialogOpen={configDialogOpen}
                    setConfigDialogOpen={setConfigDialogOpen}
                />
                {configError && <Alert severity="error" sx={{mt: 2}}>{configError}</Alert>}
            </Box>
        );
    }

    return (
        <Box sx={{
            display: "flex",
            flexDirection: "row",
            width: "100vw",
            minHeight: "100vh",
            overflow: "hidden",
            boxSizing: "border-box",
            position: 'relative',
            margin: 0,
            p: 0
        }}>
            <Box sx={{
                flex: logsDrawerOpen ? `0 0 calc(100% - ${drawerWidth}px)` : "1 1 100%",
                overflow: "auto",
                boxSizing: "border-box",
                maxWidth: logsDrawerOpen ? `calc(100% - ${drawerWidth}px)` : "100%",
                transition: theme.transitions.create(["flex", "maxWidth"], {
                    easing: theme.transitions.easing.sharp,
                    duration: theme.transitions.duration.enteringScreen,
                }),
            }}>
                <Box sx={{
                    width: "100%",
                    margin: "0 auto",
                    px: 2,
                    py: 4,
                    boxSizing: "border-box",
                    bgcolor: "background.paper",
                    border: "2px solid",
                    borderColor: "divider",
                    borderRadius: 0,
                    boxShadow: 3
                }}>
                    <Grid container spacing={2} alignItems="flex-start">
                        <Grid item xs={12} md={10}>
                            <HeaderSection
                                decodedObjectName={decodedObjectName}
                                globalStatus={objectStatus}
                                actionInProgress={actionInProgress}
                                objectMenuAnchor={objectMenuAnchor}
                                setObjectMenuAnchor={setObjectMenuAnchor}
                                handleObjectActionClick={handleObjectActionClick}
                                getObjectStatus={() => objectData}
                                getColor={getColor}
                            />
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <ConfigSection
                                decodedObjectName={decodedObjectName}
                                configNode={configNode}
                                setConfigNode={setConfigNode}
                                openSnackbar={openSnackbar}
                                configDialogOpen={configDialogOpen}
                                setConfigDialogOpen={setConfigDialogOpen}
                            />
                        </Grid>
                    </Grid>

                    {pendingAction && pendingAction.action !== "console" && (
                        <ActionDialogManager
                            pendingAction={pendingAction}
                            handleConfirm={handleDialogConfirm}
                            target={`object ${decodedObjectName}`}
                            supportedActions={pendingAction?.batch === "nodes" ? INSTANCE_ACTIONS.map(a => a.name) : OBJECT_ACTIONS.map(a => a.name)}
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

                    <Dialog open={consoleDialogOpen} onClose={() => setConsoleDialogOpen(false)} maxWidth="sm"
                            fullWidth>
                        <DialogTitle>Open Console</DialogTitle>
                        <DialogContent>
                            <Typography variant="body1" sx={{mb: 2}}>This will open a terminal console for the selected
                                resource.</Typography>
                            {pendingAction?.rid && <Typography variant="body2" color="primary" sx={{
                                mb: 2,
                                fontWeight: 'bold'
                            }}>Resource: {pendingAction.rid}</Typography>}
                            {pendingAction?.node && <Typography variant="body2" color="text.secondary"
                                                                sx={{mb: 2}}>Node: {pendingAction.node}</Typography>}
                            <Box sx={{mb: 2}}>
                                <TextField autoFocus margin="dense" label="Number of Seats" type="number" fullWidth
                                           variant="outlined" value={seats}
                                           onChange={(e) => setSeats(Math.max(1, parseInt(e.target.value) || 1))}
                                           helperText="Number of simultaneous users allowed in the console"/>
                            </Box>
                            <TextField margin="dense" label="Greet Timeout" type="text" fullWidth variant="outlined"
                                       value={greetTimeout}
                                       onChange={(e) => setGreetTimeout(e.target.value)}
                                       helperText="Time to wait for console connection (e.g., 5s, 10s)"/>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setConsoleDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleConsoleConfirm}>Open Console</Button>
                        </DialogActions>
                    </Dialog>

                    <Dialog open={consoleUrlDialogOpen} onClose={() => setConsoleUrlDialogOpen(false)} maxWidth="sm"
                            fullWidth>
                        <DialogTitle>Console URL</DialogTitle>
                        <DialogContent>
                            <Box sx={{
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                padding: {xs: '8px 10px', sm: '12px 14px'},
                                backgroundColor: '#f5f5f5',
                                marginBottom: 2,
                                overflow: 'auto',
                                maxHeight: '100px',
                                fontFamily: 'monospace',
                                fontSize: {xs: '0.75rem', sm: '0.875rem'},
                                wordBreak: 'break-all',
                                whiteSpace: 'pre-wrap'
                            }}>
                                {currentConsoleUrl ? String(currentConsoleUrl) : 'No URL available'}
                            </Box>
                            <Box sx={{
                                display: 'flex',
                                gap: 2,
                                flexWrap: 'wrap',
                                justifyContent: {xs: 'center', sm: 'flex-start'}
                            }}>
                                <Button variant="outlined" size={window.innerWidth < 600 ? "small" : "medium"}
                                        onClick={() => {
                                            if (currentConsoleUrl) navigator.clipboard.writeText(String(currentConsoleUrl));
                                        }} disabled={!currentConsoleUrl}>Copy URL</Button>
                                <Button variant="contained" size={window.innerWidth < 600 ? "small" : "medium"}
                                        onClick={() => {
                                            if (currentConsoleUrl) window.open(String(currentConsoleUrl), '_blank', 'noopener,noreferrer');
                                        }} disabled={!currentConsoleUrl}>Open in New Tab</Button>
                            </Box>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setConsoleUrlDialogOpen(false)}>Close</Button>
                        </DialogActions>
                    </Dialog>

                    {showKeys && <KeysSection decodedObjectName={decodedObjectName} openSnackbar={openSnackbar}/>}

                    {!["sec", "cfg", "usr"].includes(kind) && (
                        <>
                            <Box sx={{display: "flex", alignItems: "center", gap: 1, mb: 2}}>
                                <Button
                                    variant="outlined"
                                    onClick={(e) => setActionsMenuAnchor(e.currentTarget)}
                                    disabled={selectedNodes.length === 0}
                                >
                                    Actions on Selected Nodes ({selectedNodes.length})
                                </Button>
                            </Box>

                            <Menu
                                anchorEl={actionsMenuAnchor}
                                open={Boolean(actionsMenuAnchor)}
                                onClose={() => setActionsMenuAnchor(null)}
                                anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                                transformOrigin={{vertical: 'top', horizontal: 'right'}}
                            >
                                {INSTANCE_ACTIONS.map(({name, icon}) => (
                                    <MenuItem key={name} onClick={() => handleBatchNodeActionClick(name)}>
                                        <ListItemIcon>{icon}</ListItemIcon>
                                        <ListItemText>{name.charAt(0).toUpperCase() + name.slice(1)}</ListItemText>
                                    </MenuItem>
                                ))}
                            </Menu>

                            {nodesList.map(node => (
                                <InstanceCard
                                    key={node}
                                    node={node}
                                    nodeData={memoizedObjectData[node] || {}}
                                    selectedNodes={selectedNodes}
                                    toggleNode={toggleNode}
                                    actionInProgress={actionInProgress}
                                    setIndividualNodeMenuAnchor={setIndividualNodeMenuAnchor}
                                    setCurrentNode={setCurrentNode}
                                    handleIndividualNodeActionClick={handleIndividualNodeActionClick}
                                    getColor={getColor}
                                    getNodeState={getNodeState}
                                    parseProvisionedState={parseProvisionedState}
                                    setPendingAction={setPendingAction}
                                    setSimpleDialogOpen={setSimpleDialogOpen}
                                    namespace={namespace}
                                    kind={kind}
                                    instanceName={name}
                                    onOpenLogs={handleOpenLogs}
                                    onViewInstance={handleViewInstance}
                                />
                            ))}

                            <Menu
                                anchorEl={individualNodeMenuAnchor}
                                open={Boolean(individualNodeMenuAnchor)}
                                onClose={() => setIndividualNodeMenuAnchor(null)}
                                anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                                transformOrigin={{vertical: 'top', horizontal: 'right'}}
                            >
                                {INSTANCE_ACTIONS.map(({name, icon}) => (
                                    <MenuItem key={name} onClick={() => handleIndividualNodeActionClick(name)}>
                                        <ListItemIcon>{icon}</ListItemIcon>
                                        <ListItemText>{name.charAt(0).toUpperCase() + name.slice(1)}</ListItemText>
                                    </MenuItem>
                                ))}
                            </Menu>
                        </>
                    )}

                    {configError && <Alert severity="error" sx={{mt: 2}}>{configError}</Alert>}

                    <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={closeSnackbar}
                              anchorOrigin={{vertical: "bottom", horizontal: "center"}}>
                        <Alert onClose={closeSnackbar} severity={snackbar.severity}
                               variant="filled">{snackbar.message}</Alert>
                    </Snackbar>
                </Box>
            </Box>

            {logsDrawerOpen && selectedNodeForLogs && (
                <Drawer anchor="right" open={logsDrawerOpen} variant="persistent" sx={{
                    "& .MuiDrawer-paper": {
                        width: `${drawerWidth}px`,
                        maxWidth: "80vw",
                        p: 2,
                        boxSizing: "border-box",
                        backgroundColor: theme.palette.background.paper,
                        top: 0,
                        height: "100vh",
                        overflow: "auto",
                        borderLeft: `1px solid ${theme.palette.divider}`,
                        transition: theme.transitions.create("width", {
                            easing: theme.transitions.easing.sharp,
                            duration: theme.transitions.duration.enteringScreen
                        })
                    }
                }}>
                    <Box sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "6px",
                        height: "100%",
                        cursor: "ew-resize",
                        bgcolor: theme.palette.grey[300],
                        "&:hover": {bgcolor: theme.palette.primary.light},
                        transition: "background-color 0.2s"
                    }} onMouseDown={startResizing} onTouchStart={startResizing} aria-label="Resize drawer"/>
                    <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
                        <Typography
                            variant="h6">{selectedInstanceForLogs ? `Instance Logs - ${selectedInstanceForLogs}` : `Node Logs - ${selectedNodeForLogs}`}</Typography>
                        <IconButton onClick={handleCloseLogsDrawer}><CloseIcon/></IconButton>
                    </Box>
                    <LogsViewer nodename={selectedNodeForLogs} type={selectedInstanceForLogs ? "instance" : "node"}
                                namespace={namespace} kind={kind} instanceName={selectedInstanceForLogs}
                                height="calc(100vh - 100px)"/>
                </Drawer>
            )}

            <EventLogger eventTypes={objectEventTypes} objectName={decodedObjectName}
                         title={`Events - ${decodedObjectName}`} buttonLabel="Object Events"/>
        </Box>
    );
};

export default ObjectDetail;
