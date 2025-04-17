import React, {useState} from "react";
import {useParams} from "react-router-dom";
import {
    Box, Paper, Typography, Tooltip, Divider, Snackbar, Alert,
    Menu, MenuItem, IconButton, Dialog, DialogTitle,
    DialogContent, DialogActions, FormControlLabel, Checkbox,
    Button, Table, TableBody, TableCell, TableHead,
    TableRow, TableContainer
} from "@mui/material";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import {green, red, grey, blue} from "@mui/material/colors";
import useEventStore from "../store/useEventStore";

const NODE_ACTIONS = ["start", "stop", "restart", "freeze", "unfreeze"];
const OBJECT_ACTIONS = ["restart", "freeze", "unfreeze"];
const RESOURCE_ACTIONS = ["start", "restart", "stop", "provision", "unprovision"];

const ObjectDetail = () => {
    const {objectName} = useParams();
    const decodedObjectName = decodeURIComponent(objectName);

    const objectStatus = useEventStore((state) => state.objectStatus);
    const objectInstanceStatus = useEventStore((state) => state.objectInstanceStatus);

    const objectData = objectInstanceStatus?.[decodedObjectName];
    const globalStatus = objectStatus?.[decodedObjectName];

    const [snackbar, setSnackbar] = useState({open: false, message: "", severity: "success"});
    const [menuAnchor, setMenuAnchor] = useState(null);
    const [objectMenuAnchor, setObjectMenuAnchor] = useState(null);
    const [resourceMenuAnchor, setResourceMenuAnchor] = useState(null);

    const [selectedNode, setSelectedNode] = useState(null);
    const [pendingResource, setPendingResource] = useState({node: null, rid: null});

    const [actionInProgress, setActionInProgress] = useState(false);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [stopDialogOpen, setStopDialogOpen] = useState(false);
    const [simpleDialogOpen, setSimpleDialogOpen] = useState(false);
    const [resourceDialogOpen, setResourceDialogOpen] = useState(false);

    const [checkboxes, setCheckboxes] = useState({failover: false});
    const [stopCheckbox, setStopCheckbox] = useState(false);
    const [resourceConfirmChecked, setResourceConfirmChecked] = useState(false);

    const [pendingAction, setPendingAction] = useState(null);

    const openSnackbar = (message, severity = "success") => setSnackbar({open: true, message, severity});
    const closeSnackbar = () => setSnackbar({...snackbar, open: false});

    const parseObjectPath = (objName) => {
        const parts = objName.split("/");
        if (parts.length === 3) {
            return {namespace: parts[0], kind: parts[1], name: parts[2]};
        }
        return {namespace: "root", kind: "svc", name: objName};
    };

    const postNodeAction = async ({node, action}) => {
        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken");
        if (!token) return openSnackbar("Auth token not found.", "error");

        setActionInProgress(true);
        openSnackbar(`Executing ${action} on node ${node}...`, "info");
        const url = `/node/name/${node}/instance/path/${namespace}/${kind}/${name}/action/${action}`;
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
            });
            if (!res.ok) throw new Error(`Failed to ${action} on ${node}`);
            openSnackbar(`'${action}' succeeded on node '${node}'`);
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
        } finally {
            setActionInProgress(false);
        }
    };

    const postObjectAction = async ({action}) => {
        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken");
        if (!token) return openSnackbar("Auth token not found.", "error");

        setActionInProgress(true);
        openSnackbar(`Executing ${action} on object...`, "info");
        const url = `/object/path/${namespace}/${kind}/${name}/action/${action}`;
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
            });
            if (!res.ok) throw new Error(`Failed to ${action} object`);
            openSnackbar(`'${action}' succeeded on object`);
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
        } finally {
            setActionInProgress(false);
        }
    };

    const postResourceAction = async ({node, action, rid}) => {
        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken");
        if (!token) return openSnackbar("Auth token not found.", "error");

        setActionInProgress(true);
        openSnackbar(`Executing ${action} on resource ${rid}...`, "info");
        const url =
            `/node/name/${node}/instance/path/${namespace}/${kind}/${name}/action/${action}` +
            `?rid=${encodeURIComponent(rid)}`;
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
            });
            if (!res.ok) throw new Error(`Failed to ${action} resource ${rid}`);
            openSnackbar(`'${action}' succeeded on resource '${rid}'`);
        } catch (err) {
            openSnackbar(`Error: ${err.message}`, "error");
        } finally {
            setActionInProgress(false);
        }
    };

    const getColor = (status) => {
        if (status === "up" || status === true) return green[500];
        if (status === "down" || status === false) return red[500];
        return grey[500];
    };

    const handleMenuOpen = (e, node) => {
        setSelectedNode(node);
        setMenuAnchor(e.currentTarget);
    };
    const handleMenuClose = () => setMenuAnchor(null);

    const handleObjectMenuOpen = (e) => setObjectMenuAnchor(e.currentTarget);
    const handleObjectMenuClose = () => setObjectMenuAnchor(null);

    const handleResourceMenuOpen = (e, node, rid) => {
        setPendingResource({node, rid});
        setResourceMenuAnchor(e.currentTarget);
    };
    const handleResourceMenuClose = () => setResourceMenuAnchor(null);

    const handleObjectActionClick = (action) => {
        setPendingAction({action, node: decodedObjectName, isNodeAction: false});
        action === "freeze" ? setConfirmDialogOpen(true)
            : action === "unfreeze"
                ? setSimpleDialogOpen(true)
                : setSimpleDialogOpen(true);
        handleObjectMenuClose();
    };

    const handleNodeActionClick = (action) => {
        setPendingAction({action, node: selectedNode, isNodeAction: true});
        action === "freeze" ? setConfirmDialogOpen(true)
            : action === "stop"
                ? setStopDialogOpen(true)
                : setSimpleDialogOpen(true);
        handleMenuClose();
    };

    const handleResourceActionClick = (action) => {
        setPendingAction({
            action,
            node: pendingResource.node,
            rid: pendingResource.rid,
            isResourceAction: true,
        });
        action === "unprovision"
            ? setResourceConfirmChecked(false) || setResourceDialogOpen(true)
            : setSimpleDialogOpen(true);
        handleResourceMenuClose();
    };

    const handleDialogConfirm = () => {
        if (!pendingAction) return;
        const {action, node, isNodeAction, isResourceAction, rid} = pendingAction;

        if (isResourceAction) {
            postResourceAction({node, action, rid});
        } else if (isNodeAction) {
            postNodeAction({node, action});
        } else {
            postObjectAction({action});
        }

        setPendingAction(null);
        setCheckboxes({failover: false});
        setStopCheckbox(false);
        setResourceConfirmChecked(false);
        setConfirmDialogOpen(false);
        setStopDialogOpen(false);
        setSimpleDialogOpen(false);
        setResourceDialogOpen(false);
    };

    if (!objectData) {
        return (
            <Box p={4}>
                <Typography align="center" color="textSecondary" fontSize="1.2rem">
                    No information available for object <code>{decodedObjectName}</code>.
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{display: "flex", justifyContent: "center", px: 2, py: 4}}>
            <Box sx={{width: "100%", maxWidth: "1400px"}}>
                {/* Header */}
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h4" fontWeight="bold">
                        {decodedObjectName}
                    </Typography>
                    <IconButton onClick={handleObjectMenuOpen}>
                        <MoreVertIcon/>
                    </IconButton>
                </Box>
                <Menu
                    anchorEl={objectMenuAnchor}
                    open={Boolean(objectMenuAnchor)}
                    onClose={handleObjectMenuClose}
                >
                    {OBJECT_ACTIONS.map((action) => (
                        <MenuItem
                            key={action}
                            onClick={() => handleObjectActionClick(action)}
                            disabled={actionInProgress}
                        >
                            {action}
                        </MenuItem>
                    ))}
                </Menu>

                {/* Global Status */}
                {globalStatus && (
                    <Paper elevation={2} sx={{p: 3, borderRadius: 3, mb: 4, backgroundColor: "#f9fafb"}}>
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                            <Typography variant="h6" fontWeight="medium" fontSize="1.3rem">
                                Global Status
                            </Typography>
                            <Box display="flex" alignItems="center" gap={2}>
                                <FiberManualRecordIcon sx={{color: getColor(globalStatus.avail), fontSize: "1.3rem"}}/>
                                {globalStatus.frozen === "frozen" && (
                                    <Tooltip title="Frozen">
                                        <AcUnitIcon fontSize="medium" sx={{color: blue[300]}}/>
                                    </Tooltip>
                                )}
                            </Box>
                        </Box>
                    </Paper>
                )}

                {/* Nodes */}
                {Object.entries(objectData).map(([node, objectState]) => {
                    if (!objectState) return null;
                    const {avail, frozen_at, resources = {}} = objectState;
                    const isFrozen = frozen_at && frozen_at !== "0001-01-01T00:00:00Z";

                    return (
                        <Paper key={node} elevation={3} sx={{p: 3, mb: 5, borderRadius: 3}}>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                <Typography variant="h6">Node: {node}</Typography>
                                <Box display="flex" alignItems="center" gap={2}>
                                    <FiberManualRecordIcon sx={{color: getColor(avail), fontSize: "1.2rem"}}/>
                                    {isFrozen && (
                                        <Tooltip title="Frozen">
                                            <AcUnitIcon fontSize="medium" sx={{color: blue[300]}}/>
                                        </Tooltip>
                                    )}
                                    <IconButton
                                        onClick={(e) => handleMenuOpen(e, node)}
                                        disabled={actionInProgress}
                                    >
                                        <MoreVertIcon/>
                                    </IconButton>
                                </Box>
                            </Box>
                            <Divider sx={{mb: 2}}/>

                            {/* Resources Table */}
                            <Typography variant="subtitle1" fontWeight="medium" mb={1}>
                                Resources
                            </Typography>
                            <TableContainer component={Paper} variant="outlined" sx={{borderRadius: 2}}>
                                <Table size="medium">
                                    <TableHead sx={{backgroundColor: "#f4f6f8"}}>
                                        <TableRow>
                                            <TableCell><strong>Name</strong></TableCell>
                                            <TableCell><strong>Label</strong></TableCell>
                                            <TableCell align="center"><strong>Status</strong></TableCell>
                                            <TableCell><strong>Type</strong></TableCell>
                                            <TableCell align="center"><strong>Provisioned</strong></TableCell>
                                            <TableCell><strong>Last Updated</strong></TableCell>
                                            <TableCell align="center"><strong>Actions</strong></TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {Object.entries(resources).map(([rid, res]) => (
                                            <TableRow key={rid} hover>
                                                <TableCell>{rid}</TableCell>
                                                <TableCell>{res.label}</TableCell>
                                                <TableCell align="center">
                                                    <FiberManualRecordIcon
                                                        sx={{color: getColor(res.status), fontSize: "1rem"}}
                                                    />
                                                </TableCell>
                                                <TableCell>{res.type}</TableCell>
                                                <TableCell align="center">
                                                    <FiberManualRecordIcon
                                                        sx={{
                                                            color: res.provisioned?.state ? green[500] : red[500],
                                                            fontSize: "1rem",
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>{res.provisioned?.mtime}</TableCell>
                                                <TableCell align="center">
                                                    <IconButton
                                                        onClick={(e) => handleResourceMenuOpen(e, node, rid)}
                                                        disabled={actionInProgress}
                                                    >
                                                        <MoreVertIcon fontSize="small"/>
                                                    </IconButton>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            {/* Resource Actions Menu */}
                            <Menu
                                anchorEl={resourceMenuAnchor}
                                open={Boolean(resourceMenuAnchor)}
                                onClose={handleResourceMenuClose}
                            >
                                {RESOURCE_ACTIONS.map((action) => (
                                    <MenuItem
                                        key={action}
                                        onClick={() => handleResourceActionClick(action)}
                                        disabled={actionInProgress}
                                    >
                                        {action}
                                    </MenuItem>
                                ))}
                            </Menu>
                        </Paper>
                    );
                })}

                {/* Node Actions Menu */}
                <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
                    {NODE_ACTIONS.map((action) => (
                        <MenuItem
                            key={action}
                            onClick={() => handleNodeActionClick(action)}
                            disabled={actionInProgress}
                        >
                            {action}
                        </MenuItem>
                    ))}
                </Menu>

                {/* Confirm Freeze Dialog */}
                <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle sx={{textAlign: "center", fontWeight: "bold"}}>Confirm Freeze</DialogTitle>
                    <DialogContent sx={{padding: 3}}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={checkboxes.failover}
                                    onChange={(e) => setCheckboxes({failover: e.target.checked})}
                                />
                            }
                            label="I understand the selected service orchestration will be paused."
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
                        <Button
                            variant="contained"
                            color="primary"
                            disabled={!checkboxes.failover}
                            onClick={handleDialogConfirm}
                        >
                            Confirm
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Confirm Stop Dialog */}
                <Dialog open={stopDialogOpen} onClose={() => setStopDialogOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>Confirm Stop</DialogTitle>
                    <DialogContent>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={stopCheckbox}
                                    onChange={(e) => setStopCheckbox(e.target.checked)}
                                />
                            }
                            label="I understand this may interrupt services"
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setStopDialogOpen(false)}>Cancel</Button>
                        <Button
                            variant="contained"
                            color="error"
                            disabled={!stopCheckbox}
                            onClick={handleDialogConfirm}
                        >
                            Stop
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Resource Unprovision Dialog */}
                <Dialog open={resourceDialogOpen} onClose={() => setResourceDialogOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>Confirm Unprovision</DialogTitle>
                    <DialogContent>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={resourceConfirmChecked}
                                    onChange={(e) => setResourceConfirmChecked(e.target.checked)}
                                />
                            }
                            label="I understand data will be lost"
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setResourceDialogOpen(false)}>Cancel</Button>
                        <Button
                            variant="contained"
                            color="error"
                            disabled={!resourceConfirmChecked}
                            onClick={handleDialogConfirm}
                        >
                            Confirm
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Simple Confirm Dialog */}
                <Dialog open={simpleDialogOpen} onClose={() => setSimpleDialogOpen(false)} maxWidth="xs" fullWidth>
                    <DialogTitle>Confirm {pendingAction?.action}</DialogTitle>
                    <DialogContent>
                        <Typography>
                            Are you sure you want to <strong>{pendingAction?.action}</strong> on{" "}
                            <strong>{pendingAction?.node || pendingResource.rid}</strong>?
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setSimpleDialogOpen(false)}>Cancel</Button>
                        <Button variant="contained" onClick={handleDialogConfirm}>
                            Confirm
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Snackbar */}
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