import React, {useState, useMemo, useEffect, useRef} from "react";
import {useParams} from "react-router-dom";
import {
    Box,
    Typography,
    Tooltip,
    Divider,
    Snackbar,
    Alert,
    Menu,
    MenuItem,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControlLabel,
    Checkbox,
    Button,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    ListItemIcon,
    ListItemText,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    TextField,
} from "@mui/material";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import SettingsIcon from "@mui/icons-material/Settings";
import {
    RestartAlt,
    LockOpen,
    Delete,
    Settings,
    Block,
    CleaningServices,
    SwapHoriz,
    Undo,
    Cancel,
    PlayArrow,
    Stop,
    PlayCircleFilled,
} from "@mui/icons-material";
import {green, red, grey, blue, orange} from "@mui/material/colors";
import useEventStore from "../hooks/useEventStore.js";
import {closeEventSource, startEventReception, configureEventSource} from "../eventSourceManager.jsx";
import {URL_OBJECT, URL_NODE} from "../config/apiPath.js";
import {
    FreezeDialog,
    StopDialog,
    UnprovisionDialog,
    PurgeDialog,
    SimpleConfirmDialog,
} from "../components/ActionDialogs";

const NODE_ACTIONS = [
    {name: "start", icon: <PlayArrow sx={{fontSize: 24}}/>},
    {name: "stop", icon: <Stop sx={{fontSize: 24}}/>},
    {name: "restart", icon: <RestartAlt sx={{fontSize: 24}}/>},
    {name: "freeze", icon: <AcUnitIcon sx={{fontSize: 24}}/>},
    {name: "unfreeze", icon: <LockOpen sx={{fontSize: 24}}/>},
    {name: "provision", icon: <Settings sx={{fontSize: 24}}/>},
    {name: "unprovision", icon: <Block sx={{fontSize: 24}}/>},
    {name: "run", icon: <PlayCircleFilled sx={{fontSize: 24}}/>},
];

const OBJECT_ACTIONS = [
    {name: "start", icon: <PlayArrow sx={{fontSize: 24}}/>},
    {name: "stop", icon: <Stop sx={{fontSize: 24}}/>},
    {name: "restart", icon: <RestartAlt sx={{fontSize: 24}}/>},
    {name: "freeze", icon: <AcUnitIcon sx={{fontSize: 24}}/>},
    {name: "unfreeze", icon: <LockOpen sx={{fontSize: 24}}/>},
    {name: "delete", icon: <Delete sx={{fontSize: 24}}/>},
    {name: "provision", icon: <Settings sx={{fontSize: 24}}/>},
    {name: "unprovision", icon: <Block sx={{fontSize: 24}}/>},
    {name: "purge", icon: <CleaningServices sx={{fontSize: 24}}/>},
    {name: "switch", icon: <SwapHoriz sx={{fontSize: 24}}/>},
    {name: "giveback", icon: <Undo sx={{fontSize: 24}}/>},
    {name: "abort", icon: <Cancel sx={{fontSize: 24}}/>},
];

const RESOURCE_ACTIONS = [
    {name: "start", icon: <PlayArrow sx={{fontSize: 24}}/>},
    {name: "stop", icon: <Stop sx={{fontSize: 24}}/>},
    {name: "restart", icon: <RestartAlt sx={{fontSize: 24}}/>},
    {name: "run", icon: <PlayCircleFilled sx={{fontSize: 24}}/>},
];

