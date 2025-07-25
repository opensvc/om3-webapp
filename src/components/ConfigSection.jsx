import React, {useState, useEffect, useRef} from "react";
import {
    Box,
    Typography,
    Tooltip,
    IconButton,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    CircularProgress,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import EditIcon from "@mui/icons-material/Edit";
import {URL_OBJECT, URL_NODE} from "../config/apiPath.js";

const ConfigSection = ({decodedObjectName, configNode, setConfigNode, openSnackbar}) => {
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
    const [actionLoading, setActionLoading] = useState(false);

    // Debounce ref to prevent multiple fetchConfig calls
    const lastFetch = useRef({});

    // Helper function to parse object path
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

    // Fetch configuration for the object
    const fetchConfig = async (node) => {
        if (!node) {
            setConfigError("No node available to fetch configuration.");
            return;
        }

        const key = `${decodedObjectName}:${node}`;
        const now = Date.now();
        if (lastFetch.current[key] && now - lastFetch.current[key] < 1000) return;
        lastFetch.current[key] = now;

        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken") || '';

        setConfigLoading(true);
        setConfigError(null);
        setConfigNode(node);

        try {
            const response = await fetch(`${URL_NODE}/${node}/instance/path/${namespace}/${kind}/${name}/config/file`, {
                headers: {Authorization: `Bearer ${token}`},
                cache: "no-cache",
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const text = await response.text();
            setConfigData(text);
        } catch (err) {
            setConfigError(`Failed to fetch config: ${err.message}`);
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
            if (!response.ok) throw new Error(`Failed to update config: ${response.status}`);
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
                const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/config?set=${encodeURIComponent(
                    key
                )}=${encodeURIComponent(value)}`;
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
                const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/config?unset=${encodeURIComponent(
                    key
                )}`;
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
                const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/config?delete=${encodeURIComponent(
                    key
                )}`;
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

    // Handle accordion expansion
    const handleConfigAccordionChange = (event, isExpanded) => {
        setConfigAccordionExpanded(isExpanded);
    };

    // Initial load effect
    useEffect(() => {
        if (!configNode) {
            setConfigError("No node available to fetch configuration.");
        } else {
            fetchConfig(configNode);
        }
    }, [configNode, decodedObjectName]);

    return (
        <Box
            sx={{
                mb: 4,
                p: 2,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                width: "100%",
                maxWidth: "1400px",
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
                        <Tooltip title="Upload a new configuration file">
                            <IconButton
                                color="primary"
                                onClick={() => setUpdateConfigDialogOpen(true)}
                                disabled={actionLoading}
                                aria-label="Upload new configuration file"
                            >
                                <UploadFileIcon/>
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Manage configuration parameters (add, unset, delete)">
                            <IconButton
                                color="primary"
                                onClick={() => setManageParamsDialogOpen(true)}
                                disabled={actionLoading}
                                aria-label="Manage configuration parameters"
                            >
                                <EditIcon/>
                            </IconButton>
                        </Tooltip>
                    </Box>
                    {configLoading && <CircularProgress size={24}/>}
                    {configError && (
                        <Alert severity="error" sx={{mb: 2}}>
                            {configError}
                        </Alert>
                    )}
                    {!configLoading && !configError && configData === null && (
                        <Typography color="textSecondary">No configuration available.</Typography>
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
                        aria-label="Parameters to set"
                        fullWidth
                        variant="outlined"
                        multiline
                        rows={4}
                        value={paramsToSet}
                        onChange={(e) => setParamsToSet(e.target.value)}
                        disabled={actionLoading}
                        placeholder="section.param1=value1&#10;section.param2=value2"
                    />
                    <Typography variant="subtitle1" gutterBottom sx={{mt: 2}}>
                        Unset parameters (one key per line, e.g., section.param)
                    </Typography>
                    <TextField
                        margin="dense"
                        label="Parameter keys to unset"
                        aria-label="Parameter keys to unset"
                        fullWidth
                        variant="outlined"
                        multiline
                        rows={4}
                        value={paramsToUnset}
                        onChange={(e) => setParamsToUnset(e.target.value)}
                        disabled={actionLoading}
                        placeholder="section.param1&#10;section.param2"
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
                        aria-label="Section keys to delete"
                        fullWidth
                        variant="outlined"
                        multiline
                        rows={4}
                        value={paramsToDelete}
                        onChange={(e) => setParamsToDelete(e.target.value)}
                        disabled={actionLoading}
                        placeholder="section1&#10;section2"
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
                            actionLoading || (!paramsToSet && !paramsToUnset && !paramsToDelete)
                        }
                    >
                        Apply
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ConfigSection;
