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
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Autocomplete,
    Grid,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import EditIcon from "@mui/icons-material/Edit";
import InfoIcon from "@mui/icons-material/Info";
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
    const [paramsToSet, setParamsToSet] = useState([]); // Array of {section, option, value, id, isIndexed?, prefix?}
    const [paramsToUnset, setParamsToUnset] = useState([]); // Array of {section, option}
    const [paramsToDelete, setParamsToDelete] = useState([]); // Array of sections
    const [actionLoading, setActionLoading] = useState(false);
    // State for keywords
    const [keywordsData, setKeywordsData] = useState(null);
    const [keywordsLoading, setKeywordsLoading] = useState(false);
    const [keywordsError, setKeywordsError] = useState(null);
    const [keywordsDialogOpen, setKeywordsDialogOpen] = useState(false);
    // State for existing parameters
    const [existingParams, setExistingParams] = useState(null);
    const [existingParamsLoading, setExistingParamsLoading] = useState(false);
    const [existingParamsError, setExistingParamsError] = useState(null);

    // Debounce ref to prevent multiple fetch calls
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

    // Fetch keywords for the object
    const fetchKeywords = async () => {
        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken") || '';

        setKeywordsLoading(true);
        setKeywordsError(null);

        // Set a timeout for the fetch operation (60 seconds)
        const timeout = 60000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, timeout);

        try {
            const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/config/keywords`;
            const response = await fetch(url, {
                headers: {Authorization: `Bearer ${token}`},
                cache: "no-cache",
                signal: controller.signal,
            });

            // Clear the timeout
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            // Log response headers and size for debugging
            console.debug('Response headers:', [...response.headers.entries()]);
            const contentLength = response.headers.get('Content-Length');
            console.debug('Response content length:', contentLength || 'Unknown');

            // Parse the response as JSON
            const data = await response.json();
            console.debug('Parsed keywords data:', data);

            // Validate data
            if (!data || !data.items) {
                throw new Error('Invalid response format: missing items');
            }

            // Deduplicate keywordsData by section and option
            const seen = new Set();
            const uniqueKeywords = data.items.filter(item => {
                const key = `${item.section || 'default'}.${item.option}`;
                if (seen.has(key)) {
                    console.debug(`Duplicate keyword found: ${key}`);
                    return false;
                }
                seen.add(key);
                return true;
            });

            setKeywordsData(uniqueKeywords);
        } catch (err) {
            if (err.name === 'AbortError') {
                setKeywordsError('Request timed out after 60 seconds');
                console.error('Fetch keywords timed out');
            } else {
                setKeywordsError(`Failed to fetch keywords: ${err.message}`);
                console.error('Fetch keywords error:', err);
            }
        } finally {
            clearTimeout(timeoutId);
            setKeywordsLoading(false);
        }
    };

    // Fetch existing parameters for the object
    const fetchExistingParams = async () => {
        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken") || '';

        setExistingParamsLoading(true);
        setExistingParamsError(null);

        try {
            const response = await fetch(`${URL_OBJECT}/${namespace}/${kind}/${name}/config`, {
                headers: {Authorization: `Bearer ${token}`},
                cache: "no-cache",
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            setExistingParams(data.items || []);
        } catch (err) {
            setExistingParamsError(`Failed to fetch existing parameters: ${err.message}`);
        } finally {
            setExistingParamsLoading(false);
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
        if (!paramsToSet.length) {
            openSnackbar("Parameter input is required.", "error");
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
        for (const param of paramsToSet) {
            const {section, option, value, isIndexed, prefix} = param;
            try {
                // Validate against keywordsData
                const keyword = keywordsData?.find(k => k.option === option);
                if (!keyword) {
                    openSnackbar(`Invalid parameter: ${section ? `${section}.` : ''}${option}`, "error");
                    continue;
                }
                // Require section/index for non-DEFAULT keywords
                if (keyword.section !== "DEFAULT" && !section) {
                    openSnackbar(`Section${isIndexed ? ' index' : ''} is required for parameter: ${option}`, "error");
                    continue;
                }
                // For indexed parameters, validate index is a non-negative integer
                if (isIndexed) {
                    if (!/^\d+$/.test(section)) {
                        openSnackbar(`Invalid index for ${option}: must be a non-negative integer`, "error");
                        continue;
                    }
                }
                // Basic validation based on converter
                if (keyword.converter === "converters.TListLowercase" && value.includes(",")) {
                    const values = value.split(",").map(v => v.trim().toLowerCase());
                    if (values.some(v => !v)) {
                        openSnackbar(`Invalid value for ${option}: must be comma-separated lowercase strings`, "error");
                        continue;
                    }
                }

                // Construct real section
                const real_section = isIndexed ? `${prefix}#${section}` : section;

                const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/config?set=${encodeURIComponent(
                    real_section ? `${real_section}.${option}` : option
                )}=${encodeURIComponent(value)}`;
                const response = await fetch(url, {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                if (!response.ok)
                    throw new Error(`Failed to add parameter ${option}: ${response.status}`);
                successCount++;
            } catch (err) {
                openSnackbar(`Error adding parameter ${option}: ${err.message}`, "error");
            }
        }
        if (successCount > 0) {
            openSnackbar(`Successfully added ${successCount} parameter(s)`, "success");
            if (configNode) {
                await fetchConfig(configNode);
                await fetchExistingParams(); // Refresh existing params
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
        if (!paramsToUnset.length) {
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
        for (const param of paramsToUnset) {
            const {section, option} = param;
            try {
                console.debug('Unsetting parameter:', {section, option});
                if (!option) {
                    throw new Error(`Parameter option is undefined`);
                }
                const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/config?unset=${encodeURIComponent(
                    section ? `${section}.${option}` : option
                )}`;
                const response = await fetch(url, {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                if (!response.ok)
                    throw new Error(`Failed to unset parameter ${option}: ${response.status}`);
                successCount++;
            } catch (err) {
                console.error('Error in handleUnsetParams:', err, {param});
                openSnackbar(`Error unsetting parameter ${param.option || 'unknown'}: ${err.message}`, "error");
            }
        }
        if (successCount > 0) {
            openSnackbar(`Successfully unset ${successCount} parameter(s)`, "success");
            if (configNode) {
                await fetchConfig(configNode);
                await fetchExistingParams(); // Refresh existing params
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
        if (!paramsToDelete.length) {
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
        for (const section of paramsToDelete) {
            try {
                const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/config?delete=${encodeURIComponent(section)}`;
                const response = await fetch(url, {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                if (!response.ok)
                    throw new Error(`Failed to delete section ${section}: ${response.status}`);
                successCount++;
            } catch (err) {
                openSnackbar(`Error deleting section ${section}: ${err.message}`, "error");
            }
        }
        if (successCount > 0) {
            openSnackbar(`Successfully deleted ${successCount} section(s)`, "success");
            if (configNode) {
                await fetchConfig(configNode);
                await fetchExistingParams(); // Refresh existing params
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
        if (paramsToSet.length) {
            const success = await handleAddParams();
            anySuccess = anySuccess || success;
        }
        if (paramsToUnset.length) {
            const success = await handleUnsetParams();
            anySuccess = anySuccess || success;
        }
        if (paramsToDelete.length) {
            const success = await handleDeleteParams();
            anySuccess = anySuccess || success;
        }
        if (!paramsToSet.length && !paramsToUnset.length && !paramsToDelete.length) {
            openSnackbar("No selection made", "error");
            return;
        }
        if (anySuccess) {
            setParamsToSet([]);
            setParamsToUnset([]);
            setParamsToDelete([]);
            setManageParamsDialogOpen(false);
        }
    };

    // Handle accordion expansion
    const handleConfigAccordionChange = (event, isExpanded) => {
        setConfigAccordionExpanded(isExpanded);
    };

    // Handle keywords dialog opening
    const handleOpenKeywordsDialog = () => {
        setKeywordsDialogOpen(true);
        fetchKeywords();
    };

    // Handle manage params dialog opening
    const handleOpenManageParamsDialog = () => {
        setManageParamsDialogOpen(true);
        fetchKeywords();
        fetchExistingParams();
    };

    // Get unique sections from keywords
    const getUniqueSections = () => {
        if (!keywordsData) return [];
        const sections = new Set(keywordsData.map(keyword => keyword.section).filter(Boolean));
        return ["", ...Array.from(sections)];
    };

    // Get unique sections from existing parameters
    const getExistingSections = () => {
        if (!existingParams) return [];
        const sections = new Set(existingParams.map(param => {
            const parts = param.keyword.split(".");
            return parts.length > 1 ? parts[0] : "";
        }).filter(Boolean));
        return Array.from(sections);
    };

    // Get existing parameters for unset
    const getExistingKeywords = () => {
        if (!existingParams) return [];
        return existingParams.map(param => {
            const parts = param.keyword.split(".");
            return {
                section: parts.length > 1 ? parts[0] : "",
                option: parts.length > 1 ? parts.slice(1).join(".") : param.keyword,
                value: param.value,
            };
        });
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
                                onClick={handleOpenManageParamsDialog}
                                disabled={actionLoading}
                                aria-label="Manage configuration parameters"
                            >
                                <EditIcon/>
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="View available configuration keywords">
                            <IconButton
                                color="primary"
                                onClick={handleOpenKeywordsDialog}
                                disabled={actionLoading}
                                aria-label="View configuration keywords"
                            >
                                <InfoIcon/>
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
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>Manage Configuration Parameters</DialogTitle>
                <DialogContent>
                    {(keywordsLoading || existingParamsLoading) && <CircularProgress size={24}/>}
                    {keywordsError && (
                        <Alert severity="error" sx={{mb: 2}}>
                            {keywordsError}
                        </Alert>
                    )}
                    {existingParamsError && (
                        <Alert severity="error" sx={{mb: 2}}>
                            {existingParamsError}
                        </Alert>
                    )}
                    <Typography variant="subtitle1" gutterBottom>
                        Add parameters
                    </Typography>
                    <Autocomplete
                        multiple
                        options={keywordsData || []}
                        value={paramsToSet.map(p => keywordsData?.find(k => k.option === p.option) || p)}
                        getOptionLabel={(option) => `${option.section ? `${option.section}.` : ''}${option.option}`}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Select parameters to set"
                                placeholder="Select parameters"
                                helperText="Select a parameter and enter its value below"
                                InputLabelProps={{'aria-label': 'Select parameters to set'}}
                            />
                        )}
                        onChange={(event, newValue) => {
                            // Preserve existing paramsToSet values
                            const newParams = [];
                            const seen = new Set();
                            const existingParamsMap = new Map(
                                paramsToSet.map(p => [p.option, p])
                            );

                            newValue.forEach((param, index) => {
                                const key = param.option;
                                if (!seen.has(key)) {
                                    seen.add(key);
                                    const existingParam = existingParamsMap.get(key);
                                    const isIndexed = !!param.section && param.section !== "DEFAULT";
                                    const prefix = isIndexed ? param.section : undefined;
                                    const section = isIndexed ? "" : (param.section === "DEFAULT" ? "DEFAULT" : param.section || "");
                                    newParams.push({
                                        section,
                                        option: param.option,
                                        value: existingParam ? existingParam.value : "",
                                        id: existingParam ? existingParam.id : `${key}-${index}`,
                                        isIndexed,
                                        prefix,
                                    });
                                }
                            });

                            setParamsToSet(newParams);
                        }}
                        disabled={actionLoading || keywordsLoading}
                        sx={{mb: 2}}
                    />
                    {paramsToSet.length > 0 && (
                        <Grid container spacing={2} sx={{mb: 2}}>
                            <Grid item xs={12}>
                                <Grid container spacing={2} alignItems="center">
                                    <Grid item xs={2.5}>
                                        <Typography variant="body2" fontWeight="bold">Section</Typography>
                                    </Grid>
                                    <Grid item xs={3}>
                                        <Typography variant="body2" fontWeight="bold">Parameter</Typography>
                                    </Grid>
                                    <Grid item xs={2.5}>
                                        <Typography variant="body2" fontWeight="bold">Value</Typography>
                                    </Grid>
                                    <Grid item xs={4}>
                                        <Typography variant="body2" fontWeight="bold">Description</Typography>
                                    </Grid>
                                </Grid>
                            </Grid>
                            {paramsToSet.map((param, index) => {
                                const keyword = keywordsData?.find(k => k.option === param.option);
                                return (
                                    <Grid item xs={12} key={param.id}>
                                        <Grid container spacing={2} alignItems="center">
                                            <Grid item xs={2.5}>
                                                {param.isIndexed ? (
                                                    <TextField
                                                        fullWidth
                                                        label="Index"
                                                        value={param.section}
                                                        onChange={(e) => {
                                                            const newParams = [...paramsToSet];
                                                            newParams[index].section = e.target.value;
                                                            setParamsToSet(newParams);
                                                        }}
                                                        disabled={actionLoading}
                                                        size="small"
                                                        placeholder="e.g. 1"
                                                        type="number"
                                                        inputProps={{min: 0, step: 1}}
                                                        InputLabelProps={{'aria-label': 'Index'}}
                                                    />
                                                ) : param.section === "DEFAULT" ? (
                                                    <Typography>DEFAULT</Typography>
                                                ) : (
                                                    <TextField
                                                        fullWidth
                                                        label="Section"
                                                        value={param.section}
                                                        onChange={(e) => {
                                                            const newParams = [...paramsToSet];
                                                            newParams[index].section = e.target.value;
                                                            setParamsToSet(newParams);
                                                        }}
                                                        disabled={actionLoading}
                                                        size="small"
                                                        placeholder="e.g., fs#1, ip#1"
                                                        InputLabelProps={{'aria-label': 'Section'}}
                                                    />
                                                )}
                                            </Grid>
                                            <Grid item xs={3}>
                                                <Tooltip title={keyword?.text || ""}>
                                                    <Typography sx={{
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap"
                                                    }}>
                                                        {param.option}
                                                    </Typography>
                                                </Tooltip>
                                            </Grid>
                                            <Grid item xs={2.5}>
                                                <TextField
                                                    fullWidth
                                                    label="Value"
                                                    value={param.value}
                                                    onChange={(e) => {
                                                        const newParams = [...paramsToSet];
                                                        newParams[index].value = e.target.value;
                                                        setParamsToSet(newParams);
                                                    }}
                                                    disabled={actionLoading}
                                                    size="small"
                                                    InputLabelProps={{'aria-label': 'Value'}}
                                                />
                                            </Grid>
                                            <Grid item xs={4}>
                                                <Typography
                                                    variant="caption"
                                                    color="textSecondary"
                                                    sx={{
                                                        whiteSpace: "normal",
                                                        maxHeight: "60px",
                                                        overflowY: "auto",
                                                        display: "block",
                                                    }}
                                                    title={keyword?.text || ""}
                                                >
                                                    {keyword?.text || "N/A"}
                                                </Typography>
                                            </Grid>
                                        </Grid>
                                    </Grid>
                                );
                            })}
                        </Grid>
                    )}
                    <Typography variant="subtitle1" gutterBottom sx={{mt: 2}}>
                        Unset parameters
                    </Typography>
                    <Autocomplete
                        multiple
                        options={getExistingKeywords()}
                        value={paramsToUnset}
                        getOptionLabel={(option) => `${option.section ? `${option.section}.` : ''}${option.option}`}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Select parameters to unset"
                                placeholder="Select parameters"
                                helperText="Select existing parameters to remove their values"
                                InputLabelProps={{'aria-label': 'Select parameters to unset'}}
                            />
                        )}
                        onChange={(event, newValue) => {
                            console.debug('Unset params onChange:', newValue); // Debug log
                            // Ensure newValue contains objects with section and option
                            const formattedParams = newValue.map((item, index) => {
                                if (typeof item === 'string') {
                                    // Handle case where item is a string (from test input)
                                    const parts = item.split('.');
                                    return {
                                        section: parts.length > 1 ? parts[0] : '',
                                        option: parts.length > 1 ? parts.slice(1).join('.') : item,
                                        id: `unset-${item}-${index}`, // Unique ID for React key
                                    };
                                }
                                return {...item, id: `unset-${item.option}-${index}`};
                            });
                            setParamsToUnset(formattedParams);
                        }}
                        disabled={actionLoading || existingParamsLoading}
                        sx={{mb: 2}}
                    />
                    <Typography variant="subtitle1" gutterBottom sx={{mt: 2}}>
                        Delete sections
                    </Typography>
                    <Autocomplete
                        multiple
                        options={getExistingSections()}
                        value={paramsToDelete}
                        getOptionLabel={(option) => option}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Select sections to delete"
                                placeholder="Select sections"
                                helperText="Select existing sections to delete"
                                InputLabelProps={{'aria-label': 'Select sections to delete'}}
                            />
                        )}
                        onChange={(event, newValue) => setParamsToDelete(newValue)}
                        disabled={actionLoading || existingParamsLoading}
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
                        disabled={actionLoading}
                    >
                        Apply
                    </Button>
                </DialogActions>
            </Dialog>

            {/* KEYWORDS DIALOG */}
            <Dialog
                open={keywordsDialogOpen}
                onClose={() => setKeywordsDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>Configuration Keywords</DialogTitle>
                <DialogContent>
                    {keywordsLoading && <CircularProgress size={24}/>}
                    {keywordsError && (
                        <Alert severity="error" sx={{mb: 2}}>
                            {keywordsError}
                        </Alert>
                    )}
                    {!keywordsLoading && !keywordsError && keywordsData === null && (
                        <Typography color="textSecondary">No keywords available.</Typography>
                    )}
                    {!keywordsLoading && !keywordsError && keywordsData !== null && (
                        <TableContainer component={Paper}>
                            <Table aria-label="configuration keywords table">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Keyword</TableCell>
                                        <TableCell>Description</TableCell>
                                        <TableCell>Default</TableCell>
                                        <TableCell>Type</TableCell>
                                        <TableCell>Section</TableCell>
                                        <TableCell>Scopable</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {keywordsData.map((keyword, index) => (
                                        <TableRow key={`${keyword.section || 'default'}.${keyword.option}-${index}`}>
                                            <TableCell>{keyword.option}</TableCell>
                                            <TableCell>{keyword.text || "N/A"}</TableCell>
                                            <TableCell>{keyword.default || "None"}</TableCell>
                                            <TableCell>{keyword.converter || "N/A"}</TableCell>
                                            <TableCell>{keyword.section || "N/A"}</TableCell>
                                            <TableCell>{keyword.scopable ? "Yes" : "No"}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setKeywordsDialogOpen(false)}
                        disabled={keywordsLoading}
                    >
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ConfigSection;
