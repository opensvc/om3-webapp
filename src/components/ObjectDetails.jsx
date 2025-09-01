import React, {useState, useMemo, useEffect, useRef} from "react";
import {useParams} from "react-router-dom";
import {
    Box,
    Typography,
    Snackbar,
    Alert,
    Menu,
    MenuItem,
    Button,
    ListItemIcon,
    ListItemText,
    CircularProgress,
} from "@mui/material";
import {green, red, grey, blue, orange} from "@mui/material/colors";
import useEventStore from "../hooks/useEventStore.js";
import {closeEventSource, startEventReception} from "../eventSourceManager.jsx";
import {URL_OBJECT, URL_NODE} from "../config/apiPath.js";
import ActionDialogManager from "../components/ActionDialogManager";
import {ManageConfigParamsDialog} from "./ActionDialogs";
import HeaderSection from "./HeaderSection";
import ConfigSection from "./ConfigSection";
import KeysSection from "./KeysSection";
import NodeCard from "./NodeCard";
import {OBJECT_ACTIONS, INSTANCE_ACTIONS, RESOURCE_ACTIONS} from "../constants/actions";

// Helper function to filter resource actions based on type
const getFilteredResourceActions = (resourceType) => {
    if (!resourceType) {
        return RESOURCE_ACTIONS;
    }
    const typePrefix = resourceType.split('.')[0].toLowerCase();
    if (typePrefix === 'task') {
        return RESOURCE_ACTIONS.filter(action => action.name === 'run');
    }
    if (['fs', 'disk', 'app', 'container'].includes(typePrefix)) {
        return RESOURCE_ACTIONS.filter(action => action.name !== 'run');
    }
    return RESOURCE_ACTIONS;
};

// Helper function to get resource type for a given resource ID
const getResourceType = (rid, nodeData) => {
    if (!rid) {
        console.warn("getResourceType called with undefined or null rid");
        return '';
    }
    const topLevelType = nodeData?.resources?.[rid]?.type;
    if (topLevelType) {
        return topLevelType;
    }
    const encapData = nodeData?.encap || {};
    for (const containerId of Object.keys(encapData)) {
        const encapType = encapData[containerId]?.resources?.[rid]?.type;
        if (encapType) {
            return encapType;
        }
    }
    console.warn(`Resource type not found for rid: ${rid}, returning empty string`);
    return '';
};