const ObjectDetail = () => {
    const {objectName} = useParams();
    const decodedObjectName = decodeURIComponent(objectName);

    const objectStatus = useEventStore((s) => s.objectStatus);
    const objectInstanceStatus = useEventStore((s) => s.objectInstanceStatus);
    const instanceMonitor = useEventStore((s) => s.instanceMonitor);
    const clearConfigUpdate = useEventStore((s) => s.clearConfigUpdate);
    const objectData = objectInstanceStatus?.[decodedObjectName];
    const globalStatus = objectStatus?.[decodedObjectName];

    // State for keys
    const [keys, setKeys] = useState([]);
    const [keysLoading, setKeysLoading] = useState(false);
    const [keysError, setKeysError] = useState(null);
    const [keysAccordionExpanded, setKeysAccordionExpanded] = useState(false);

    // State for key actions
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
    const [keyToDelete, setKeyToDelete] = useState(null);
    const [keyToUpdate, setKeyToUpdate] = useState(null);
    const [newKeyName, setNewKeyName] = useState("");
    const [updateKeyName, setUpdateKeyName] = useState("");
    const [newKeyFile, setNewKeyFile] = useState(null);
    const [updateKeyFile, setUpdateKeyFile] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    // State for configuration
    const [configData, setConfigData] = useState(null);
    const [configLoading, setConfigLoading] = useState(false);
    const [configError, setConfigError] = useState(null);
    const [configAccordionExpanded, setConfigAccordionExpanded] = useState(false);
    const [updateConfigDialogOpen, setUpdateConfigDialogOpen] = useState(false);
    const [newConfigFile, setNewConfigFile] = useState(null);
    const [manageParamsDialogOpen, setManageParamsDialogOpen] = useState(false);
    const [paramInput, setParamInput] = useState("");
    const [paramToUnset, setParamToUnset] = useState("");
    const [paramToDelete, setParamToDelete] = useState("");
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

    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [stopDialogOpen, setStopDialogOpen] = useState(false);
    const [unprovisionDialogOpen, setUnprovisionDialogOpen] = useState(false);
    const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
    const [simpleDialogOpen, setSimpleDialogOpen] = useState(false);

    const [checkboxes, setCheckboxes] = useState({failover: false});
    const [stopCheckbox, setStopCheckbox] = useState(false);
    const [unprovisionChecked, setUnprovisionChecked] = useState(false);
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

    // Debounce ref to prevent multiple fetchConfig calls
    const lastFetch = useRef({});

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

    // Fetch keys for cfg or sec objects
    const fetchKeys = async () => {
        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        if (!["cfg", "sec"].includes(kind)) return;

        const token = localStorage.getItem("authToken");
        if (!token) {
            setKeysError("Auth token not found.");
            return;
        }

        setKeysLoading(true);
        setKeysError(null);
        try {
            const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/data/keys`;
            const response = await fetch(url, {
                headers: {Authorization: `Bearer ${token}`},
            });
            if (!response.ok) throw new Error(`Failed to fetch keys: ${response.status}`);
            const data = await response.json();
            setKeys(data.items || []);
        } catch (err) {
            setKeysError(err.message);
        } finally {
            setKeysLoading(false);
        }
    };

    // Fetch configuration for the object
    const fetchConfig = async (node) => {
        const key = `${decodedObjectName}:${node}`;
        const now = Date.now();
        if (lastFetch.current[key] && now - lastFetch.current[key] < 1000) {
            return;
        }
        lastFetch.current[key] = now;
        if (configLoading) {
            console.warn(`⏳ [fetchConfig] Already loading, queuing request for node=${node}`);
            await new Promise((resolve) => setTimeout(resolve, 100));
            if (configLoading) {
                console.warn(`🚫 [fetchConfig] Still loading, skipping request for node=${node}`);
                return;
            }
        }
        if (!node) {
            console.warn(`🚫 [fetchConfig] No node provided for ${decodedObjectName}`);
            return;
        }
        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken");
        if (!token) {
            setConfigError("Auth token not found.");
            console.error("❌ [fetchConfig] No auth token for:", decodedObjectName);
            return;
        }

        setConfigLoading(true);
        setConfigError(null);
        setConfigNode(node); // Store the node used for fetching config
        const url = `${URL_NODE}/${node}/instance/path/${namespace}/${kind}/${name}/config/file`;
        try {
            const response = await fetch(url, {
                headers: {Authorization: `Bearer ${token}`},
                cache: "no-cache",
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch config: ${response.status}`);
            }
            const text = await response.text();
            setConfigData(text);
            return text;
        } catch (err) {
            console.error(`💥 [fetchConfig] Error: ${err.message}, URL: ${url}`);
            setConfigError(err.message);
            throw err;
        } finally {
            setConfigLoading(false);
        }
    };

    // Update configuration for the object
    const handleUpdateConfig = async () => {
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

        setActionLoading(true);
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
                console.warn(`⚠️ [handleUpdateConfig] No configNode available for ${decodedObjectName}`);
            }
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
        } finally {
            setActionLoading(false);
            setUpdateConfigDialogOpen(false);
            setNewConfigFile(null);
        }
    };

    // Add configuration parameter
    const handleAddParam = async () => {
        if (!paramInput) {
            openSnackbar("Parameter input is required.", "error");
            return;
        }
        const [key, value] = paramInput.split("=", 2);
        if (!key || !value) {
            openSnackbar("Parameter must be in the format 'key=value'.", "error");
            return;
        }
        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken");
        if (!token) {
            openSnackbar("Auth token not found.", "error");
            return;
        }

        setActionLoading(true);
        openSnackbar(`Adding parameter ${key}…`, "info");
        try {
            const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/config?set=${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
            const response = await fetch(url, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok)
                throw new Error(`Failed to add parameter: ${response.status}`);
            openSnackbar(`Parameter '${key}' added successfully`);
            if (configNode) {
                await fetchConfig(configNode);
                setConfigAccordionExpanded(true);
            } else {
                console.warn(`⚠️ [handleAddParam] No configNode available for ${decodedObjectName}`);
            }
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
        } finally {
            setActionLoading(false);
            setParamInput("");
        }
    };

    // Unset configuration parameter
    const handleUnsetParam = async () => {
        if (!paramToUnset) {
            openSnackbar("Parameter key to unset is required.", "error");
            return;
        }
        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken");
        if (!token) {
            openSnackbar("Auth token not found.", "error");
            return;
        }

        setActionLoading(true);
        openSnackbar(`Unsetting parameter ${paramToUnset}…`, "info");
        try {
            const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/config?unset=${encodeURIComponent(paramToUnset)}`;
            const response = await fetch(url, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok)
                throw new Error(`Failed to unset parameter: ${response.status}`);
            openSnackbar(`Parameter '${paramToUnset}' unset successfully`);
            if (configNode) {
                await fetchConfig(configNode);
                setConfigAccordionExpanded(true);
            } else {
                console.warn(`⚠️ [handleUnsetParam] No configNode available for ${decodedObjectName}`);
            }
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
        } finally {
            setActionLoading(false);
            setParamToUnset("");
        }
    };

    // Delete configuration parameter
    const handleDeleteParam = async () => {
        if (!paramToDelete) {
            openSnackbar("Parameter key to delete is required.", "error");
            return;
        }
        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken");
        if (!token) {
            openSnackbar("Auth token not found.", "error");
            return;
        }

        setActionLoading(true);
        openSnackbar(`Deleting parameter ${paramToDelete}…`, "info");
        try {
            const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/config?delete=${encodeURIComponent(paramToDelete)}`;
            const response = await fetch(url, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok)
                throw new Error(`Failed to delete parameter: ${response.status}`);
            openSnackbar(`Parameter '${paramToDelete}' deleted successfully`);
            if (configNode) {
                await fetchConfig(configNode);
                setConfigAccordionExpanded(true);
            } else {
                console.warn(`⚠️ [handleDeleteParam] No configNode available for ${decodedObjectName}`);
            }
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
        } finally {
            setActionLoading(false);
            setParamToDelete("");
        }
    };

    // Handle manage parameters dialog submission
    const handleManageParamsSubmit = async () => {
        if (paramInput) {
            await handleAddParam();
        }
        if (paramToUnset) {
            await handleUnsetParam();
        }
        if (paramToDelete) {
            await handleDeleteParam();
        }
        setManageParamsDialogOpen(false);
    };

    // Key action handlers
    const handleDeleteKey = async () => {
        if (!keyToDelete) return;
        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken");
        if (!token) {
            openSnackbar("Auth token not found.", "error");
            return;
        }

        setActionLoading(true);
        openSnackbar(`Deleting key ${keyToDelete}…`, "info");
        try {
            const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/data/key?name=${encodeURIComponent(
                keyToDelete
            )}`;
            const response = await fetch(url, {
                method: "DELETE",
                headers: {Authorization: `Bearer ${token}`},
            });
            if (!response.ok)
                throw new Error(`Failed to delete key: ${response.status}`);
            openSnackbar(`Key '${keyToDelete}' deleted successfully`);
            await fetchKeys();
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
        } finally {
            setActionLoading(false);
            setDeleteDialogOpen(false);
            setKeyToDelete(null);
        }
    };

    const handleCreateKey = async () => {
        if (!newKeyName || !newKeyFile) {
            openSnackbar("Key name and file are required.", "error");
            return;
        }
        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken");
        if (!token) {
            openSnackbar("Auth token not found.", "error");
            return;
        }

        setActionLoading(true);
        openSnackbar(`Creating key ${newKeyName}…`, "info");
        try {
            const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/data/key?name=${encodeURIComponent(
                newKeyName
            )}`;
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/octet-stream",
                },
                body: newKeyFile,
            });
            if (!response.ok)
                throw new Error(`Failed to create key: ${response.status}`);
            openSnackbar(`Key '${newKeyName}' created successfully`);
            await fetchKeys();
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
        } finally {
            setActionLoading(false);
            setCreateDialogOpen(false);
            setNewKeyName("");
            setNewKeyFile(null);
        }
    };

    const handleUpdateKey = async () => {
        if (!updateKeyName || !updateKeyFile) {
            openSnackbar("Key name and file are required.", "error");
            return;
        }
        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken");
        if (!token) {
            openSnackbar("Auth token not found.", "error");
            return;
        }

        setActionLoading(true);
        openSnackbar(`Updating key ${updateKeyName}…`, "info");
        try {
            const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/data/key?name=${encodeURIComponent(
                updateKeyName
            )}`;
            const response = await fetch(url, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/octet-stream",
                },
                body: updateKeyFile,
            });
            if (!response.ok)
                throw new Error(`Failed to update key: ${response.status}`);
            openSnackbar(`Key '${updateKeyName}' updated successfully`);
            await fetchKeys();
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
        } finally {
            setActionLoading(false);
            setUpdateDialogOpen(false);
            setKeyToUpdate(null);
            setUpdateKeyName("");
            setUpdateKeyFile(null);
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
            setUnprovisionChecked(false);
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
            setUnprovisionChecked(false);
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
    const handleResourceMenuClose = () => setResourceMenuAnchor(null);
    const handleResourceActionClick = (action) => {
        setPendingAction({action, node: resGroupNode, rid: currentResourceId});
        setSimpleDialogOpen(true);
        handleResourceMenuClose();
    };

    // Accordion expansion handlers
    const handleAccordionChange = (panel) => (event, isExpanded) => {
        setExpandedResources((prev) => ({
            ...prev,
            [panel]: isExpanded,
        }));
    };

    const handleNodeResourcesAccordionChange = (node) => (event, isExpanded) => {
        setExpandedNodeResources((prev) => ({
            ...prev,
            [node]: isExpanded,
        }));
    };

    const handleKeysAccordionChange = (event, isExpanded) => {
        setKeysAccordionExpanded(isExpanded);
    };

    const handleConfigAccordionChange = (event, isExpanded) => {
        setConfigAccordionExpanded(isExpanded);
    };

    // Dialog confirm handler
    const handleDialogConfirm = () => {
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
        setCheckboxes({failover: false});
        setStopCheckbox(false);
        setUnprovisionChecked(false);
        setPurgeCheckboxes({
            dataLoss: false,
            configLoss: false,
            serviceInterruption: false,
        });
        setConfirmDialogOpen(false);
        setStopDialogOpen(false);
        setUnprovisionDialogOpen(false);
        setPurgeDialogOpen(false);
        setSimpleDialogOpen(false);
    };

    // Selection helpers
    const toggleNode = (node) =>
        setSelectedNodes((prev) =>
            prev.includes(node) ? prev.filter((n) => n !== node) : [...prev, node]
        );

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
            console.log(`🔍 Configuring EventSource for object: ${decodedObjectName}`);
            configureEventSource(token, decodedObjectName);
        }

        return () => {
            console.log(`🛑 Resetting EventSource filters`);
            const token = localStorage.getItem("authToken");
            if (token) {
                configureEventSource(token); // Reset to default filters
            }
        };
    }, [decodedObjectName]);

    // Effect for handling config updates
    useEffect(() => {
        const unsubscribe = useEventStore.subscribe(
            (state) => state.configUpdates,
            async (updates) => {
                const {name} = parseObjectPath(decodedObjectName);
                const matchingUpdate = updates.find(u =>
                    u.name === name || u.fullName === decodedObjectName
                );

                if (matchingUpdate) {
                    try {
                        await fetchConfig(matchingUpdate.node);
                        setConfigAccordionExpanded(true);
                        openSnackbar("Configuration updated", "info");
                    } catch (err) {
                        console.error(`💥 Failed to fetch updated config:`, err);
                        openSnackbar("Failed to load updated configuration", "error");
                    } finally {
                        clearConfigUpdate(decodedObjectName);
                    }
                }
            }
        );

        // Initial load
        const initialNode = Object.keys(objectInstanceStatus[decodedObjectName] || {})[0];
        if (initialNode) {
            fetchConfig(initialNode).catch(console.error);
        }

        return unsubscribe;
    }, [decodedObjectName, objectInstanceStatus]);

    // Effect for initial data fetch
    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            fetchKeys();
        }
    }, [decodedObjectName]);

    // Memoize data to prevent unnecessary re-renders
    const memoizedObjectData = useMemo(() => objectData, [objectData]);
    const memoizedNodes = useMemo(
        () => Object.keys(memoizedObjectData || {}),
        [memoizedObjectData]
    );

    if (!memoizedObjectData) {
        return (
            <Box p={4}>
                <Typography align="center" color="textSecondary" fontSize="1.2rem">
                    No information available for object <code>{decodedObjectName}</code>.
                </Typography>
            </Box>
        );
    }

    const {kind} = parseObjectPath(decodedObjectName);
    const showKeys = ["cfg", "sec"].includes(kind);

    return (
        <Box sx={{display: "flex", justifyContent: "center", px: 2, py: 4}}>
            <Box sx={{width: "100%", maxWidth: "1400px"}}>
                {/* HEADER */}
                {globalStatus && (
                    <Box
                        sx={{
                            p: 1,
                            mb: 4,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        <Typography variant="h4" fontWeight="bold">
                            {decodedObjectName}
                        </Typography>
                        <Box sx={{display: "flex", alignItems: "center", gap: 2}}>
                            <FiberManualRecordIcon
                                sx={{color: getColor(getObjectStatus().avail), fontSize: "1.2rem"}}
                            />
                            {getObjectStatus().avail === "warn" && (
                                <Tooltip title="Warning">
                                    <WarningAmberIcon sx={{color: orange[500], fontSize: "1.2rem"}}/>
                                </Tooltip>
                            )}
                            {getObjectStatus().frozen === "frozen" && (
                                <Tooltip title="Frozen">
                                    <AcUnitIcon sx={{color: blue[300], fontSize: "1.2rem"}}/>
                                </Tooltip>
                            )}
                            {getObjectStatus().globalExpect && (
                                <Typography variant="caption">{getObjectStatus().globalExpect}</Typography>
                            )}
                            <IconButton
                                onClick={(e) => setObjectMenuAnchor(e.currentTarget)}
                                disabled={actionInProgress}
                                aria-label="Object actions"
                            >
                                <MoreVertIcon sx={{fontSize: "1.2rem"}}/>
                            </IconButton>
                            <Menu
                                anchorEl={objectMenuAnchor}
                                open={Boolean(objectMenuAnchor)}
                                onClose={() => setObjectMenuAnchor(null)}
                            >
                                {OBJECT_ACTIONS.map(({name, icon}) => (
                                    <MenuItem
                                        key={name}
                                        onClick={() => {
                                            setPendingAction({action: name});
                                            if (name === "freeze") {
                                                setCheckboxes({failover: false});
                                                setConfirmDialogOpen(true);
                                            } else if (name === "stop") {
                                                setStopCheckbox(false);
                                                setStopDialogOpen(true);
                                            } else if (name === "unprovision") {
                                                setUnprovisionChecked(false);
                                                setUnprovisionDialogOpen(true);
                                            } else if (name === "purge") {
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
                                        }}
                                    >
                                        <ListItemIcon sx={{minWidth: 40}}>{icon}</ListItemIcon>
                                        <ListItemText>{name.charAt(0).toUpperCase() + name.slice(1)}</ListItemText>
                                    </MenuItem>
                                ))}
                            </Menu>
                        </Box>
                    </Box>
                )}

                {/* KEYS SECTION */}
                {showKeys && (
                    <Box
                        sx={{
                            mb: 4,
                            p: 2,
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 1,
                        }}
                    >
                        <Accordion
                            expanded={keysAccordionExpanded}
                            onChange={handleKeysAccordionChange}
                            sx={{
                                border: "none",
                                boxShadow: "none",
                                backgroundColor: "transparent",
                                "&:before": {display: "none"},
                                "& .MuiAccordionSummary-root": {
                                    border: "none",
                                    backgroundColor: "transparent",
                                    minHeight: "auto",
                                    "&.Mui-expanded": {minHeight: "auto"},
                                    padding: 0,
                                },
                                "& .MuiAccordionDetails-root": {
                                    border: "none",
                                    backgroundColor: "transparent",
                                    padding: 0,
                                },
                            }}
                        >
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon/>}
                                aria-controls="panel-keys-content"
                                id="panel-keys-header"
                            >
                                <Typography variant="h6" fontWeight="medium">
                                    Object Keys ({keys.length})
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Box sx={{display: "flex", justifyContent: "flex-end", mb: 2}}>
                                    <IconButton
                                        color="primary"
                                        onClick={() => setCreateDialogOpen(true)}
                                        disabled={actionLoading}
                                        aria-label="Add new key"
                                    >
                                        <AddIcon/>
                                    </IconButton>
                                </Box>
                                {keysLoading && <CircularProgress size={24}/>}
                                {keysError && (
                                    <Alert severity="error" sx={{mb: 2}}>
                                        {keysError}
                                    </Alert>
                                )}
                                {!keysLoading && !keysError && keys.length === 0 && (
                                    <Typography color="textSecondary">No keys available.</Typography>
                                )}
                                {!keysLoading && !keysError && keys.length > 0 && (
                                    <TableContainer component={Paper} sx={{boxShadow: "none"}}>
                                        <Table sx={{minWidth: 650}} aria-label="keys table">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell sx={{fontWeight: "bold"}}>Name</TableCell>
                                                    <TableCell sx={{fontWeight: "bold"}}>Node</TableCell>
                                                    <TableCell sx={{fontWeight: "bold"}}>Size</TableCell>
                                                    <TableCell sx={{fontWeight: "bold"}}>Actions</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {keys.map((key) => (
                                                    <TableRow key={key.name}>
                                                        <TableCell component="th" scope="row">
                                                            {key.name}
                                                        </TableCell>
                                                        <TableCell>{key.node}</TableCell>
                                                        <TableCell>{key.size} bytes</TableCell>
                                                        <TableCell>
                                                            <IconButton
                                                                onClick={() => {
                                                                    setKeyToUpdate(key.name);
                                                                    setUpdateKeyName(key.name);
                                                                    setUpdateDialogOpen(true);
                                                                }}
                                                                disabled={actionLoading}
                                                                aria-label={`Edit key ${key.name}`}
                                                            >
                                                                <EditIcon/>
                                                            </IconButton>
                                                            <IconButton
                                                                onClick={() => {
                                                                    setKeyToDelete(key.name);
                                                                    setDeleteDialogOpen(true);
                                                                }}
                                                                disabled={actionLoading}
                                                                aria-label={`Delete key ${key.name}`}
                                                            >
                                                                <DeleteIcon/>
                                                            </IconButton>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )}
                            </AccordionDetails>
                        </Accordion>
                    </Box>
                )}

                {/* CONFIGURATION SECTION */}
                <Box
                    sx={{
                        mb: 4,
                        p: 2,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                    }}
                >
                    <Accordion
                        expanded={configAccordionExpanded}
                        onChange={handleConfigAccordionChange}
                        sx={{
                            border: "none",
                            boxShadow: "none",
                            backgroundColor: "transparent",
                            "&:before": {display: "none"},
                            "& .MuiAccordionSummary-root": {
                                border: "none",
                                backgroundColor: "transparent",
                                minHeight: "auto",
                                "&.Mui-expanded": {minHeight: "auto"},
                                padding: 0,
                            },
                            "& .MuiAccordionDetails-root": {
                                border: "none",
                                backgroundColor: "transparent",
                                padding: 0,
                            },
                        }}
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon/>}
                            aria-controls="panel-config-content"
                            id="panel-config-header"
                        >
                            <Typography variant="h6" fontWeight="medium">
                                Configuration
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Box sx={{display: "flex", justifyContent: "flex-end", mb: 2, gap: 1}}>
                                <IconButton
                                    color="primary"
                                    onClick={() => setUpdateConfigDialogOpen(true)}
                                    disabled={actionLoading}
                                    aria-label="Edit configuration file"
                                >
                                    <EditIcon/>
                                </IconButton>
                                <IconButton
                                    color="primary"
                                    onClick={() => setManageParamsDialogOpen(true)}
                                    disabled={actionLoading}
                                    aria-label="Manage configuration parameters"
                                >
                                    <SettingsIcon/>
                                </IconButton>
                            </Box>
                            {configLoading && <CircularProgress size={24}/>}
                            {configError && (
                                <Alert severity="error" sx={{mb: 2}}>
                                    {configError}
                                </Alert>
                            )}
                            {!configLoading && !configError && configData === null && (
                                <Typography color="textSecondary">
                                    No configuration available.
                                </Typography>
                            )}
                            {!configLoading && !configError && configData !== null && (
                                <Box
                                    sx={{
                                        p: 2,
                                        bgcolor: "grey.200",
                                        borderRadius: 1,
                                        maxWidth: "100%",
                                        overflowX: "auto",
                                        boxSizing: "border-box",
                                        scrollbarWidth: "thin",
                                        "&::-webkit-scrollbar": {
                                            height: "8px",
                                        },
                                        "&::-webkit-scrollbar-thumb": {
                                            backgroundColor: "grey.400",
                                            borderRadius: "4px",
                                        },
                                    }}
                                >
                                    <Box
                                        component="pre"
                                        key={configData}
                                        sx={{
                                            whiteSpace: "pre-wrap",
                                            fontFamily: "Monospace",
                                            bgcolor: "inherit",
                                            p: 1,
                                            m: 0,
                                            minWidth: "max-content",
                                        }}
                                    >
                                        {configData}
                                    </Box>
                                </Box>
                            )}
                        </AccordionDetails>
                    </Accordion>
                </Box>

                {/* DELETE KEY DIALOG */}
                <Dialog
                    open={deleteDialogOpen}
                    onClose={() => setDeleteDialogOpen(false)}
                    maxWidth="xs"
                    fullWidth
                >
                    <DialogTitle>Confirm Key Deletion</DialogTitle>
                    <DialogContent>
                        <Typography variant="body1">
                            Are you sure you want to delete the key <strong>{keyToDelete}</strong>?
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDeleteDialogOpen(false)} disabled={actionLoading}>
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            color="error"
                            onClick={handleDeleteKey}
                            disabled={actionLoading}
                        >
                            Delete
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* CREATE KEY DIALOG */}
                <Dialog
                    open={createDialogOpen}
                    onClose={() => setCreateDialogOpen(false)}
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle>Create New Key</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            margin="dense"
                            label="Key Name"
                            fullWidth
                            variant="outlined"
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                            disabled={actionLoading}
                        />
                        <Box sx={{mt: 2}}>
                            <input
                                id="create-key-file-upload"
                                type="file"
                                hidden
                                onChange={(e) => setNewKeyFile(e.target.files[0])}
                                disabled={actionLoading}
                            />
                            <Box sx={{display: "flex", alignItems: "center", gap: 2}}>
                                <Button
                                    variant="outlined"
                                    component="label"
                                    htmlFor="create-key-file-upload"
                                    disabled={actionLoading}
                                >
                                    Choose File
                                </Button>
                                <Typography
                                    variant="body2"
                                    color={newKeyFile ? "textPrimary" : "textSecondary"}
                                >
                                    {newKeyFile ? newKeyFile.name : "No file selected"}
                                </Typography>
                            </Box>
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setCreateDialogOpen(false)} disabled={actionLoading}>
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleCreateKey}
                            disabled={actionLoading || !newKeyName || !newKeyFile}
                        >
                            Create
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* UPDATE KEY DIALOG */}
                <Dialog
                    open={updateDialogOpen}
                    onClose={() => setUpdateDialogOpen(false)}
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle>Update Key</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            margin="dense"
                            label="Key Name"
                            fullWidth
                            variant="outlined"
                            value={updateKeyName}
                            onChange={(e) => setUpdateKeyName(e.target.value)}
                            disabled={actionLoading}
                        />
                        <Box sx={{mt: 2}}>
                            <input
                                id="update-key-file-upload"
                                type="file"
                                hidden
                                onChange={(e) => setUpdateKeyFile(e.target.files[0])}
                                disabled={actionLoading}
                            />
                            <Box sx={{display: "flex", alignItems: "center", gap: 2}}>
                                <Button
                                    variant="outlined"
                                    component="label"
                                    htmlFor="update-key-file-upload"
                                    disabled={actionLoading}
                                >
                                    Choose File
                                </Button>
                                <Typography
                                    variant="body2"
                                    color={updateKeyFile ? "textPrimary" : "textSecondary"}
                                >
                                    {updateKeyFile ? updateKeyFile.name : "No file chosen"}
                                </Typography>
                            </Box>
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setUpdateDialogOpen(false)} disabled={actionLoading}>
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleUpdateKey}
                            disabled={actionLoading || !updateKeyName || !updateKeyFile}
                        >
                            Update
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* UPDATE CONFIG DIALOG */}
                <Dialog
                    open={updateConfigDialogOpen}
                    onClose={() => setUpdateConfigDialogOpen(false)}
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle>Update Configuration</DialogTitle>
                    <DialogContent>
                        <Box sx={{mt: 2}}>
                            <input
                                id="update-config-file-upload"
                                type="file"
                                hidden
                                onChange={(e) => setNewConfigFile(e.target.files[0])}
                                disabled={actionLoading}
                            />
                            <Box sx={{display: "flex", alignItems: "center", gap: 2}}>
                                <Button
                                    variant="outlined"
                                    component="label"
                                    htmlFor="update-config-file-upload"
                                    disabled={actionLoading}
                                >
                                    Choose File
                                </Button>
                                <Typography
                                    variant="body2"
                                    color={newConfigFile ? "textPrimary" : "textSecondary"}
                                >
                                    {newConfigFile ? newConfigFile.name : "No file chosen"}
                                </Typography>
                            </Box>
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button
                            onClick={() => setUpdateConfigDialogOpen(false)}
                            disabled={actionLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleUpdateConfig}
                            disabled={actionLoading || !newConfigFile}
                        >
                            Update
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* MANAGE CONFIG PARAMETERS DIALOG */}
                <Dialog
                    open={manageParamsDialogOpen}
                    onClose={() => setManageParamsDialogOpen(false)}
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle>Manage Configuration Parameters</DialogTitle>
                    <DialogContent>
                        <Typography variant="subtitle1" gutterBottom>
                            Add Parameter
                        </Typography>
                        <TextField
                            autoFocus
                            margin="dense"
                            label="Parameter (e.g., test.test.param=value)"
                            fullWidth
                            variant="outlined"
                            value={paramInput}
                            onChange={(e) => setParamInput(e.target.value)}
                            disabled={actionLoading}
                        />
                        <Typography variant="subtitle1" gutterBottom sx={{mt: 2}}>
                            Unset Parameter
                        </Typography>
                        <TextField
                            margin="dense"
                            label="Parameter key to unset (e.g., test.test)"
                            fullWidth
                            variant="outlined"
                            value={paramToUnset}
                            onChange={(e) => setParamToUnset(e.target.value)}
                            disabled={actionLoading}
                        />
                        <Typography variant="subtitle1" gutterBottom sx={{mt: 2}}>
                            Delete Parameter
                        </Typography>
                        <TextField
                            margin="dense"
                            label="Parameter key to delete (e.g., test)"
                            fullWidth
                            variant="outlined"
                            value={paramToDelete}
                            onChange={(e) => setParamToDelete(e.target.value)}
                            disabled={actionLoading}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button
                            onClick={() => setManageParamsDialogOpen(false)}
                            disabled={actionLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleManageParamsSubmit}
                            disabled={actionLoading || (!paramInput && !paramToUnset && !paramToDelete)}
                        >
                            Apply
                        </Button>
                    </DialogActions>
                </Dialog>

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
                    const {resources = {}} = memoizedObjectData[node] || {};
                    const {avail, frozen, state} = getNodeState(node);
                    const resIds = Object.keys(resources);

                    return (
                        <Box
                            key={node}
                            sx={{
                                mb: 5,
                                display: "flex",
                                flexDirection: "column",
                                gap: 2,
                                border: "1px solid",
                                borderColor: "divider",
                                borderRadius: 1,
                                p: 2,
                            }}
                        >
                            <Box sx={{p: 1}}>
                                <Box sx={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                                    <Box sx={{display: "flex", alignItems: "center", gap: 1}}>
                                        <Checkbox
                                            checked={selectedNodes.includes(node)}
                                            onChange={() => toggleNode(node)}
                                            aria-label={`Select node ${node}`}
                                        />
                                        <Typography variant="h6">{node}</Typography>
                                    </Box>
                                    <Box sx={{display: "flex", alignItems: "center", gap: 2}}>
                                        <FiberManualRecordIcon
                                            sx={{color: getColor(avail), fontSize: "1.2rem"}}
                                        />
                                        {avail === "warn" && (
                                            <Tooltip title="Warning">
                                                <WarningAmberIcon
                                                    sx={{color: orange[500], fontSize: "1.2rem"}}
                                                />
                                            </Tooltip>
                                        )}
                                        {frozen === "frozen" && (
                                            <Tooltip title="Frozen">
                                                <AcUnitIcon sx={{fontSize: "medium", color: blue[300]}}/>
                                            </Tooltip>
                                        )}
                                        {state && <Typography variant="caption">{state}</Typography>}
                                        <IconButton
                                            onClick={(e) => {
                                                setCurrentNode(node);
                                                setIndividualNodeMenuAnchor(e.currentTarget);
                                            }}
                                            disabled={actionInProgress}
                                            aria-label={`Node ${node} actions`}
                                        >
                                            <MoreVertIcon/>
                                        </IconButton>
                                    </Box>
                                </Box>
                            </Box>

                            {/* RESOURCES ACCORDION */}
                            <Accordion
                                expanded={expandedNodeResources[node] || false}
                                onChange={handleNodeResourcesAccordionChange(node)}
                                sx={{
                                    border: "none",
                                    boxShadow: "none",
                                    backgroundColor: "transparent",
                                    "&:before": {display: "none"},
                                    "& .MuiAccordionSummary-root": {
                                        border: "none",
                                        backgroundColor: "transparent",
                                        minHeight: "auto",
                                        "&.Mui-expanded": {minHeight: "auto"},
                                        padding: 0,
                                    },
                                    "& .MuiAccordionDetails-root": {
                                        border: "none",
                                        backgroundColor: "transparent",
                                        padding: 0,
                                    },
                                }}
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon/>}
                                    aria-controls={`panel-resources-${node}-content`}
                                    id={`panel-resources-${node}-header`}
                                >
                                    <Box display="flex" alignItems="center" gap={2} width="100%">
                                        <Typography variant="subtitle1" fontWeight="medium">
                                            Resources ({resIds.length})
                                        </Typography>
                                        <Box sx={{display: "flex", alignItems: "center", gap: 1}}>
                                            <Checkbox
                                                checked={
                                                    (selectedResourcesByNode[node]?.length || 0) === resIds.length &&
                                                    resIds.length > 0
                                                }
                                                onChange={(e) => {
                                                    const next = e.target.checked ? resIds : [];
                                                    setSelectedResourcesByNode((prev) => ({
                                                        ...prev,
                                                        [node]: next,
                                                    }));
                                                }}
                                                disabled={resIds.length === 0}
                                                aria-label={`Select all resources for node ${node}`}
                                            />
                                            <IconButton
                                                onClick={(e) => {
                                                    handleResourcesActionsOpen(node, e);
                                                    e.stopPropagation();
                                                }}
                                                disabled={!(selectedResourcesByNode[node] || []).length}
                                                aria-label={`Resource actions for node ${node}`}
                                            >
                                                <MoreVertIcon/>
                                            </IconButton>
                                        </Box>
                                    </Box>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <Box>
                                        {resIds.length === 0 ? (
                                            <Typography color="textSecondary">
                                                No resources available.
                                            </Typography>
                                        ) : (
                                            <Box sx={{display: "flex", flexDirection: "column", gap: 1}}>
                                                {resIds.map((rid) => {
                                                    const res = resources[rid] || {};
                                                    const resourcePanelId = `resource-${node}-${rid}`;
                                                    return (
                                                        <Accordion
                                                            key={rid}
                                                            expanded={expandedResources[resourcePanelId] || false}
                                                            onChange={handleAccordionChange(resourcePanelId)}
                                                            sx={{
                                                                mb: 1,
                                                                border: "none",
                                                                boxShadow: "none",
                                                                backgroundColor: "transparent",
                                                                "&:before": {display: "none"},
                                                                "& .MuiAccordionSummary-root": {
                                                                    border: "none",
                                                                    backgroundColor: "transparent",
                                                                    minHeight: "auto",
                                                                    "&.Mui-expanded": {minHeight: "auto"},
                                                                    padding: 0,
                                                                },
                                                                "& .MuiAccordionDetails-root": {
                                                                    border: "none",
                                                                    backgroundColor: "transparent",
                                                                    padding: 0,
                                                                },
                                                            }}
                                                        >
                                                            <AccordionSummary
                                                                expandIcon={<ExpandMoreIcon/>}
                                                                aria-controls={`panel-${resourcePanelId}-content`}
                                                                id={`panel-${resourcePanelId}-header`}
                                                            >
                                                                <Box
                                                                    display="flex"
                                                                    alignItems="center"
                                                                    gap={2}
                                                                    width="100%"
                                                                >
                                                                    <Checkbox
                                                                        checked={(selectedResourcesByNode[node] || []).includes(rid)}
                                                                        onChange={() => toggleResource(node, rid)}
                                                                        aria-label={`Select resource ${rid}`}
                                                                    />
                                                                    <Typography variant="body1">{rid}</Typography>
                                                                    <Box flexGrow={1}/>
                                                                    <FiberManualRecordIcon
                                                                        sx={{
                                                                            color: getColor(res.status),
                                                                            fontSize: "1rem",
                                                                        }}
                                                                    />
                                                                    <IconButton
                                                                        onClick={(e) => {
                                                                            handleResourceMenuOpen(node, rid, e);
                                                                            e.stopPropagation();
                                                                        }}
                                                                        disabled={actionInProgress}
                                                                        aria-label={`Resource ${rid} actions`}
                                                                    >
                                                                        <MoreVertIcon/>
                                                                    </IconButton>
                                                                </Box>
                                                            </AccordionSummary>
                                                            <AccordionDetails>
                                                                <Box
                                                                    sx={{
                                                                        display: "flex",
                                                                        flexDirection: "column",
                                                                        gap: 1,
                                                                    }}
                                                                >
                                                                    <Typography variant="body2">
                                                                        <strong>Label:</strong> {res.label || "N/A"}
                                                                    </Typography>
                                                                    <Typography variant="body2">
                                                                        <strong>Type:</strong> {res.type || "N/A"}
                                                                    </Typography>
                                                                    <Typography variant="body2">
                                                                        <strong>Provisioned:</strong>
                                                                        <FiberManualRecordIcon
                                                                            sx={{
                                                                                color: parseProvisionedState(res.provisioned?.state)
                                                                                    ? green[500]
                                                                                    : red[500],
                                                                                fontSize: "1rem",
                                                                                ml: 1,
                                                                                verticalAlign: "middle",
                                                                            }}
                                                                        />
                                                                    </Typography>
                                                                    <Typography variant="body2">
                                                                        <strong>Last Updated:</strong>{" "}
                                                                        {res.provisioned?.mtime || "N/A"}
                                                                    </Typography>
                                                                </Box>
                                                            </AccordionDetails>
                                                        </Accordion>
                                                    );
                                                })}
                                            </Box>
                                        )}
                                    </Box>
                                </AccordionDetails>
                            </Accordion>
                        </Box>
                    );
                })}

                <Menu
                    anchorEl={nodesActionsAnchor}
                    open={Boolean(nodesActionsAnchor)}
                    onClose={handleNodesActionsClose}
                >
                    {NODE_ACTIONS.map(({name, icon}) => (
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
                    {NODE_ACTIONS.map(({name, icon}) => (
                        <MenuItem key={name} onClick={() => handleIndividualNodeActionClick(name)}>
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
                        <MenuItem key={name} onClick={() => handleBatchResourceActionClick(name)}>
                            <ListItemIcon sx={{minWidth: 40}}>{icon}</ListItemIcon>
                            <ListItemText>{name.charAt(0).toUpperCase() + name.slice(1)}</ListItemText>
                        </MenuItem>
                    ))}
                </Menu>

                <Menu
                    anchorEl={resourceMenuAnchor}
                    open={Boolean(resourceMenuAnchor)}
                    onClose={handleResourceMenuClose}
                >
                    {RESOURCE_ACTIONS.map(({name, icon}) => (
                        <MenuItem key={name} onClick={() => handleResourceActionClick(name)}>
                            <ListItemIcon sx={{minWidth: 40}}>{icon}</ListItemIcon>
                            <ListItemText>{name.charAt(0).toUpperCase() + name.slice(1)}</ListItemText>
                        </MenuItem>
                    ))}
                </Menu>

                <FreezeDialog
                    open={confirmDialogOpen}
                    onClose={() => setConfirmDialogOpen(false)}
                    onConfirm={handleDialogConfirm}
                    checked={checkboxes.failover}
                    setChecked={(checked) => setCheckboxes({failover: checked})}
                    disabled={actionInProgress}
                />

                <StopDialog
                    open={stopDialogOpen}
                    onClose={() => setStopDialogOpen(false)}
                    onConfirm={handleDialogConfirm}
                    checked={stopCheckbox}
                    setChecked={setStopCheckbox}
                    disabled={actionInProgress}
                />

                <UnprovisionDialog
                    open={unprovisionDialogOpen}
                    onClose={() => setUnprovisionDialogOpen(false)}
                    onConfirm={handleDialogConfirm}
                    checked={unprovisionChecked}
                    setChecked={setUnprovisionChecked}
                    disabled={actionInProgress}
                />

                <PurgeDialog
                    open={purgeDialogOpen}
                    onClose={() => setPurgeDialogOpen(false)}
                    onConfirm={handleDialogConfirm}
                    checkboxes={purgeCheckboxes}
                    setCheckboxes={setPurgeCheckboxes}
                    disabled={actionInProgress}
                />

                <SimpleConfirmDialog
                    open={simpleDialogOpen}
                    onClose={() => setSimpleDialogOpen(false)}
                    onConfirm={handleDialogConfirm}
                    action={pendingAction?.action || ""}
                    target={
                        pendingAction?.batch === "nodes"
                            ? "selected nodes"
                            : pendingAction?.node && !pendingAction?.rid
                                ? `node ${pendingAction.node}`
                                : pendingAction?.batch === "resources"
                                    ? `selected resources on node ${pendingAction.node}`
                                    : pendingAction?.rid
                                        ? `resource ${pendingAction.rid} on node ${pendingAction.node}`
                                        : "the object"
                    }
                />

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