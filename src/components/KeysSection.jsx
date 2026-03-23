import React, {useState, useEffect, useCallback} from "react";
import {
    Box,
    Typography,
    Tooltip,
    IconButton,
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
    FormControl,
    FormLabel,
    RadioGroup,
    FormControlLabel,
    Radio,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import {URL_OBJECT} from "../config/apiPath.js";
import logger from '../utils/logger.js';
import {parseObjectPath} from '../utils/objectUtils';

const KeysSection = ({decodedObjectName, openSnackbar}) => {
    // State for keys
    const [keys, setKeys] = useState([]);
    const [keysLoading, setKeysLoading] = useState(false);
    const [keysError, setKeysError] = useState(null);

    // State for key actions
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
    const [viewDialogOpen, setViewDialogOpen] = useState(false);
    const [keyToDelete, setKeyToDelete] = useState(null);
    const [keyToView, setKeyToView] = useState(null);
    const [keyViewContent, setKeyViewContent] = useState(null);
    const [keyViewLoading, setKeyViewLoading] = useState(false);
    const [updateKeyName, setUpdateKeyName] = useState("");
    const [newKeyName, setNewKeyName] = useState("");
    const [newKeyFile, setNewKeyFile] = useState(null);
    const [updateKeyFile, setUpdateKeyFile] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    // States for input mode and content
    const [createInputMode, setCreateInputMode] = useState("empty"); // "empty", "file", "text"
    const [updateInputMode, setUpdateInputMode] = useState("file"); // "file", "text"
    const [newKeyText, setNewKeyText] = useState("");
    const [updateKeyText, setUpdateKeyText] = useState("");
    const [updateContentLoading, setUpdateContentLoading] = useState(false);

    // Fullscreen states for textarea only (not the whole dialog)
    const [createTextFullscreen, setCreateTextFullscreen] = useState(false);
    const [updateTextFullscreen, setUpdateTextFullscreen] = useState(false);

    // Fetch keys
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

    // Fetch key content
    const fetchKeyContent = useCallback(async (keyName) => {
        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken");
        if (!token) {
            openSnackbar("Auth token not found.", "error");
            return {type: 'error', content: null};
        }

        try {
            const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/data/key?name=${encodeURIComponent(keyName)}`;
            const response = await fetch(url, {
                headers: {Authorization: `Bearer ${token}`},
            });
            if (!response.ok) {
                openSnackbar(`Failed to fetch key content: ${response.status}`, "error");
                return {type: 'error', content: null};
            }

            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // Try to decode as text
            let isText = true;
            let textContent = "";
            try {
                textContent = new TextDecoder('utf-8', {fatal: true}).decode(uint8Array);
                for (let i = 0; i < textContent.length; i++) {
                    const code = textContent.charCodeAt(i);
                    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
                        isText = false;
                        break;
                    }
                }
            } catch (e) {
                isText = false;
            }

            if (isText && textContent.length > 0) {
                return {type: "text", content: textContent};
            } else {
                const hexLines = [];
                for (let i = 0; i < uint8Array.length; i += 16) {
                    const chunk = uint8Array.slice(i, i + 16);
                    const hex = Array.from(chunk)
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join(' ');
                    const ascii = Array.from(chunk)
                        .map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.')
                        .join('');
                    hexLines.push(`${i.toString(16).padStart(8, '0')}  ${hex.padEnd(48, ' ')}  ${ascii}`);
                }
                return {type: "binary", content: hexLines.join('\n')};
            }
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
            return {type: 'error', content: null};
        }
    }, [decodedObjectName, openSnackbar]);

    // View key
    const handleViewKey = async (keyName) => {
        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken");
        if (!token) {
            openSnackbar("Auth token not found.", "error");
            return;
        }

        setKeyToView(keyName);
        setKeyViewLoading(true);
        setViewDialogOpen(true);
        setKeyViewContent(null);

        try {
            const url = `${URL_OBJECT}/${namespace}/${kind}/${name}/data/key?name=${encodeURIComponent(keyName)}`;
            const response = await fetch(url, {
                headers: {Authorization: `Bearer ${token}`},
            });
            if (!response.ok) {
                openSnackbar(`Failed to fetch key content: ${response.status}`, "error");
                setViewDialogOpen(false);
                return;
            }

            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            let isText = true;
            let textContent = "";
            try {
                textContent = new TextDecoder('utf-8', {fatal: true}).decode(uint8Array);
                for (let i = 0; i < textContent.length; i++) {
                    const code = textContent.charCodeAt(i);
                    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
                        isText = false;
                        break;
                    }
                }
            } catch (e) {
                isText = false;
            }

            if (isText && textContent.length > 0) {
                setKeyViewContent({type: "text", content: textContent});
            } else {
                const hexLines = [];
                for (let i = 0; i < uint8Array.length; i += 16) {
                    const chunk = uint8Array.slice(i, i + 16);
                    const hex = Array.from(chunk)
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join(' ');
                    const ascii = Array.from(chunk)
                        .map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.')
                        .join('');
                    hexLines.push(`${i.toString(16).padStart(8, '0')}  ${hex.padEnd(48, ' ')}  ${ascii}`);
                }
                setKeyViewContent({type: "binary", content: hexLines.join('\n')});
            }
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
            setViewDialogOpen(false);
        } finally {
            setKeyViewLoading(false);
        }
    };

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
        if (!newKeyName) {
            openSnackbar("Key name is required.", "error");
            return;
        }

        if (createInputMode === "file" && !newKeyFile) {
            openSnackbar("Please select a file.", "error");
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

            let body;
            if (createInputMode === "empty") {
                body = new Blob([], {type: "application/octet-stream"});
            } else if (createInputMode === "text") {
                body = new Blob([newKeyText], {type: "application/octet-stream"});
            } else {
                body = newKeyFile;
            }

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/octet-stream",
                },

                body: body,
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
            setNewKeyText("");
            setCreateInputMode("empty");
            setCreateTextFullscreen(false);
        }
    };

    // Update key
    const handleUpdateKey = async () => {
        if (!updateKeyName) {
            openSnackbar("Key name is required.", "error");
            return;
        }

        if (updateInputMode === "file" && !updateKeyFile) {
            openSnackbar("Please select a file.", "error");
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

            let body;
            if (updateInputMode === "text") {
                body = new Blob([updateKeyText], {type: "application/octet-stream"});
            } else {
                body = updateKeyFile;
            }

            const response = await fetch(url, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/octet-stream",
                },
                body: body,
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
            setUpdateKeyText("");
            setUpdateInputMode("file");
            setUpdateTextFullscreen(false);
        }
    };

    // Open update dialog with pre-filled content
    const handleOpenUpdateDialog = async (keyName) => {
        setUpdateKeyName(keyName);
        setUpdateDialogOpen(true);
        setUpdateContentLoading(true);
        setUpdateKeyText("");
        setUpdateKeyFile(null);
        setUpdateInputMode("file");
        setUpdateTextFullscreen(false);

        const result = await fetchKeyContent(keyName);
        if (result.type === "text") {
            setUpdateKeyText(result.content);
            setUpdateInputMode("text");
        } else if (result.type === "binary") {
            openSnackbar("Key is binary – please use file upload to update.", "info");
        }

        setUpdateContentLoading(false);
    };

    // Initial load
    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            fetchKeys().catch((error) => {
                logger.error("Error in fetchKeys:", error);
            });
        }
    }, [decodedObjectName, fetchKeys]);

    const {kind} = parseObjectPath(decodedObjectName);
    const showKeys = ["cfg", "sec"].includes(kind);

    if (!showKeys) {
        return null;
    }

    const hasKeysError = Boolean(keysError);
    const safeKeys = Array.isArray(keys) ? keys : [];

    return (
        <Box sx={{mb: 4}}>
            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
                <Typography variant="h6" fontWeight="medium">
                    Object Keys ({safeKeys.length})
                </Typography>
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
            {hasKeysError && (
                <Alert severity="error" sx={{mb: 2}}>
                    {String(keysError)}
                </Alert>
            )}
            {!keysLoading && !hasKeysError && safeKeys.length === 0 && (
                <Typography color="textSecondary">No keys available.</Typography>
            )}
            {!keysLoading && !hasKeysError && safeKeys.length > 0 && (
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
                            {safeKeys.map((key) => (
                                <TableRow key={key.name}>
                                    <TableCell component="th" scope="row">
                                        {key.name}
                                    </TableCell>
                                    <TableCell>{key.node}</TableCell>
                                    <TableCell>{key.size} bytes</TableCell>
                                    <TableCell>
                                        <Tooltip title="View">
                                            <span>
                                                <IconButton
                                                    onClick={() => handleViewKey(key.name)}
                                                    disabled={actionLoading}
                                                    aria-label={`View key ${key.name}`}
                                                >
                                                    <VisibilityIcon/>
                                                </IconButton>
                                            </span>
                                        </Tooltip>
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

            {/* VIEW KEY DIALOG */}
            <Dialog
                open={viewDialogOpen}
                onClose={() => setViewDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>View Key: {keyToView}</DialogTitle>
                <DialogContent>
                    {keyViewLoading && (
                        <Box sx={{display: 'flex', justifyContent: 'center', p: 3}}>
                            <CircularProgress/>
                        </Box>
                    )}
                    {!keyViewLoading && keyViewContent && (
                        <Box>
                            <Typography variant="caption" color="textSecondary" sx={{mb: 1}}>
                                Type: {keyViewContent.type === "text" ? "Text" : "Binary (Hex View)"}
                            </Typography>
                            <TextField
                                multiline
                                fullWidth
                                variant="outlined"
                                value={keyViewContent.content}
                                InputProps={{
                                    readOnly: true,
                                    sx: {
                                        fontFamily: 'monospace',
                                        fontSize: '0.875rem',
                                    }
                                }}
                                minRows={10}
                                maxRows={20}
                                sx={{mt: 1}}
                            />
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>

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
                onClose={() => {
                    setCreateDialogOpen(false);
                    setCreateTextFullscreen(false);
                }}
                maxWidth={createTextFullscreen ? false : "md"}
                fullScreen={createTextFullscreen}
                fullWidth={!createTextFullscreen}
            >
                <DialogTitle>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Typography variant="h6">Create New Key</Typography>
                        {createTextFullscreen && (
                            <IconButton
                                edge="end"
                                onClick={() => setCreateTextFullscreen(false)}
                                aria-label="Exit full screen"
                            >
                                <FullscreenExitIcon/>
                            </IconButton>
                        )}
                    </Box>
                </DialogTitle>
                <DialogContent>
                    {!createTextFullscreen && (
                        <>
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
                            <FormControl component="fieldset" sx={{mt: 2, width: '100%'}}>
                                <FormLabel component="legend">Input Mode</FormLabel>
                                <RadioGroup
                                    value={createInputMode}
                                    onChange={(e) => setCreateInputMode(e.target.value)}
                                >
                                    <FormControlLabel
                                        value="empty"
                                        control={<Radio/>}
                                        label="Empty key (no content)"
                                        disabled={actionLoading}
                                    />
                                    <FormControlLabel
                                        value="file"
                                        control={<Radio/>}
                                        label="Upload from file"
                                        disabled={actionLoading}
                                    />
                                    <Box display="flex" alignItems="center">
                                        <FormControlLabel
                                            value="text"
                                            control={<Radio/>}
                                            label="Enter text directly"
                                            disabled={actionLoading}
                                        />
                                        {createInputMode === "text" && !createTextFullscreen && (
                                            <Tooltip title="Full screen">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => setCreateTextFullscreen(true)}
                                                    sx={{ml: 1}}
                                                >
                                                    <FullscreenIcon/>
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </Box>
                                </RadioGroup>
                            </FormControl>
                        </>
                    )}

                    {createInputMode === "file" && !createTextFullscreen && (
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
                    )}

                    {createInputMode === "text" && (
                        <Box
                            sx={{
                                mt: createTextFullscreen ? 0 : 2,
                                height: createTextFullscreen ? 'calc(100vh - 180px)' : 'auto',
                                width: '100%',
                            }}
                        >
                            <TextField
                                multiline
                                fullWidth
                                variant="outlined"
                                label={createTextFullscreen ? undefined : "Key Content"}
                                value={newKeyText}
                                onChange={(e) => setNewKeyText(e.target.value)}
                                disabled={actionLoading}
                                minRows={createTextFullscreen ? 20 : 8}
                                maxRows={createTextFullscreen ? 40 : 20}
                                placeholder="Enter the text content for this key..."
                                sx={{
                                    height: createTextFullscreen ? '100%' : 'auto',
                                    '& .MuiInputBase-root': {
                                        height: createTextFullscreen ? '100%' : 'auto',
                                    },
                                    '& .MuiInputBase-input': {
                                        resize: 'vertical',
                                        height: createTextFullscreen ? '100% !important' : 'auto',
                                    }
                                }}
                            />
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => {
                        setCreateDialogOpen(false);
                        setCreateTextFullscreen(false);
                    }} disabled={actionLoading}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleCreateKey}
                        disabled={actionLoading || !newKeyName || (createInputMode === "file" && !newKeyFile)}
                    >
                        Create
                    </Button>
                </DialogActions>
            </Dialog>

            {/* UPDATE KEY DIALOG */}
            <Dialog
                open={updateDialogOpen}
                onClose={() => {
                    setUpdateDialogOpen(false);
                    setUpdateTextFullscreen(false);
                }}
                maxWidth={updateTextFullscreen ? false : "md"}
                fullScreen={updateTextFullscreen}
                fullWidth={!updateTextFullscreen}
            >
                <DialogTitle>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Typography variant="h6">Update Key</Typography>
                        {updateTextFullscreen && (
                            <IconButton
                                edge="end"
                                onClick={() => setUpdateTextFullscreen(false)}
                                aria-label="Exit full screen"
                            >
                                <FullscreenExitIcon/>
                            </IconButton>
                        )}
                    </Box>
                </DialogTitle>
                <DialogContent>
                    {updateContentLoading ? (
                        <Box sx={{display: 'flex', justifyContent: 'center', p: 3}}>
                            <CircularProgress/>
                        </Box>
                    ) : (
                        <>
                            {!updateTextFullscreen && (
                                <>
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
                                    <FormControl component="fieldset" sx={{mt: 2, width: '100%'}}>
                                        <FormLabel component="legend">Input Mode</FormLabel>
                                        <RadioGroup
                                            value={updateInputMode}
                                            onChange={(e) => setUpdateInputMode(e.target.value)}
                                        >
                                            <FormControlLabel
                                                value="file"
                                                control={<Radio/>}
                                                label="Upload from file"
                                                disabled={actionLoading}
                                            />
                                            <Box display="flex" alignItems="center">
                                                <FormControlLabel
                                                    value="text"
                                                    control={<Radio/>}
                                                    label="Enter text directly"
                                                    disabled={actionLoading}
                                                />
                                                {updateInputMode === "text" && !updateTextFullscreen && (
                                                    <Tooltip title="Full screen">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => setUpdateTextFullscreen(true)}
                                                            sx={{ml: 1}}
                                                        >
                                                            <FullscreenIcon/>
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </Box>
                                        </RadioGroup>
                                    </FormControl>
                                </>
                            )}

                            {updateInputMode === "file" && !updateTextFullscreen && (
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
                            )}

                            {updateInputMode === "text" && (
                                <Box
                                    sx={{
                                        mt: updateTextFullscreen ? 0 : 2,
                                        height: updateTextFullscreen ? 'calc(100vh - 180px)' : 'auto',
                                        width: '100%',
                                    }}
                                >
                                    <TextField
                                        multiline
                                        fullWidth
                                        variant="outlined"
                                        label={updateTextFullscreen ? undefined : "Key Content"}
                                        value={updateKeyText}
                                        onChange={(e) => setUpdateKeyText(e.target.value)}
                                        disabled={actionLoading}
                                        minRows={updateTextFullscreen ? 20 : 8}
                                        maxRows={updateTextFullscreen ? 40 : 20}
                                        placeholder="Enter the text content for this key..."
                                        sx={{
                                            height: updateTextFullscreen ? '100%' : 'auto',
                                            '& .MuiInputBase-root': {
                                                height: updateTextFullscreen ? '100%' : 'auto',
                                            },
                                            '& .MuiInputBase-input': {
                                                resize: 'vertical',
                                                height: updateTextFullscreen ? '100% !important' : 'auto',
                                            }
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => {
                        setUpdateDialogOpen(false);
                        setUpdateTextFullscreen(false);
                    }} disabled={actionLoading}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleUpdateKey}
                        disabled={
                            actionLoading ||
                            updateContentLoading ||
                            !updateKeyName ||
                            (updateInputMode === "file" && !updateKeyFile)
                        }
                    >
                        Update
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default KeysSection;