const ObjectDetail = () => {
    const {objectName} = useParams();
    const decodedObjectName = decodeURIComponent(objectName);

    const objectStatus = useEventStore((s) => s.objectStatus);
    const objectInstanceStatus = useEventStore((s) => s.objectInstanceStatus);
    const instanceMonitor = useEventStore((s) => s.instanceMonitor);
    const instanceConfig = useEventStore((s) => s.instanceConfig);
    const clearConfigUpdate = useEventStore((s) => s.clearConfigUpdate);
    const objectData = objectInstanceStatus?.[decodedObjectName];

    // State for configuration
    const [configData, setConfigData] = useState(null);
    const [configLoading, setConfigLoading] = useState(false);
    const [configError, setConfigError] = useState(null);
    const [configAccordionExpanded, setConfigAccordionExpanded] = useState(false);
    const [manageParamsDialogOpen, setManageParamsDialogOpen] = useState(false);
    const [paramsToSet, setParamsToSet] = useState("");
    const [paramsToUnset, setParamsToUnset] = useState("");
    const [paramsToDelete, setParamsToDelete] = useState("");
    const [configNode, setConfigNode] = useState(null);

    // State for batch selection & actions
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [nodesActionsAnchor, setNodesActionsAnchor] = useState(null);
    const [individualNodeMenuAnchor, setIndividualNodeMenuAnchor] = useState(null);
    const [currentNode, setCurrentNode] = useState(null);
    const [selectedResourcesByNode, setSelectedResourcesByNode] = useState({});
    const [resGroupNode, setResGroupNode] = useState(null);
    const [resourcesActionsAnchor, setResourcesActionsAnchor] = useState(null);
    const [resourceMenuAnchor, setResourceMenuAnchor] = useState(null);
    const [currentResourceId, setCurrentResourceId] = useState(null);

    // State for dialogs & snackbar
    const [objectMenuAnchor, setObjectMenuAnchor] = useState(null);
    const [pendingAction, setPendingAction] = useState(null);
    const [actionInProgress, setActionInProgress] = useState(false);

    // State for dialog management
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [stopDialogOpen, setStopDialogOpen] = useState(false);
    const [unprovisionDialogOpen, setUnprovisionDialogOpen] = useState(false);
    const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
    const [simpleDialogOpen, setSimpleDialogOpen] = useState(false);
    const [checkboxes, setCheckboxes] = useState({failover: false});
    const [stopCheckbox, setStopCheckbox] = useState(false);
    const [unprovisionCheckboxes, setUnprovisionCheckboxes] = useState({
        dataLoss: false,
        serviceInterruption: false,
    });
    const [purgeCheckboxes, setPurgeCheckboxes] = useState({
        dataLoss: false,
        configLoss: false,
        serviceInterruption: false,
    });

    const [snackbar, setSnackbar] = useState({
        open: false,
        message: "",
        severity: "success",
    });

    // State for accordion expansion
    const [expandedResources, setExpandedResources] = useState({});
    const [expandedNodeResources, setExpandedNodeResources] = useState({});

    // State for initial loading
    const [initialLoading, setInitialLoading] = useState(true);

    // Debounce ref to prevent multiple fetchConfig calls
    const lastFetch = useRef({});
    // Ref to track subscription status
    const isProcessingConfigUpdate = useRef(false);
    // Ref to track if component is mounted
    const isMounted = useRef(true);

    // Cleanup on unmount
    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
            closeEventSource();
        };
    }, [decodedObjectName]);

    // Initialize and update accordion states for nodes and resources
    useEffect(() => {
        if (!objectData) return;
        const nodes = Object.keys(objectInstanceStatus[decodedObjectName] || {});
        setExpandedNodeResources((prev) => {
            const updatedNodeResources = {...prev};
            nodes.forEach((node) => {
                if (!(node in updatedNodeResources)) {
                    updatedNodeResources[node] = false;
                }
            });
            Object.keys(updatedNodeResources).forEach((node) => {
                if (!nodes.includes(node)) {
                    delete updatedNodeResources[node];
                }
            });
            return updatedNodeResources;
        });

        setExpandedResources((prev) => {
            const updatedResources = {...prev};
            nodes.forEach((node) => {
                const resources = objectInstanceStatus[decodedObjectName]?.[node]?.resources || {};
                Object.keys(resources).forEach((rid) => {
                    const key = `${node}:${rid}`;
                    if (!(key in updatedResources)) {
                        updatedResources[key] = false;
                    }
                });
            });
            Object.keys(updatedResources).forEach((key) => {
                const [node] = key.split(":");
                if (
                    !nodes.includes(node) ||
                    !(objectInstanceStatus[decodedObjectName]?.[node]?.resources?.[key.split(":")[1]])
                ) {
                    delete updatedResources[key];
                }
            });
            return updatedResources;
        });
    }, [objectInstanceStatus, decodedObjectName]);

    const openSnackbar = (msg, sev = "success") =>
        setSnackbar({open: true, message: msg, severity: sev});
    const closeSnackbar = () => setSnackbar((s) => ({...s, open: false}));

    // Helper function to parse provisioned state
    const parseProvisionedState = (state) => {
        if (typeof state === "string") {
            return state.toLowerCase() === "true";
        }
        return !!state;
    };

    // Helper functions
    const parseObjectPath = (objName) => {
        if (!objName || typeof objName !== "string") {
            return {namespace: "root", kind: "svc", name: ""};
        }

        const parts = objName.split("/");
        let name, kind, namespace;

        if (parts.length === 3) {
            namespace = parts[0];
            kind = parts[1];
            name = parts[2];
        } else if (parts.length === 2) {
            namespace = "root";
            kind = parts[0];
            name = parts[1];
        } else {
            namespace = "root";
            name = parts[0];
            kind = name === "cluster" ? "ccfg" : "svc";
        }

        return {namespace, kind, name};
    };

    const postObjectAction = async ({action}) => {
        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken");
        if (!token) return openSnackbar("Auth token not found.", "error");

        setActionInProgress(true);
        openSnackbar(`Executing ${action} on object…`, "info");
        const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/action/${action}`;
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {Authorization: `Bearer ${token}`},
            });
            if (!res.ok) throw new Error(`Failed to execute ${action}`);
            openSnackbar(`'${action}' succeeded on object`);
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
        } finally {
            setActionInProgress(false);
        }
    };

    const postNodeAction = async ({node, action}) => {
        const token = localStorage.getItem("authToken");
        if (!token) return openSnackbar("Auth token not found.", "error");

        setActionInProgress(true);
        openSnackbar(`Executing ${action} on node ${node}…`, "info");
        const url = postActionUrl({node, objectName: decodedObjectName, action});
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {Authorization: `Bearer ${token}`},
            });
            if (!res.ok) throw new Error(`Failed to execute ${action}`);
            openSnackbar(`'${action}' succeeded on node '${node}'`);
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
        } finally {
            setActionInProgress(false);
        }
    };

    const postActionUrl = ({node, objectName, action}) => {
        const {namespace, kind, name} = parseObjectPath(objectName);
        return `${URL_NODE}/${node}/instance/path/${namespace}/${kind}/${name}/action/${action}`;
    };

    const postResourceAction = async ({node, action, rid}) => {
        const token = localStorage.getItem("authToken");
        if (!token) return openSnackbar("Auth token not found.", "error");

        setActionInProgress(true);
        openSnackbar(`Executing ${action} on resource ${rid}…`, "info");
        const url =
            postActionUrl({node, objectName: decodedObjectName, action}) +
            `?rid=${encodeURIComponent(rid)}`;
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {Authorization: `Bearer ${token}`},
            });
            if (!res.ok) throw new Error(`Failed to execute ${action}`);
            openSnackbar(`'${action}' succeeded on resource '${rid}'`);
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
        } finally {
            setActionInProgress(false);
        }
    };

    // Fetch configuration for the object
    const fetchConfig = async (node) => {
        if (!node) {
            setConfigError("No node available to fetch configuration.");
            return;
        }
        const key = `${decodedObjectName}:${node}`;
        const now = Date.now();
        if (lastFetch.current[key] && now - lastFetch.current[key] < 1000) {
            return;
        }
        lastFetch.current[key] = now;
        if (configLoading) {
            return;
        }
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
            const response = await Promise.race([
                fetch(url, {
                    headers: {Authorization: `Bearer ${token}`},
                    cache: "no-cache",
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Fetch config timeout")), 5000)),
            ]);
            if (!response.ok) {
                throw new Error(`Failed to fetch config: ${response.status}`);
            }
            const text = await response.text();
            if (isMounted.current) {
                setConfigData(text);
            }
            return text;
        } catch (err) {
            if (isMounted.current) {
                setConfigError(err.message);
            }
            throw err;
        } finally {
            if (isMounted.current) {
                setConfigLoading(false);
            }
        }
    };

    // Color helper
    const getColor = (status) => {
        if (status === "up" || status === true) return green[500];
        if (status === "down" || status === false) return red[500];
        if (status === "warn") return orange[500];
        return grey[500];
    };

    // Node state helper
    const getNodeState = (node) => {
        const instanceStatus = objectInstanceStatus[decodedObjectName] || {};
        const monitorKey = `${node}:${decodedObjectName}`;
        const monitor = instanceMonitor[monitorKey] || {};
        return {
            avail: instanceStatus[node]?.avail,
            frozen:
                instanceStatus[node]?.frozen_at &&
                instanceStatus[node]?.frozen_at !== "0001-01-01T00:00:00Z"
                    ? "frozen"
                    : "unfrozen",
            state: monitor.state !== "idle" ? monitor.state : null,
        };
    };

    // Object status helper
    const getObjectStatus = () => {
        const obj = objectStatus[decodedObjectName] || {};
        const avail = obj?.avail;
        const frozen = obj?.frozen;
        const nodes = Object.keys(objectInstanceStatus[decodedObjectName] || {});
        let globalExpect = null;
        for (const node of nodes) {
            const monitorKey = `${node}:${decodedObjectName}`;
            const monitor = instanceMonitor[monitorKey] || {};
            if (monitor.global_expect && monitor.global_expect !== "none") {
                globalExpect = monitor.global_expect;
                break;
            }
        }
        return {avail, frozen, globalExpect};
    };

    // Accordion handlers
    const handleNodeResourcesAccordionChange = (node) => (event, isExpanded) => {
        setExpandedNodeResources((prev) => ({
            ...prev,
            [node]: isExpanded,
        }));
    };

    const handleAccordionChange = (node, rid) => (event, isExpanded) => {
        setExpandedResources((prev) => ({
            ...prev,
            [`${node}:${rid}`]: isExpanded,
        }));
    };

    // Batch node actions handlers
    const handleNodesActionsOpen = (e) => setNodesActionsAnchor(e.currentTarget);
    const handleNodesActionsClose = () => setNodesActionsAnchor(null);
    const handleBatchNodeActionClick = (action) => {
        setPendingAction({action, batch: "nodes"});
        if (action === "freeze") {
            setCheckboxes({failover: false});
            setConfirmDialogOpen(true);
        } else if (action === "stop") {
            setStopCheckbox(false);
            setStopDialogOpen(true);
        } else if (action === "unprovision") {
            setUnprovisionCheckboxes({
                dataLoss: false,
                serviceInterruption: false,
            });
            setUnprovisionDialogOpen(true);
        } else if (action === "purge") {
            setPurgeCheckboxes({
                dataLoss: false,
                configLoss: false,
                serviceInterruption: false,
            });
            setPurgeDialogOpen(true);
        } else {
            setSimpleDialogOpen(true);
        }
        handleNodesActionsClose();
    };

    // Individual node actions handlers
    const handleIndividualNodeActionClick = (action) => {
        setPendingAction({action, node: currentNode});
        if (action === "freeze") {
            setCheckboxes({failover: false});
            setConfirmDialogOpen(true);
        } else if (action === "stop") {
            setStopCheckbox(false);
            setStopDialogOpen(true);
        } else if (action === "unprovision") {
            setUnprovisionCheckboxes({
                dataLoss: false,
                serviceInterruption: false,
            });
            setUnprovisionDialogOpen(true);
        } else if (action === "purge") {
            setPurgeCheckboxes({
                dataLoss: false,
                configLoss: false,
                serviceInterruption: false,
            });
            setPurgeDialogOpen(true);
        } else {
            setSimpleDialogOpen(true);
        }
        setIndividualNodeMenuAnchor(null);
    };

    // Batch resource actions handlers
    const handleResourcesActionsOpen = (node, e) => {
        setResGroupNode(node);
        setResourcesActionsAnchor(e.currentTarget);
    };
    const handleResourcesActionsClose = () => setResourcesActionsAnchor(null);
    const handleBatchResourceActionClick = (action) => {
        setPendingAction({action, batch: "resources", node: resGroupNode});
        setSimpleDialogOpen(true);
        handleResourcesActionsClose();
    };

    // Individual resource actions handlers
    const handleResourceMenuOpen = (node, rid, e) => {
        setCurrentResourceId(rid);
        setResGroupNode(node);
        setResourceMenuAnchor(e.currentTarget);
    };
    const handleResourceMenuClose = () => {
        setResourceMenuAnchor(null);
        setCurrentResourceId(null);
    };
    const handleResourceActionClick = (action) => {
        setPendingAction({action, node: resGroupNode, rid: currentResourceId});
        setSimpleDialogOpen(true);
        handleResourceMenuClose();
    };

    // Object action handler
    const handleObjectActionClick = (action) => {
        setPendingAction({action});
        if (action === "freeze") {
            setCheckboxes({failover: false});
            setConfirmDialogOpen(true);
        } else if (action === "stop") {
            setStopCheckbox(false);
            setStopDialogOpen(true);
        } else if (action === "unprovision") {
            setUnprovisionCheckboxes({
                dataLoss: false,
                serviceInterruption: false,
            });
            setUnprovisionDialogOpen(true);
        } else if (action === "purge") {
            setPurgeCheckboxes({
                dataLoss: false,
                configLoss: false,
                serviceInterruption: false,
            });
            setPurgeDialogOpen(true);
        } else {
            setSimpleDialogOpen(true);
        }
        setObjectMenuAnchor(null);
    };

    // Dialog confirm handler
    const handleDialogConfirm = () => {
        if (!pendingAction) {
            console.warn("No valid pendingAction or action provided:", pendingAction);
            return;
        }

        if (pendingAction.batch === "nodes") {
            selectedNodes.forEach((node) =>
                postNodeAction({node, action: pendingAction.action})
            );
            setSelectedNodes([]);
        } else if (pendingAction.node && !pendingAction.rid) {
            postNodeAction({node: pendingAction.node, action: pendingAction.action});
        } else if (pendingAction.batch === "resources") {
            const rids = selectedResourcesByNode[pendingAction.node] || [];
            rids.forEach((rid) =>
                postResourceAction({
                    node: pendingAction.node,
                    action: pendingAction.action,
                    rid,
                })
            );
            setSelectedResourcesByNode((prev) => ({
                ...prev,
                [pendingAction.node]: [],
            }));
        } else if (pendingAction.rid) {
            postResourceAction({
                node: pendingAction.node,
                action: pendingAction.action,
                rid: pendingAction.rid,
            });
        } else {
            postObjectAction(pendingAction);
        }

        setPendingAction(null);
        setConfirmDialogOpen(false);
        setStopDialogOpen(false);
        setUnprovisionDialogOpen(false);
        setPurgeDialogOpen(false);
        setSimpleDialogOpen(false);
    };

    // Selection helpers
    const toggleNode = (node) => {
        setSelectedNodes((prev) =>
            prev.includes(node) ? prev.filter((n) => n !== node) : [...prev, node]
        );
    };

    const toggleResource = (node, rid) => {
        setSelectedResourcesByNode((prev) => {
            const current = prev[node] || [];
            const next = current.includes(rid)
                ? current.filter((r) => r !== rid)
                : [...current, rid];
            return {...prev, [node]: next};
        });
    };

    // Effect for configuring EventSource
    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            const filters = [
                `ObjectStatusUpdated,path=${decodedObjectName}`,
                `InstanceStatusUpdated,path=${decodedObjectName}`,
                `ObjectDeleted,path=${decodedObjectName}`,
                `InstanceMonitorUpdated,path=${decodedObjectName}`,
                `InstanceConfigUpdated,path=${decodedObjectName}`,
            ];
            startEventReception(token, filters);
        }

        return () => {
            closeEventSource();
        };
    }, [decodedObjectName]);

    // Effect for handling config updates
    useEffect(() => {
        if (!isMounted.current) {
            return;
        }

        const subscription = useEventStore.subscribe(
            (state) => state.configUpdates,
            async (updates) => {
                if (!isMounted.current) {
                    return;
                }
                if (isProcessingConfigUpdate.current) {
                    return;
                }
                isProcessingConfigUpdate.current = true;
                try {
                    const {name} = parseObjectPath(decodedObjectName);
                    const matchingUpdate = updates.find(
                        (u) =>
                            (u.name === name || u.fullName === decodedObjectName) &&
                            u.node
                    );

                    if (matchingUpdate && matchingUpdate.node) {
                        try {
                            await fetchConfig(matchingUpdate.node);
                            setConfigAccordionExpanded(true);
                            openSnackbar("Configuration updated", "info");
                        } catch (err) {
                            openSnackbar("Failed to load updated configuration", "error");
                        } finally {
                            clearConfigUpdate(decodedObjectName);
                        }
                    } else {
                        console.log("[ObjectDetail] No valid node in config update, skipping fetchConfig");
                    }
                } finally {
                    isProcessingConfigUpdate.current = false;
                }
            }
        );

        return () => {
            if (typeof subscription !== "function") {
                console.warn("[ObjectDetail] Subscription is not a function:", subscription);
            }
            if (typeof subscription === "function") {
                subscription();
            }
        };
    }, [decodedObjectName, clearConfigUpdate]);

    // Effect for handling instance config updates
    useEffect(() => {
        if (!isMounted.current) {
            return;
        }

        const subscription = useEventStore.subscribe(
            (state) => state.instanceConfig,
            (newConfig) => {
                if (!isMounted.current) {
                    return;
                }
                const config = newConfig[decodedObjectName];
                if (config && configNode) {
                    try {
                        setConfigAccordionExpanded(true);
                        openSnackbar("Instance configuration updated", "info");
                    } catch (err) {
                        openSnackbar("Failed to process instance configuration update", "error");
                    }
                }
            }
        );

        return () => {
            if (typeof subscription !== "function") {
                console.warn("[ObjectDetail] Subscription is not a function:", subscription);
            }
            if (typeof subscription === "function") {
                subscription();
            }
        };
    }, [decodedObjectName, configNode]);

    // Initial load effects
    useEffect(() => {
        const loadInitialConfig = async () => {
            if (objectData) {
                const nodes = Object.keys(objectInstanceStatus[decodedObjectName] || {});
                const initialNode = nodes.find((node) => {
                    const hasValidEncapResources =
                        objectData[node]?.encap &&
                        Object.values(objectData[node].encap).some(
                            (container) => container.resources && Object.keys(container.resources).length > 0
                        );
                    return hasValidEncapResources;
                }) || nodes[0];

                if (initialNode) {
                    try {
                        await fetchConfig(initialNode);
                    } catch (err) {
                        setConfigError("Failed to load initial configuration.");
                    }
                } else {
                    setConfigError("No nodes available to fetch configuration.");
                }
            } else {
                setConfigError("No object data available.");
            }
            setInitialLoading(false);
        };

        loadInitialConfig();
    }, [decodedObjectName, objectData]);

    // Memoize data to prevent unnecessary re-renders
    const memoizedObjectData = useMemo(() => {
        const enhancedObjectData = {};
        if (objectData) {
            Object.keys(objectData).forEach((node) => {
                enhancedObjectData[node] = {
                    ...objectData[node],
                    instanceConfig: instanceConfig && instanceConfig[decodedObjectName] ? instanceConfig[decodedObjectName][node] || {resources: {}} : {resources: {}},
                    instanceMonitor: instanceMonitor[`${node}:${decodedObjectName}`] || {resources: {}},
                };
            });
        }
        return enhancedObjectData;
    }, [objectData, instanceConfig, instanceMonitor, decodedObjectName]);

    const memoizedNodes = useMemo(() => {
        return Object.keys(memoizedObjectData || {});
    }, [memoizedObjectData]);

    // Render loading state only if no data is available during initial loading
    if (initialLoading && !memoizedObjectData) {
        return (
            <Box p={4} display="flex" justifyContent="center" alignItems="center">
                <CircularProgress/>
                <Typography ml={2}>Loading object data...</Typography>
            </Box>
        );
    }

    // Render empty state with separate Typography for object name
    const {kind} = parseObjectPath(decodedObjectName);
    const showKeys = ["cfg", "sec"].includes(kind);

    if (!memoizedObjectData) {
        return (
            <Box p={4}>
                <Typography variant="h5" sx={{mb: 2}}>{decodedObjectName}</Typography>
                <Typography align="center" color="textSecondary" fontSize="1.2rem">
                    No information available for object.
                </Typography>
                {showKeys && memoizedObjectData && (
                    <KeysSection decodedObjectName={decodedObjectName} openSnackbar={openSnackbar}/>
                )}
                <ConfigSection
                    decodedObjectName={decodedObjectName}
                    configNode={configNode}
                    setConfigNode={setConfigNode}
                    openSnackbar={openSnackbar}
                    handleManageParamsSubmit={() => setManageParamsDialogOpen(false)}
                />
            </Box>
        );
    }

    return (
        <Box sx={{display: "flex", justifyContent: "center", px: 2, py: 4}}>
            <Box sx={{width: "100%", maxWidth: "1400px"}}>
                <HeaderSection
                    decodedObjectName={decodedObjectName}
                    globalStatus={objectStatus[decodedObjectName]}
                    actionInProgress={actionInProgress}
                    objectMenuAnchor={objectMenuAnchor}
                    setObjectMenuAnchor={setObjectMenuAnchor}
                    handleObjectActionClick={handleObjectActionClick}
                    getObjectStatus={getObjectStatus}
                    getColor={getColor}
                />
                <ActionDialogManager
                    pendingAction={pendingAction}
                    handleConfirm={handleDialogConfirm}
                    target={`object ${decodedObjectName}`}
                    supportedActions={
                        pendingAction?.batch === "nodes"
                            ? INSTANCE_ACTIONS.map((action) => action.name)
                            : pendingAction?.batch === "resources" || pendingAction?.rid
                                ? RESOURCE_ACTIONS.map((action) => action.name)
                                : OBJECT_ACTIONS.map((action) => action.name)
                    }
                    onClose={() => {
                        setPendingAction(null);
                        setConfirmDialogOpen(false);
                        setStopDialogOpen(false);
                        setUnprovisionDialogOpen(false);
                        setPurgeDialogOpen(false);
                        setSimpleDialogOpen(false);
                    }}
                />
                {showKeys && (
                    <KeysSection decodedObjectName={decodedObjectName} openSnackbar={openSnackbar}/>
                )}
                <ConfigSection
                    decodedObjectName={decodedObjectName}
                    configNode={configNode}
                    setConfigNode={setConfigNode}
                    openSnackbar={openSnackbar}
                    handleManageParamsSubmit={() => setManageParamsDialogOpen(false)}
                />
                <ManageConfigParamsDialog
                    open={manageParamsDialogOpen}
                    onClose={() => setManageParamsDialogOpen(false)}
                    onConfirm={() => setManageParamsDialogOpen(false)}
                    paramsToSet={paramsToSet}
                    setParamsToSet={setParamsToSet}
                    paramsToUnset={paramsToUnset}
                    setParamsToUnset={setParamsToUnset}
                    paramsToDelete={paramsToDelete}
                    setParamsToDelete={setParamsToDelete}
                    disabled={actionInProgress}
                />
                {!(["sec", "cfg", "usr"].includes(kind)) && (
                    <>
                        <Box sx={{display: "flex", alignItems: "center", gap: 1, mb: 2}}>
                            <Button
                                variant="outlined"
                                onClick={handleNodesActionsOpen}
                                disabled={selectedNodes.length === 0}
                                aria-label="Actions on selected nodes"
                            >
                                Actions on Selected Nodes
                            </Button>
                        </Box>
                        {memoizedNodes.map((node) => {
                            return (
                                <NodeCard
                                    key={node}
                                    node={node}
                                    nodeData={memoizedObjectData[node] || {}}
                                    selectedNodes={selectedNodes}
                                    toggleNode={toggleNode}
                                    selectedResourcesByNode={selectedResourcesByNode}
                                    toggleResource={toggleResource}
                                    actionInProgress={actionInProgress}
                                    individualNodeMenuAnchor={individualNodeMenuAnchor}
                                    setIndividualNodeMenuAnchor={setIndividualNodeMenuAnchor}
                                    setCurrentNode={setCurrentNode}
                                    handleResourcesActionsOpen={handleResourcesActionsOpen}
                                    handleResourceMenuOpen={handleResourceMenuOpen}
                                    expandedNodeResources={expandedNodeResources}
                                    handleNodeResourcesAccordionChange={handleNodeResourcesAccordionChange}
                                    expandedResources={expandedResources}
                                    handleAccordionChange={handleAccordionChange}
                                    getColor={getColor}
                                    getNodeState={getNodeState}
                                    parseProvisionedState={parseProvisionedState}
                                    setPendingAction={setPendingAction}
                                    setConfirmDialogOpen={setConfirmDialogOpen}
                                    setStopDialogOpen={setStopDialogOpen}
                                    setUnprovisionDialogOpen={setUnprovisionDialogOpen}
                                    setPurgeDialogOpen={setPurgeDialogOpen}
                                    setSimpleDialogOpen={setSimpleDialogOpen}
                                    setCheckboxes={setCheckboxes}
                                    setStopCheckbox={setStopCheckbox}
                                    setUnprovisionCheckboxes={setUnprovisionCheckboxes}
                                    setPurgeCheckboxes={setPurgeCheckboxes}
                                    setSelectedResourcesByNode={setSelectedResourcesByNode}
                                />
                            );
                        })}
                        <Menu
                            anchorEl={nodesActionsAnchor}
                            open={Boolean(nodesActionsAnchor)}
                            onClose={handleNodesActionsClose}
                        >
                            {INSTANCE_ACTIONS.map(({name, icon}) => (
                                <MenuItem key={name} onClick={() => handleBatchNodeActionClick(name)}>
                                    <ListItemIcon sx={{minWidth: 40}}>{icon}</ListItemIcon>
                                    <ListItemText>{name.charAt(0).toUpperCase() + name.slice(1)}</ListItemText>
                                </MenuItem>
                            ))}
                        </Menu>
                        <Menu
                            anchorEl={individualNodeMenuAnchor}
                            open={Boolean(individualNodeMenuAnchor)}
                            onClose={() => setIndividualNodeMenuAnchor(null)}
                        >
                            {INSTANCE_ACTIONS.map(({name, icon}) => (
                                <MenuItem
                                    key={name}
                                    onClick={() => handleIndividualNodeActionClick(name)}
                                >
                                    <ListItemIcon sx={{minWidth: 40}}>{icon}</ListItemIcon>
                                    <ListItemText>{name.charAt(0).toUpperCase() + name.slice(1)}</ListItemText>
                                </MenuItem>
                            ))}
                        </Menu>
                        <Menu
                            anchorEl={resourcesActionsAnchor}
                            open={Boolean(resourcesActionsAnchor)}
                            onClose={handleResourcesActionsClose}
                        >
                            {RESOURCE_ACTIONS.map(({name, icon}) => (
                                <MenuItem
                                    key={name}
                                    onClick={() => handleBatchResourceActionClick(name)}
                                >
                                    <ListItemIcon sx={{minWidth: 40}}>{icon}</ListItemIcon>
                                    <ListItemText>{name.charAt(0).toUpperCase() + name.slice(1)}</ListItemText>
                                </MenuItem>
                            ))}
                        </Menu>
                        <Menu
                            anchorEl={resourceMenuAnchor}
                            open={Boolean(resourceMenuAnchor) && Boolean(currentResourceId)}
                            onClose={handleResourceMenuClose}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {(() => {
                                if (!currentResourceId || !resGroupNode || !memoizedObjectData[resGroupNode]) {
                                    return [];
                                }
                                const resourceType = getResourceType(currentResourceId, memoizedObjectData[resGroupNode]);
                                const filteredActions = getFilteredResourceActions(resourceType);
                                return filteredActions.map(({name, icon}) => {
                                    return (
                                        <MenuItem
                                            key={name}
                                            onClick={() => handleResourceActionClick(name)}
                                            aria-label={`Resource ${currentResourceId} ${name} action`}
                                        >
                                            <ListItemIcon sx={{minWidth: 40}}>{icon}</ListItemIcon>
                                            <ListItemText>{name.charAt(0).toUpperCase() + name.slice(1)}</ListItemText>
                                        </MenuItem>
                                    );
                                });
                            })()}
                        </Menu>
                    </>
                )}
                <Snackbar
                    open={snackbar.open}
                    autoHideDuration={5000}
                    onClose={closeSnackbar}
                    anchorOrigin={{vertical: "bottom", horizontal: "center"}}
                >
                    <Alert
                        onClose={closeSnackbar}
                        severity={snackbar.severity}
                        variant="filled"
                        aria-label={snackbar.severity === "error" ? "error alert" : `${snackbar.severity} alert`}
                    >
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            </Box>
        </Box>
    );
};

export default ObjectDetail;
