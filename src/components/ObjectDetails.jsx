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
import {UpdateConfigDialog, ManageConfigParamsDialog} from "./ActionDialogs";
import HeaderSection from "./HeaderSection";
import ConfigSection from "./ConfigSection";
import KeysSection from "./KeysSection";
import NodeCard from "./NodeCard";
import {OBJECT_ACTIONS, INSTANCE_ACTIONS, RESOURCE_ACTIONS} from "../constants/actions";

// Helper function to filter resource actions based on type
const getFilteredResourceActions = (resourceType) => {
    console.log("getFilteredResourceActions called with resourceType:", resourceType);
    if (!resourceType) {
        console.log("No resource type provided, returning all actions");
        return RESOURCE_ACTIONS;
    }
    const typePrefix = resourceType.split('.')[0].toLowerCase();
    console.log("Resource type prefix:", typePrefix);
    if (typePrefix === 'task') {
        console.log("Type is task, returning only 'run' action");
        return RESOURCE_ACTIONS.filter(action => action.name === 'run');
    }
    if (['fs', 'disk', 'app', 'container'].includes(typePrefix)) {
        console.log(`Type prefix is ${typePrefix}, excluding 'run' action`);
        return RESOURCE_ACTIONS.filter(action => action.name !== 'run');
    }
    console.log("No special filtering, returning all actions");
    return RESOURCE_ACTIONS;
};

