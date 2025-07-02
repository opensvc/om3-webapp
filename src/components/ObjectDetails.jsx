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
import UploadFileIcon from "@mui/icons-material/UploadFile";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import {green, red, grey, blue, orange} from "@mui/material/colors";
import useEventStore from "../hooks/useEventStore.js";
import {closeEventSource, startEventReception} from "../eventSourceManager.jsx";
import {URL_OBJECT, URL_NODE} from "../config/apiPath.js";
import {
    FreezeDialog,
    StopDialog,
    UnprovisionDialog,
    PurgeDialog,
    SimpleConfirmDialog,
    SwitchDialog,
    GivebackDialog,
    DeleteDialog,
} from "../components/ActionDialogs";
import {isActionAllowedForSelection, extractKind} from "../utils/objectUtils";
import HeaderSection from "./HeaderSection";
import ConfigSection from "./ConfigSection";
import KeysSection from "./KeysSection";
import NodeCard from "./NodeCard";
import {OBJECT_ACTIONS, NODE_ACTIONS, RESOURCE_ACTIONS} from "../constants/actions";

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

    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [stopDialogOpen, setStopDialogOpen] = useState(false);
    const [unprovisionDialogOpen, setUnprovisionDialogOpen] = useState(false);
    const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
    const [deleteDialogOpen2, setDeleteDialogOpen2] = useState(false);
    const [simpleDialogOpen, setSimpleDialogOpen] = useState(false);
    const [switchDialogOpen, setSwitchDialogOpen] = useState(false);
    const [givebackDialogOpen, setGivebackDialogOpen] = useState(false);
    const [checkboxes, setCheckboxes] = useState({failover: false});
    const [stopCheckbox, setStopCheckbox] = useState(false);
    const [unprovisionCheckboxes, setUnprovisionCheckboxes] = useState({
        dataLoss: false,
        serviceInterruption: false,
    });
    const [deleteCheckboxes, setDeleteCheckboxes] = useState({
        configLoss: false,
        clusterwide: false,
    });
    const [purgeCheckboxes, setPurgeCheckboxes] = useState({
        dataLoss: false,
        configLoss: false,
        serviceInterruption: false,
    });
    const [switchCheckbox, setSwitchCheckbox] = useState(false);
    const [givebackCheckbox, setGivebackCheckbox] = useState(false);

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

    // Log initial state to confirm setSelectedResourcesByNode
    console.log("ObjectDetail initial state:", {
        selectedResourcesByNode,
        setSelectedResourcesByNode: typeof setSelectedResourcesByNode,
    });

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
        if (!node) {
            console.warn(`🚫 [fetchConfig] No node provided for ${decodedObjectName}`);
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
            console.warn(`⏳ [fetchConfig] Already loading, queuing request for node=${node}`);
            await new Promise((resolve) => setTimeout(resolve, 100));
            if (configLoading) {
                console.warn(`🚫 [fetchConfig] Still loading, skipping request for node=${node}`);
                return;
            }
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
        setConfigNode(node);
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

    // Add configuration parameters
    const handleAddParams = async () => {
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

        setActionLoading(true);
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
                console.warn(`⚠️ [handleAddParams] No configNode available for ${decodedObjectName}`);
            }
        }
        setActionLoading(false);
        return successCount > 0;
    };

    // Unset configuration parameters
    const handleUnsetParams = async () => {
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

        setActionLoading(true);
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
                console.warn(`⚠️ [handleUnsetParams] No configNode available for ${decodedObjectName}`);
            }
        }
        setActionLoading(false);
        return successCount > 0;
    };

    // Delete configuration parameters
    const handleDeleteParams = async () => {
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

        setActionLoading(true);
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
                console.warn(`⚠️ [handleDeleteParams] No configNode available for ${decodedObjectName}`);
            }
        }
        setActionLoading(false);
        return successCount > 0;
    };

    // Handle manage parameters dialog submission
    const handleManageParamsSubmit = async () => {
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
        } else if (action === "delete") {
            setDeleteCheckboxes({
                configLoss: false,
                clusterwide: false,
            });
            setDeleteDialogOpen2(true);
        } else if (action === "switch") {
            setSwitchCheckbox(false);
            setSwitchDialogOpen(true);
        } else if (action === "giveback") {
            setGivebackCheckbox(false);
            setGivebackDialogOpen(true);
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
        } else if (action === "delete") {
            setDeleteCheckboxes({
                configLoss: false,
                clusterwide: false,
            });
            setDeleteDialogOpen2(true);
        } else if (action === "switch") {
            setSwitchCheckbox(false);
            setSwitchDialogOpen(true);
        } else if (action === "giveback") {
            setGivebackCheckbox(false);
            setGivebackDialogOpen(true);
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
        if (action === "delete") {
            setDeleteCheckboxes({
                configLoss: false,
                clusterwide: false,
            });
            setDeleteDialogOpen2(true);
        } else {
            setSimpleDialogOpen(true);
        }
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
        if (action === "delete") {
            setDeleteCheckboxes({
                configLoss: false,
                clusterwide: false,
            });
            setDeleteDialogOpen2(true);
        } else {
            setSimpleDialogOpen(true);
        }
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
                clusterwide: false,
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
        } else if (action === "delete") {
            setDeleteCheckboxes({
                configLoss: false,
                clusterwide: false,
            });
            setDeleteDialogOpen2(true);
        } else if (action === "switch") {
            setSwitchCheckbox(false);
            setSwitchDialogOpen(true);
        } else if (action === "giveback") {
            setGivebackCheckbox(false);
            setGivebackDialogOpen(true);
        } else {
            setSimpleDialogOpen(true);
        }
        setObjectMenuAnchor(null);
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

        // Reset all dialog states
        setPendingAction(null);
        setCheckboxes({failover: false});
        setStopCheckbox(false);
        setUnprovisionCheckboxes({
            dataLoss: false,
            serviceInterruption: false,
        });
        setDeleteCheckboxes({
            configLoss: false,
            clusterwide: false,
        });
        setPurgeCheckboxes({
            dataLoss: false,
            configLoss: false,
            serviceInterruption: false,
        });
        setSwitchCheckbox(false);
        setGivebackCheckbox(false);
        setConfirmDialogOpen(false);
        setStopDialogOpen(false);
        setUnprovisionDialogOpen(false);
        setPurgeDialogOpen(false);
        setDeleteDialogOpen2(false);
        setSimpleDialogOpen(false);
        setSwitchDialogOpen(false);
        setGivebackDialogOpen(false);
    };

    // Selection helpers
    const toggleNode = (node) =>
        setSelectedNodes((prev) =>
            prev.includes(node) ? prev.filter((n) => n !== node) : [...prev, node]
        );

    const toggleResource = (node, rid) => {
        console.log("toggleResource called:", {
            node,
            rid,
            setSelectedResourcesByNode: typeof setSelectedResourcesByNode,
        });
        setSelectedResourcesByNode((prev) => {
            const current = prev[node] || [];
            const next = current.includes(rid)
                ? current.filter((r) => r !== rid)
                : [...current, rid];
            console.log("toggleResource:", {node, rid, current, next, prev});
            return {...prev, [node]: next};
        });
    };

    // Effect for configuring EventSource
    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            console.log(`🔍 Starting EventSource for object: ${decodedObjectName}`);
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
            console.log(`🛑 Closing EventSource for object: ${decodedObjectName}`);
            closeEventSource();
        };
    }, [decodedObjectName]);

    // Effect for handling config updates
    useEffect(() => {
        const unsubscribe = useEventStore.subscribe(
            (state) => state.configUpdates,
            async (updates) => {
                const {name} = parseObjectPath(decodedObjectName);
                const matchingUpdate = updates.find(
                    (u) =>
                        (u.name === name || u.fullName === decodedObjectName) &&
                        u.type === "InstanceConfigUpdated"
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

        return unsubscribe;
    }, [decodedObjectName]);

    // Initial load effects
    useEffect(() => {
        const loadInitialConfig = async () => {
            if (!objectInstanceStatus[decodedObjectName]) {
                console.log(
                    `⏳ [Initial Load] Waiting for objectInstanceStatus for ${decodedObjectName}`
                );
                return;
            }

            const initialNode = Object.keys(
                objectInstanceStatus[decodedObjectName] || {}
            )[0];
            if (initialNode) {
                try {
                    await fetchConfig(initialNode);
                } catch (err) {
                    console.error(
                        `💥 [Initial Load] Failed to fetch config for ${decodedObjectName}:`,
                        err
                    );
                }
            } else {
                setConfigError("No nodes available to fetch configuration.");
                console.warn(
                    `🚫 [Initial Load] No initial node found for ${decodedObjectName}`
                );
            }
        };

        const token = localStorage.getItem("authToken");
        if (token) {
            fetchKeys();
        }

        loadInitialConfig();
    }, [decodedObjectName, objectInstanceStatus]);

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
                <HeaderSection
                    decodedObjectName={decodedObjectName}
                    globalStatus={globalStatus}
                    actionInProgress={actionInProgress}
                    objectMenuAnchor={objectMenuAnchor}
                    setObjectMenuAnchor={setObjectMenuAnchor}
                    setPendingAction={setPendingAction}
                    setConfirmDialogOpen={setConfirmDialogOpen}
                    setStopDialogOpen={setStopDialogOpen}
                    setUnprovisionDialogOpen={setUnprovisionDialogOpen}
                    setPurgeDialogOpen={setPurgeDialogOpen}
                    setDeleteDialogOpen={setDeleteDialogOpen2}
                    setSimpleDialogOpen={setSimpleDialogOpen}
                    setCheckboxes={setCheckboxes}
                    setStopCheckbox={setStopCheckbox}
                    setUnprovisionCheckboxes={setUnprovisionCheckboxes}
                    setPurgeCheckboxes={setPurgeCheckboxes}
                    setDeleteCheckboxes={setDeleteCheckboxes}
                    setSwitchDialogOpen={setSwitchDialogOpen}
                    setSwitchCheckbox={setSwitchCheckbox}
                    setGivebackDialogOpen={setGivebackDialogOpen}
                    setGivebackCheckbox={setGivebackCheckbox}
                    getObjectStatus={getObjectStatus}
                    getColor={getColor}
                    handleObjectActionClick={handleObjectActionClick}
                />

                <KeysSection decodedObjectName={decodedObjectName} openSnackbar={openSnackbar}/>

                <ConfigSection
                    decodedObjectName={decodedObjectName}
                    configNode={configNode}
                    setConfigNode={setConfigNode}
                    openSnackbar={openSnackbar}
                />

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
                            Add parameters (one per line, e.g., section.param=value)
                        </Typography>
                        <TextField
                            autoFocus
                            margin="dense"
                            label="Parameters to set"
                            fullWidth
                            variant="outlined"
                            multiline
                            rows={4}
                            value={paramsToSet}
                            onChange={(e) => setParamsToSet(e.target.value)}
                            disabled={actionLoading}
                            placeholder="section.param1=value1
section.param2=value2"
                        />
                        <Typography variant="subtitle1" gutterBottom sx={{mt: 2}}>
                            Unset parameters (one key per line, e.g., section.param)
                        </Typography>
                        <TextField
                            margin="dense"
                            label="Parameter keys to unset"
                            fullWidth
                            variant="outlined"
                            multiline
                            rows={4}
                            value={paramsToUnset}
                            onChange={(e) => setParamsToUnset(e.target.value)}
                            disabled={actionLoading}
                            placeholder="section.param1
section.param2"
                            sx={{
                                "& .MuiInputBase-root": {
                                    padding: "8px",
                                    lineHeight: "1.5",
                                    minHeight: "100px",
                                },
                                "& .MuiInputBase-input": {
                                    overflow: "auto",
                                    boxSizing: "border-box",
                                },
                                "& .MuiInputLabel-root": {
                                    backgroundColor: "white",
                                    padding: "0 4px",
                                },
                            }}
                        />
                        <Typography variant="subtitle1" gutterBottom sx={{mt: 2}}>
                            Delete sections (one key per line, e.g., section)
                        </Typography>
                        <TextField
                            margin="dense"
                            label="Section keys to delete"
                            fullWidth
                            variant="outlined"
                            multiline
                            rows={4}
                            value={paramsToDelete}
                            onChange={(e) => setParamsToDelete(e.target.value)}
                            disabled={actionLoading}
                            placeholder="section1
section2"
                            sx={{
                                "& .MuiInputBase-root": {
                                    padding: "8px",
                                    lineHeight: "1.5",
                                    minHeight: "100px",
                                },
                                "& .MuiInputBase-input": {
                                    overflow: "auto",
                                    boxSizing: "border-box",
                                },
                                "& .MuiInputLabel-root": {
                                    backgroundColor: "white",
                                    padding: "0 4px",
                                },
                            }}
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
                            disabled={
                                actionLoading ||
                                (!paramsToSet && !paramsToUnset && !paramsToDelete)
                            }
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
                    console.log("Rendering NodeCard for node:", node, {
                        selectedResourcesByNode,
                        setSelectedResourcesByNode: typeof setSelectedResourcesByNode,
                        toggleResource: typeof toggleResource,
                    });
                    return (
                        <NodeCard
                            key={node}
                            node={node}
                            nodeData={memoizedObjectData[node] || {}}
                            selectedNodes={selectedNodes}
                            toggleNode={toggleNode}
                            selectedResourcesByNode={selectedResourcesByNode}
                            setSelectedResourcesByNode={setSelectedResourcesByNode}
                            toggleResource={toggleResource}
                            actionInProgress={actionInProgress}
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
                            setPendingAction={setPendingAction}
                            setConfirmDialogOpen={setConfirmDialogOpen}
                            setStopDialogOpen={setStopDialogOpen}
                            setUnprovisionDialogOpen={setUnprovisionDialogOpen}
                            setPurgeDialogOpen={setPurgeDialogOpen}
                            setDeleteDialogOpen={setDeleteDialogOpen2}
                            setSimpleDialogOpen={setSimpleDialogOpen}
                            setCheckboxes={setCheckboxes}
                            setStopCheckbox={setStopCheckbox}
                            setUnprovisionCheckboxes={setUnprovisionCheckboxes}
                            setPurgeCheckboxes={setPurgeCheckboxes}
                            setDeleteCheckboxes={setDeleteCheckboxes}
                            parseProvisionedState={parseProvisionedState}
                        />
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
                    checkboxes={unprovisionCheckboxes}
                    setCheckboxes={setUnprovisionCheckboxes}
                    disabled={actionInProgress}
                    pendingAction={pendingAction}
                />

                <PurgeDialog
                    open={purgeDialogOpen}
                    onClose={() => setPurgeDialogOpen(false)}
                    onConfirm={handleDialogConfirm}
                    checkboxes={purgeCheckboxes}
                    setCheckboxes={setPurgeCheckboxes}
                    disabled={actionInProgress}
                />

                <DeleteDialog
                    open={deleteDialogOpen2}
                    onClose={() => setDeleteDialogOpen2(false)}
                    onConfirm={handleDialogConfirm}
                    checkboxes={deleteCheckboxes}
                    setCheckboxes={setDeleteCheckboxes}
                    disabled={actionInProgress}
                />

                <SwitchDialog
                    open={switchDialogOpen}
                    onClose={() => setSwitchDialogOpen(false)}
                    onConfirm={handleDialogConfirm}
                    checked={switchCheckbox}
                    setChecked={setSwitchCheckbox}
                    disabled={actionInProgress}
                />

                <GivebackDialog
                    open={givebackDialogOpen}
                    onClose={() => setGivebackDialogOpen(false)}
                    onConfirm={handleDialogConfirm}
                    checked={givebackCheckbox}
                    setChecked={setGivebackCheckbox}
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
