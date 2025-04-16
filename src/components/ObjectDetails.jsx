import React, {useState} from "react";
import {useParams} from "react-router-dom";
import {
    Box, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Typography, Tooltip, Divider,
    Snackbar, Alert, Menu, MenuItem, IconButton,
    Dialog, DialogTitle, DialogContent, DialogActions,
    FormControlLabel, Checkbox, Button
} from "@mui/material";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import {green, red, grey, blue} from "@mui/material/colors";
import useEventStore from "../store/useEventStore";

const AVAILABLE_ACTIONS = ["start", "stop", "restart", "freeze", "unfreeze"];

const ObjectDetail = () => {
    const {objectName} = useParams();
    const decodedObjectName = decodeURIComponent(objectName);

    const objectStatus = useEventStore((state) => state.objectStatus);
    const objectInstanceStatus = useEventStore((state) => state.objectInstanceStatus);

    const objectData = objectInstanceStatus?.[decodedObjectName];
    const globalStatus = objectStatus?.[decodedObjectName];

    const [snackbar, setSnackbar] = useState({open: false, message: "", severity: "success"});
    const [menuAnchor, setMenuAnchor] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);
    const [actionInProgress, setActionInProgress] = useState(false);

    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [stopDialogOpen, setStopDialogOpen] = useState(false);
    const [simpleDialogOpen, setSimpleDialogOpen] = useState(false);

    const [checkboxes, setCheckboxes] = useState({
        failover: false,
        monitoring: false
    });
    const [stopCheckbox, setStopCheckbox] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);

    const openSnackbar = (message, severity = "success") => {
        setSnackbar({open: true, message, severity});
    };

    const closeSnackbar = () => {
        setSnackbar({...snackbar, open: false});
    };

    const parseObjectPath = (objName) => {
        const parts = objName.split("/");
        if (parts.length === 3) {
            return {namespace: parts[0], kind: parts[1], name: parts[2]};
        } else {
            return {namespace: "root", kind: "svc", name: objName};
        }
    };

    const postAction = async ({node, action}) => {
        const {namespace, kind, name} = parseObjectPath(decodedObjectName);
        const token = localStorage.getItem("authToken");

        if (!token) {
            openSnackbar("Auth token not found.", "error");
            return;
        }

        setActionInProgress(true);
        openSnackbar(`Executing ${action} action on node ${node}...`, "info");

        const url = `/node/name/${node}/instance/path/${namespace}/${kind}/${name}/action/${action}`;

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            if (!res.ok) throw new Error(`Failed to ${action} on ${node}`);

            openSnackbar(`Successfully executed '${action}' on node '${node}'`);
        } catch (err) {
            console.error(err);
            openSnackbar(`Error executing action: ${err.message}`, "error");
        } finally {
            setActionInProgress(false);
        }
    };

    const getColor = (status) => {
        if (status === "up" || status === true) return green[500];
        if (status === "down" || status === false) return red[500];
        return grey[500];
    };

    const handleMenuOpen = (event, node) => {
        setSelectedNode(node);
        setMenuAnchor(event.currentTarget);
    };

    const handleMenuClose = () => {
        setMenuAnchor(null);
        setSelectedNode(null);
    };

    const handleActionClick = (action) => {
        const actionType = action.toLowerCase();
        setPendingAction({action, node: selectedNode});

        if (actionType === "freeze") {
            setConfirmDialogOpen(true);
        } else if (actionType === "stop") {
            setStopDialogOpen(true);
        } else {
            setSimpleDialogOpen(true);
        }

        handleMenuClose();
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
                <Typography variant="h4" gutterBottom fontWeight="bold">
                    {decodedObjectName}
                </Typography>

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
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {Object.entries(resources).map(([resName, res]) => (
                                            <TableRow key={resName} hover>
                                                <TableCell>{resName}</TableCell>
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
                                                            fontSize: "1rem"
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>{res.provisioned?.mtime}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    );
                })}

                <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
                    {AVAILABLE_ACTIONS.map((action) => (
                        <MenuItem
                            key={action}
                            onClick={() => handleActionClick(action)}
                            disabled={actionInProgress}
                        >
                            {action}
                        </MenuItem>
                    ))}
                </Menu>

                {/* Freeze Dialog */}
                <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle sx={{textAlign: "center", fontWeight: "bold"}}>Confirm Freeze Action</DialogTitle>
                    <DialogContent sx={{padding: 3}}>
                        <Typography paragraph>
                            Please confirm the following actions before freezing the node:
                        </Typography>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={checkboxes.failover}
                                    onChange={(e) => setCheckboxes({...checkboxes, failover: e.target.checked})}
                                />
                            }
                            label="I understand the selected instances will no longer be a failover candidate."
                            sx={{mb: 2}}
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={checkboxes.monitoring}
                                    onChange={(e) => setCheckboxes({...checkboxes, monitoring: e.target.checked})}
                                />
                            }
                            label="I understand the selected resources will no longer be monitored."
                        />
                    </DialogContent>
                    <DialogActions sx={{px: 3, pb: 2}}>
                        <Button onClick={() => setConfirmDialogOpen(false)} variant="outlined">Cancel</Button>
                        <Button
                            variant="contained"
                            color="primary"
                            disabled={!checkboxes.failover || !checkboxes.monitoring}
                            onClick={() => {
                                setConfirmDialogOpen(false);
                                if (pendingAction) {
                                    postAction(pendingAction);
                                    setPendingAction(null);
                                    setCheckboxes({failover: false, monitoring: false});
                                }
                            }}
                        >
                            Confirm Freeze
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Stop Dialog */}
                <Dialog open={stopDialogOpen} onClose={() => setStopDialogOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle sx={{textAlign: "center", fontWeight: "bold"}}>Confirm Stop Action</DialogTitle>
                    <DialogContent sx={{padding: 3}}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={stopCheckbox}
                                    onChange={(e) => setStopCheckbox(e.target.checked)}
                                />
                            }
                            label="I understand the selected services may be temporarily interrupted during failover, or durably interrupted if no failover is configured."
                        />
                    </DialogContent>
                    <DialogActions sx={{px: 3, pb: 2}}>
                        <Button onClick={() => setStopDialogOpen(false)} variant="outlined">Cancel</Button>
                        <Button
                            variant="contained"
                            color="error"
                            disabled={!stopCheckbox}
                            onClick={() => {
                                setStopDialogOpen(false);
                                if (pendingAction) {
                                    postAction(pendingAction);
                                    setPendingAction(null);
                                    setStopCheckbox(false);
                                }
                            }}
                        >
                            Confirm Stop
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Other Actions Dialog */}
                <Dialog open={simpleDialogOpen} onClose={() => setSimpleDialogOpen(false)} maxWidth="xs" fullWidth>
                    <DialogTitle sx={{textAlign: "center", fontWeight: "bold"}}>
                        Confirm {pendingAction?.action} Action
                    </DialogTitle>
                    <DialogContent sx={{padding: 3}}>
                        <Typography>
                            Are you sure you want to execute <strong>{pendingAction?.action}</strong> on
                            node <strong>{pendingAction?.node}</strong>?
                        </Typography>
                    </DialogContent>
                    <DialogActions sx={{justifyContent: "center", px: 3, pb: 2}}>
                        <Button onClick={() => setSimpleDialogOpen(false)} variant="outlined">
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={() => {
                                setSimpleDialogOpen(false);
                                if (pendingAction) {
                                    postAction(pendingAction);
                                    setPendingAction(null);
                                }
                            }}
                        >
                            OK
                        </Button>
                    </DialogActions>
                </Dialog>

                <Snackbar
                    open={snackbar.open}
                    autoHideDuration={6000}
                    onClose={closeSnackbar}
                    anchorOrigin={{vertical: "bottom", horizontal: "center"}}
                >
                    <Alert
                        onClose={closeSnackbar}
                        severity={snackbar.severity}
                        sx={{width: "100%"}}
                        variant="filled"
                    >
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            </Box>
        </Box>
    );
};

export default ObjectDetail;