// Helper function to get resource type for a given resource ID
const getResourceType = (rid, nodeData) => {
    if (!rid) {
        console.warn("getResourceType called with undefined or null rid");
        return '';
    }
    console.log(`getResourceType called for rid: ${rid}`);
    // Check top-level resources
    const topLevelType = nodeData?.resources?.[rid]?.type;
    if (topLevelType) {
        console.log(`Found resource type in resources[${rid}]: ${topLevelType}`);
        return topLevelType;
    }
    // Check encapsulated resources
    const encapData = nodeData?.encap || {};
    for (const containerId of Object.keys(encapData)) {
        const encapType = encapData[containerId]?.resources?.[rid]?.type;
        if (encapType) {
            console.log(`Found resource type in encapData[${containerId}].resources[${rid}]: ${encapType}`);
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
    const [updateConfigDialogOpen, setUpdateConfigDialogOpen] = useState(false);
    const [newConfigFile, setNewConfigFile] = useState(null);
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

    // Debug logging for component lifecycle
    console.log(`[ObjectDetail] Mounting component for ${decodedObjectName}`);

    // Cleanup on unmount
    useEffect(() => {
        isMounted.current = true;
        return () => {
            console.log(`[ObjectDetail] Unmounting component for ${decodedObjectName}`);
            isMounted.current = false;
            closeEventSource();
        };
    }, [decodedObjectName]);

    // Debug selectedResourcesByNode changes
    useEffect(() => {
        console.log("[ObjectDetail] selectedResourcesByNode updated:", selectedResourcesByNode);
    }, [selectedResourcesByNode]);

    // Initialize and update accordion states for nodes and resources
    useEffect(() => {
        if (!objectData) return;
        console.log("[ObjectDetail] Updating accordion states for nodes and resources");
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
            console.log("[ObjectDetail] Updated expandedNodeResources:", updatedNodeResources);
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
            console.log("[ObjectDetail] Updated expandedResources:", updatedResources);
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
        console.log("[ObjectDetail] postNodeAction URL:", url);
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {Authorization: `Bearer ${token}`},
            });
            console.log("[ObjectDetail] postNodeAction response:", res.status, res.statusText);
            if (!res.ok) throw new Error(`Failed to execute ${action}`);
            openSnackbar(`'${action}' succeeded on node '${node}'`);
        } catch (err) {
            console.error("[ObjectDetail] postNodeAction error:", err);
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
        console.log("[ObjectDetail] fetchConfig called with node:", node);
        if (!node) {
            console.warn(`[ObjectDetail] fetchConfig: No node provided for ${decodedObjectName}`);
            setConfigError("No node available to fetch configuration.");
            return;
        }
        const key = `${decodedObjectName}:${node}`;
        const now = Date.now();
        if (lastFetch.current[key] && now - lastFetch.current[key] < 1000) {
            console.log("[ObjectDetail] fetchConfig: Debounced, skipping");
            return;
        }
        lastFetch.current[key] = now;
        if (configLoading) {
            console.warn(`[ObjectDetail] fetchConfig: Already loading for ${node}, skipping`);
            return;
        }
        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken");
        if (!token) {
            setConfigError("Auth token not found.");
            console.error("[ObjectDetail] fetchConfig: No auth token");
            return;
        }

        setConfigLoading(true);
        setConfigError(null);
        setConfigNode(node);
        const url = `${URL_NODE}/${node}/instance/path/${namespace}/${kind}/${name}/config/file`;
        console.log("[ObjectDetail] fetchConfig URL:", url);
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
                console.log("[ObjectDetail] fetchConfig success, configData:", text);
            }
            return text;
        } catch (err) {
            if (isMounted.current) {
                setConfigError(err.message);
                console.error(`[ObjectDetail] fetchConfig error: ${err.message}, URL: ${url}`);
            }
            throw err;
        } finally {
            if (isMounted.current) {
                setConfigLoading(false);
                console.log("[ObjectDetail] fetchConfig completed");
            }
        }
    };

    // Update configuration for the object
    const handleUpdateConfig = async () => {
        console.log("[ObjectDetail] handleUpdateConfig called");
        if (!newConfigFile) {
            openSnackbar("Configuration file is required.", "error");
            return;
        }
        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken");
        if (!token) {
            openSnackbar("Auth token not found.", "error");
            return;
        }

        setActionInProgress(true);
        openSnackbar("Updating configuration…", "info");
        try {
            const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/config/file`;
            const response = await fetch(url, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/octet-stream",
                },
                body: newConfigFile,
            });
            if (!response.ok)
                throw new Error(`Failed to update config: ${response.status}`);
            openSnackbar("Configuration updated successfully");
            if (configNode) {
                await fetchConfig(configNode);
                setConfigAccordionExpanded(true);
            } else {
                console.warn(`[ObjectDetail] handleUpdateConfig: No configNode available`);
            }
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
        } finally {
            setActionInProgress(false);
            setUpdateConfigDialogOpen(false);
            setNewConfigFile(null);
        }
    };

    // Add configuration parameters
    const handleAddParams = async () => {
        console.log("[ObjectDetail] handleAddParams called with paramsToSet:", paramsToSet);
        if (!paramsToSet) {
            openSnackbar("Parameter input is required.", "error");
            return false;
        }
        const paramList = paramsToSet.split("\n").filter((param) => param.trim());
        if (paramList.length === 0) {
            openSnackbar("No valid parameters provided.", "error");
            return false;
        }

        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken");
        if (!token) {
            openSnackbar("Auth token not found.", "error");
            return false;
        }

        setActionInProgress(true);
        let successCount = 0;
        for (const param of paramList) {
            const [key, value] = param.split("=", 2);
            if (!key || !value) {
                openSnackbar(`Invalid format for parameter: ${param}. Use 'key=value'.`, "error");
                continue;
            }
            try {
                const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/config?set=${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
                const response = await fetch(url, {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                if (!response.ok)
                    throw new Error(`Failed to add parameter ${key}: ${response.status}`);
                successCount++;
            } catch (err) {
                openSnackbar(`Error adding parameter ${key}: ${err.message}`, "error");
            }
        }
        if (successCount > 0) {
            openSnackbar(`Successfully added ${successCount} parameter(s)`, "success");
            if (configNode) {
                await fetchConfig(configNode);
                setConfigAccordionExpanded(true);
            } else {
                console.warn(`[ObjectDetail] handleAddParams: No configNode available`);
            }
        }
        setActionInProgress(false);
        return successCount > 0;
    };

    // Unset configuration parameters
    const handleUnsetParams = async () => {
        console.log("[ObjectDetail] handleUnsetParams called with paramsToUnset:", paramsToUnset);
        if (!paramsToUnset) {
            openSnackbar("Parameter key(s) to unset are required.", "error");
            return false;
        }
        const paramList = paramsToUnset.split("\n").filter((param) => param.trim());
        if (paramList.length === 0) {
            openSnackbar("No valid parameters to unset provided.", "error");
            return false;
        }

        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken");
        if (!token) {
            openSnackbar("Auth token not found.", "error");
            return false;
        }

        setActionInProgress(true);
        let successCount = 0;
        for (const key of paramList) {
            try {
                const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/config?unset=${encodeURIComponent(key)}`;
                const response = await fetch(url, {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                if (!response.ok)
                    throw new Error(`Failed to unset parameter ${key}: ${response.status}`);
                successCount++;
            } catch (err) {
                openSnackbar(`Error unsetting parameter ${key}: ${err.message}`, "error");
            }
        }
        if (successCount > 0) {
            openSnackbar(`Successfully unset ${successCount} parameter(s)`, "success");
            if (configNode) {
                await fetchConfig(configNode);
                setConfigAccordionExpanded(true);
            } else {
                console.warn(`[ObjectDetail] handleUnsetParams: No configNode available`);
            }
        }
        setActionInProgress(false);
        return successCount > 0;
    };

    // Delete configuration parameters
    const handleDeleteParams = async () => {
        console.log("[ObjectDetail] handleDeleteParams called with paramsToDelete:", paramsToDelete);
        if (!paramsToDelete) {
            openSnackbar("Parameter key(s) to delete are required.", "error");
            return false;
        }
        const paramList = paramsToDelete.split("\n").filter((param) => param.trim());
        if (paramList.length === 0) {
            openSnackbar("No valid parameters to delete provided.", "error");
            return false;
        }

        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken");
        if (!token) {
            openSnackbar("Auth token not found.", "error");
            return false;
        }

        setActionInProgress(true);
        let successCount = 0;
        for (const key of paramList) {
            try {
                const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/config?delete=${encodeURIComponent(key)}`;
                const response = await fetch(url, {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                if (!response.ok)
                    throw new Error(`Failed to delete section ${key}: ${response.status}`);
                successCount++;
            } catch (err) {
                openSnackbar(`Error deleting section ${key}: ${err.message}`, "error");
            }
        }
        if (successCount > 0) {
            openSnackbar(`Successfully deleted ${successCount} section(s)`, "success");
            if (configNode) {
                await fetchConfig(configNode);
                setConfigAccordionExpanded(true);
            } else {
                console.warn(`[ObjectDetail] handleDeleteParams: No configNode available`);
            }
        }
        setActionInProgress(false);
        return successCount > 0;
    };

    // Handle manage parameters dialog submission
    const handleManageParamsSubmit = async () => {
        console.log("[ObjectDetail] handleManageParamsSubmit called");
        let anySuccess = false;
        if (paramsToSet) {
            const success = await handleAddParams();
            anySuccess = anySuccess || success;
        }
        if (paramsToUnset) {
            const success = await handleUnsetParams();
            anySuccess = anySuccess || success;
        }
        if (paramsToDelete) {
            const success = await handleDeleteParams();
            anySuccess = anySuccess || success;
        }
        if (anySuccess) {
            setParamsToSet("");
            setParamsToUnset("");
            setParamsToDelete("");
            setManageParamsDialogOpen(false);
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
        console.log("[ObjectDetail] handleNodeResourcesAccordionChange:", {node, isExpanded});
        setExpandedNodeResources((prev) => ({
            ...prev,
            [node]: isExpanded,
        }));
    };

    const handleAccordionChange = (node, rid) => (event, isExpanded) => {
        console.log("[ObjectDetail] handleAccordionChange:", {node, rid, isExpanded});
        setExpandedResources((prev) => ({
            ...prev,
            [`${node}:${rid}`]: isExpanded,
        }));
    };

    // Batch node actions handlers
    const handleNodesActionsOpen = (e) => setNodesActionsAnchor(e.currentTarget);
    const handleNodesActionsClose = () => setNodesActionsAnchor(null);
    const handleBatchNodeActionClick = (action) => {
        console.log("[ObjectDetail] handleBatchNodeActionClick:", action);
        setPendingAction({action, batch: "nodes"});
        handleNodesActionsClose();
    };

    // Individual node actions handlers
    const handleIndividualNodeActionClick = (action) => {
        console.log("[ObjectDetail] handleIndividualNodeActionClick:", action, currentNode);
        setPendingAction({action, node: currentNode});
        setIndividualNodeMenuAnchor(null);
    };

    // Batch resource actions handlers
    const handleResourcesActionsOpen = (node, e) => {
        console.log("[ObjectDetail] handleResourcesActionsOpen:", node);
        setResGroupNode(node);
        setResourcesActionsAnchor(e.currentTarget);
    };
    const handleResourcesActionsClose = () => setResourcesActionsAnchor(null);
    const handleBatchResourceActionClick = (action) => {
        console.log("[ObjectDetail] handleBatchResourceActionClick:", action, resGroupNode);
        setPendingAction({action, batch: "resources", node: resGroupNode});
        handleResourcesActionsClose();
    };

    // Individual resource actions handlers
    const handleResourceMenuOpen = (node, rid, e) => {
        console.log("[ObjectDetail] handleResourceMenuOpen:", node, rid);
        setCurrentResourceId(rid);
        setResGroupNode(node);
        setResourceMenuAnchor(e.currentTarget);
    };
    const handleResourceMenuClose = () => {
        setResourceMenuAnchor(null);
        setCurrentResourceId(null);
    };
    const handleResourceActionClick = (action) => {
        console.log("[ObjectDetail] handleResourceActionClick:", action, currentResourceId);
        setPendingAction({action, node: resGroupNode, rid: currentResourceId});
        handleResourceMenuClose();
    };

    // Object action handler
    const handleObjectActionClick = (action) => {
        console.log("[ObjectDetail] handleObjectActionClick:", action);
        setPendingAction({action});
        setObjectMenuAnchor(null);
    };

    // Dialog confirm handler
    const handleDialogConfirm = () => {
        console.log("[ObjectDetail] handleDialogConfirm called with pendingAction:", pendingAction);
        if (!pendingAction) return;

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
    };

    // Selection helpers
    const toggleNode = (node) => {
        console.log("[ObjectDetail] toggleNode:", node);
        setSelectedNodes((prev) =>
            prev.includes(node) ? prev.filter((n) => n !== node) : [...prev, node]
        );
    };

    const toggleResource = (node, rid) => {
        console.log("[ObjectDetail] toggleResource:", {node, rid});
        setSelectedResourcesByNode((prev) => {
            const current = prev[node] || [];
            const next = current.includes(rid)
                ? current.filter((r) => r !== rid)
                : [...current, rid];
            console.log("[ObjectDetail] toggleResource result:", {node, next});
            return {...prev, [node]: next};
        });
    };

    // Effect for configuring EventSource
    useEffect(() => {
        console.log(`[ObjectDetail] Setting up EventSource for ${decodedObjectName}`);
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
        } else {
            console.warn("[ObjectDetail] No auth token for EventSource");
        }

        return () => {
            console.log(`[ObjectDetail] Cleaning up EventSource for ${decodedObjectName}`);
            closeEventSource();
        };
    }, [decodedObjectName]);

    // Effect for handling config updates
    useEffect(() => {
        console.log("[ObjectDetail] Setting up configUpdates subscription");
        if (!isMounted.current) {
            console.log("[ObjectDetail] Component unmounted, skipping subscription");
            return;
        }

        const subscription = useEventStore.subscribe(
            (state) => state.configUpdates,
            async (updates) => {
                console.log("[ObjectDetail] Config updates received:", updates);
                if (!isMounted.current) {
                    console.log("[ObjectDetail] Component unmounted, ignoring config update");
                    return;
                }
                if (isProcessingConfigUpdate.current) {
                    console.log("[ObjectDetail] Config update processing already in progress, skipping");
                    return;
                }
                isProcessingConfigUpdate.current = true;
                try {
                    const {name} = parseObjectPath(decodedObjectName);
                    const matchingUpdate = updates.find(
                        (u) =>
                            (u.name === name || u.fullName === decodedObjectName) &&
                            u.type === "InstanceConfigUpdated"
                    );

                    if (matchingUpdate && matchingUpdate.node) {
                        console.log("[ObjectDetail] Processing config update for node:", matchingUpdate.node);
                        try {
                            await fetchConfig(matchingUpdate.node);
                            setConfigAccordionExpanded(true);
                            openSnackbar("Configuration updated", "info");
                        } catch (err) {
                            console.error(`[ObjectDetail] Failed to fetch updated config:`, err);
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

        console.log("[ObjectDetail] Subscription created:", typeof subscription);

        return () => {
            console.log("[ObjectDetail] Cleaning up configUpdates subscription");
            if (typeof subscription === "function") {
                subscription();
            } else {
                console.warn("[ObjectDetail] Subscription is not a function:", subscription);
            }
        };
    }, [decodedObjectName, clearConfigUpdate]);

    // Initial load effects
    useEffect(() => {
        const loadInitialConfig = async () => {
            console.log("[ObjectDetail] Initial load effect for:", decodedObjectName);
            if (objectData) {
                const nodes = Object.keys(objectInstanceStatus[decodedObjectName] || {});
                const initialNode = nodes.find((node) => {
                    const hasValidEncapResources =
                        objectData[node]?.encap &&
                        Object.values(objectData[node].encap).some(
                            (container) => container.resources && Object.keys(container.resources).length > 0
                        );
                    console.log(`[ObjectDetail] Checking node ${node} for valid encap resources:`, hasValidEncapResources);
                    return hasValidEncapResources;
                }) || nodes[0];

                if (initialNode) {
                    console.log("[ObjectDetail] Fetching config for initial node:", initialNode);
                    try {
                        await fetchConfig(initialNode);
                    } catch (err) {
                        console.error(`[ObjectDetail] Initial Load failed for ${decodedObjectName}:`, err);
                        setConfigError("Failed to load initial configuration.");
                    }
                } else {
                    setConfigError("No nodes available to fetch configuration.");
                    console.warn(`[ObjectDetail] No initial node found for ${decodedObjectName}`);
                }
            } else {
                console.log("[ObjectDetail] No object data available, skipping config fetch");
                setConfigError("No object data available.");
            }
            setInitialLoading(false);
        };

        loadInitialConfig();
    }, [decodedObjectName, objectData]);

    // Memoize data to prevent unnecessary re-renders
    const memoizedObjectData = useMemo(() => {
        console.log("[ObjectDetail] Memoizing objectData:", objectData);
        console.log("[ObjectDetail] instanceConfig state:", instanceConfig);
        const enhancedObjectData = {};
        if (objectData) {
            Object.keys(objectData).forEach((node) => {
                console.log(`[ObjectDetail] Node ${node} encap:`, objectData[node]?.encap);
                enhancedObjectData[node] = {
                    ...objectData[node],
                    instanceConfig: instanceConfig && instanceConfig[decodedObjectName] ? instanceConfig[decodedObjectName] : {resources: {}},
                    instanceMonitor: instanceMonitor[`${node}:${decodedObjectName}`] || {resources: {}},
                };
            });
        }
        console.log("[ObjectDetail] Enhanced memoizedObjectData:", enhancedObjectData);
        return enhancedObjectData;
    }, [objectData, instanceConfig, instanceMonitor, decodedObjectName]);

    const memoizedNodes = useMemo(() => {
        console.log("[ObjectDetail] Memoizing nodes:", Object.keys(memoizedObjectData || {}));
        return Object.keys(memoizedObjectData || {});
    }, [memoizedObjectData]);

    console.log("[ObjectDetail] Rendering with memoizedObjectData:", memoizedObjectData);

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
    console.log("[ObjectDetail] showKeys:", showKeys, "kind:", kind);

    if (!memoizedObjectData) {
        console.log("[ObjectDetail] No object data, rendering empty state");
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
                    onClose={() => setPendingAction(null)}
                />
                {showKeys && (
                    <KeysSection decodedObjectName={decodedObjectName} openSnackbar={openSnackbar}/>
                )}
                <ConfigSection
                    decodedObjectName={decodedObjectName}
                    configNode={configNode}
                    setConfigNode={setConfigNode}
                    openSnackbar={openSnackbar}
                />
                {/* UPDATE CONFIG DIALOG */}
                <UpdateConfigDialog
                    open={updateConfigDialogOpen}
                    onClose={() => setUpdateConfigDialogOpen(false)}
                    onConfirm={handleUpdateConfig}
                    newConfigFile={newConfigFile}
                    setNewConfigFile={setNewConfigFile}
                    disabled={actionInProgress}
                />
                {/* MANAGE CONFIG PARAMETERS DIALOG */}
                <ManageConfigParamsDialog
                    open={manageParamsDialogOpen}
                    onClose={() => setManageParamsDialogOpen(false)}
                    onConfirm={handleManageParamsSubmit}
                    paramsToSet={paramsToSet}
                    setParamsToSet={setParamsToSet}
                    paramsToUnset={paramsToUnset}
                    setParamsToUnset={setParamsToUnset}
                    paramsToDelete={paramsToDelete}
                    setParamsToDelete={setParamsToDelete}
                    disabled={actionInProgress}
                />
                {/* Conditionally render nodes section only if kind is not sec, cfg, or usr */}
                {!(["sec", "cfg", "usr"].includes(kind)) && (
                    <>
                        {/* BATCH NODE ACTIONS */}
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
                        {/* LIST OF NODES WITH THEIR RESOURCES */}
                        {memoizedNodes.map((node) => {
                            console.log("[ObjectDetail] Rendering NodeCard for node:", node);
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
                                    console.error("Cannot render resource actions menu: missing currentResourceId or node data", {
                                        currentResourceId,
                                        resGroupNode,
                                        nodeData: memoizedObjectData[resGroupNode]
                                    });
                                    return [];
                                }
                                const resourceType = getResourceType(currentResourceId, memoizedObjectData[resGroupNode]);
                                const filteredActions = getFilteredResourceActions(resourceType);
                                console.log("Rendering resource actions menu:", {
                                    currentResourceId,
                                    resourceType,
                                    filteredActions: filteredActions.map(action => action.name),
                                });
                                return filteredActions.map(({name, icon}) => {
                                    console.log(`Rendering MenuItem for action: ${name}`);
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
                {/* SNACKBAR */}
                <Snackbar
                    open={snackbar.open}
                    autoHideDuration={5000}
                    onClose={closeSnackbar}
                    anchorOrigin={{vertical: "bottom", horizontal: "center"}}
                >
                    <Alert onClose={closeSnackbar} severity={snackbar.severity} variant="filled">
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            </Box>
        </Box>
    );
};

export default ObjectDetail;
