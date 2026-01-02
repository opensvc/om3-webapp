import React, {useState, useEffect, useCallback} from "react";
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
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import {URL_OBJECT} from "../config/apiPath.js";
import logger from '../utils/logger.js';

const KeysSection = ({decodedObjectName, openSnackbar}) => {
    // State for keys
    const [keys, setKeys] = useState([]);
    const [keysLoading, setKeysLoading] = useState(false);
    const [keysError, setKeysError] = useState(null);
    const [keysAccordionExpanded, setKeysAccordionExpanded] = useState(true);

    // State for key actions
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
    const [keyToDelete, setKeyToDelete] = useState(null);
    const [updateKeyName, setUpdateKeyName] = useState("");
    const [newKeyName, setNewKeyName] = useState("");
    const [newKeyFile, setNewKeyFile] = useState(null);
    const [updateKeyFile, setUpdateKeyFile] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

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

    // Fetch keys for cfg or sec objects
    const fetchKeys = useCallback(async () => {
        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        if (!["cfg", "sec"].includes(kind)) {
            setKeys([]);
            return;
        }

        const token = localStorage.getItem("authToken");
        if (!token) {
            setKeysError("Auth token not found.");
            logger.error("❌ [fetchKeys] No auth token for:", decodedObjectName);
            return;
        }

        setKeysLoading(true);
        setKeysError(null);
        try {
            const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/data/keys`;
            const response = await fetch(url, {
                headers: {Authorization: `Bearer ${token}`},
                cache: "no-cache",
            });
            if (!response.ok) {
                setKeysError(`Failed to fetch keys: ${response.status}`);
                return;
            }
            const data = await response.json();
            setKeys(data.items || []);
        } catch (err) {
            logger.error(`💥 [fetchKeys] Error: ${err.message}`);
            setKeysError(err.message);
        } finally {
            setKeysLoading(false);
        }
    }, [decodedObjectName]);

    // Delete key
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
            const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/data/key?name=${encodeURIComponent(keyToDelete)}`;
            const response = await fetch(url, {
                method: "DELETE",
                headers: {Authorization: `Bearer ${token}`},
            });
            if (!response.ok) {
                openSnackbar(`Failed to delete key: ${response.status}`, "error");
                return;
            }
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

    // Create key
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
            const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/data/key?name=${encodeURIComponent(newKeyName)}`;
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/octet-stream",
                },
                body: newKeyFile,
            });
            if (!response.ok) {
                openSnackbar(`Failed to create key: ${response.status}`, "error");
                return;
            }
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

    // Update key
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
            const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/data/key?name=${encodeURIComponent(updateKeyName)}`;
            const response = await fetch(url, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/octet-stream",
                },
                body: updateKeyFile,
            });
            if (!response.ok) {
                openSnackbar(`Failed to update key: ${response.status}`, "error");
                return;
            }
            openSnackbar(`Key '${updateKeyName}' updated successfully`);
            await fetchKeys();
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
        } finally {
            setActionLoading(false);
            setUpdateDialogOpen(false);
            setUpdateKeyName("");
            setUpdateKeyFile(null);
        }
    };

    // Handle accordion expansion
    const handleKeysAccordionChange = (event, isExpanded) => {
        setKeysAccordionExpanded(isExpanded);
    };

    // Open update dialog for a specific key
    const handleOpenUpdateDialog = (keyName) => {
        setUpdateKeyName(keyName);
        setUpdateDialogOpen(true);
    };

    // Initial load effect
    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            fetchKeys();
        }
    }, [decodedObjectName, fetchKeys]);

    // Check if keys section should be displayed
    const {kind} = parseObjectPath(decodedObjectName);
    const showKeys = ["cfg", "sec"].includes(kind);

    if (!showKeys) {
        return null;
    }

    return (
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
                        <Tooltip title="Add new key">
                            <IconButton
                                color="primary"
                                onClick={() => setCreateDialogOpen(true)}
                                disabled={actionLoading}
                                aria-label="Add new key"
                            >
                                <AddIcon/>
                            </IconButton>
                        </Tooltip>
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
                                                <Tooltip title="Edit">
                                                    <span>
                                                        <IconButton
                                                            onClick={() => handleOpenUpdateDialog(key.name)}
                                                            disabled={actionLoading}
                                                            aria-label={`Edit key ${key.name}`}
                                                        >
                                                            <EditIcon/>
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                                <Tooltip title="Delete">
                                                    <span>
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
                                                    </span>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </AccordionDetails>
            </Accordion>

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
        </Box>
    );
};

export default KeysSection;
