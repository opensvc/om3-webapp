import React, {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import {
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    Button,
    Menu,
    MenuItem,
    Checkbox,
    Snackbar,
    Alert,
    useMediaQuery,
    useTheme,
    ListItemIcon,
    ListItemText,
    CircularProgress,
} from "@mui/material";
import useFetchDaemonStatus from "../hooks/useFetchDaemonStatus.jsx";
import {closeEventSource, startEventReception} from "../eventSourceManager";
import useEventStore from "../hooks/useEventStore.js";
import NodeRow from "../components/NodeRow.jsx";
import {URL_NODE} from "../config/apiPath.js";
import {
    FreezeDialog,
    StopDialog,
    SimpleConfirmDialog,
    ClearDialog,
    DrainDialog,
    RestartDialog,
    UnprovisionDialog,
    DeleteDialog,
    SwitchDialog,
    GivebackDialog,
} from "./ActionDialogs";
import {NODE_ACTIONS} from "../constants/actions";

const NodesTable = () => {
    const {daemon, fetchNodes} = useFetchDaemonStatus();
    const nodeStatus = useEventStore((state) => state.nodeStatus);
    const nodeStats = useEventStore((state) => state.nodeStats);
    const nodeMonitor = useEventStore((state) => state.nodeMonitor);
    const navigate = useNavigate();
    const theme = useTheme();
    const isWideScreen = useMediaQuery(theme.breakpoints.up("lg"));

    const [anchorEls, setAnchorEls] = useState({});
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [actionsMenuAnchor, setActionsMenuAnchor] = useState(null);
    const [snackbar, setSnackbar] = useState({open: false, message: "", severity: "info"});
    const [freezeDialogOpen, setFreezeDialogOpen] = useState(false);
    const [stopDialogOpen, setStopDialogOpen] = useState(false);
    const [restartDialogOpen, setRestartDialogOpen] = useState(false);
    const [clearDialogOpen, setClearDialogOpen] = useState(false);
    const [drainDialogOpen, setDrainDialogOpen] = useState(false);
    const [simpleConfirmDialogOpen, setSimpleConfirmDialogOpen] = useState(false);
    const [unprovisionDialogOpen, setUnprovisionDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [switchDialogOpen, setSwitchDialogOpen] = useState(false);
    const [givebackDialogOpen, setGivebackDialogOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);
    const [confirmationChecked, setConfirmationChecked] = useState(false);
    const [unprovisionCheckboxes, setUnprovisionCheckboxes] = useState({
        dataLoss: false,
        clusterwide: false,
        serviceInterruption: false,
    });
    const [deleteCheckboxes, setDeleteCheckboxes] = useState({
        configLoss: false,
        clusterwide: false,
    });

    const actionDialogMap = {
        freeze: {
            openDialog: () => setFreezeDialogOpen(true),
            initState: () => setConfirmationChecked(false),
        },
        stop: {
            openDialog: () => setStopDialogOpen(true),
            initState: () => setConfirmationChecked(false),
        },
        "restart daemon": {
            openDialog: () => setRestartDialogOpen(true),
            initState: () => setConfirmationChecked(false),
        },
        clear: {
            openDialog: () => setClearDialogOpen(true),
            initState: () => setConfirmationChecked(false),
        },
        drain: {
            openDialog: () => setDrainDialogOpen(true),
            initState: () => setConfirmationChecked(false),
        },
        unprovision: {
            openDialog: () => setUnprovisionDialogOpen(true),
            initState: () => setUnprovisionCheckboxes({
                dataLoss: false,
                clusterwide: false,
                serviceInterruption: false,
            }),
        },
        delete: {
            openDialog: () => setDeleteDialogOpen(true),
            initState: () => setDeleteCheckboxes({
                configLoss: false,
                clusterwide: false,
            }),
        },
        switch: {
            openDialog: () => setSwitchDialogOpen(true),
            initState: () => setConfirmationChecked(false),
        },
        giveback: {
            openDialog: () => setGivebackDialogOpen(true),
            initState: () => setConfirmationChecked(false),
        },
        default: {
            openDialog: () => setSimpleConfirmDialogOpen(true),
            initState: () => {
            },
        },
    };

    const handleAction = (action, nodename = null) => {
        const dialogConfig = actionDialogMap[action] || actionDialogMap.default;
        setPendingAction({action, node: nodename});
        dialogConfig.initState();
        dialogConfig.openDialog();
        if (nodename) {
            handleMenuClose(nodename);
        } else {
            handleActionsMenuClose();
        }
    };

    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            fetchNodes(token);
            startEventReception(token, [
                "NodeStatusUpdated",
                "NodeMonitorUpdated",
                "NodeStatsUpdated",
            ]);
        }
        return () => {
            closeEventSource();
        };
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("authToken");
        navigate("/auth/login");
    };

    const handleMenuOpen = (event, nodename) => {
        setAnchorEls((prev) => ({...prev, [nodename]: event.currentTarget}));
    };

    const handleMenuClose = (nodename) => {
        setAnchorEls((prev) => ({...prev, [nodename]: null}));
    };

    const handleSelectNode = (event, nodename) => {
        if (event.target.checked) {
            setSelectedNodes((prev) => [...prev, nodename]);
        } else {
            setSelectedNodes((prev) => prev.filter((node) => node !== nodename));
        }
    };

    const handleActionsMenuOpen = (event) => {
        setActionsMenuAnchor(event.currentTarget);
    };

    const handleActionsMenuClose = () => {
        setActionsMenuAnchor(null);
    };

    const postActionUrl = (node, action) => {
        if (action === "restart daemon") {
            return `${URL_NODE}/${node}/daemon/action/restart`;
        }
        return `${URL_NODE}/${node}/action/${action}`;
    };

    const handleDialogConfirm = () => {
        if (!pendingAction) return;

        const token = localStorage.getItem("authToken");
        const actionLabel = pendingAction.action
            .split(" ")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
        setSnackbar({
            open: true,
            message: `Executing '${actionLabel}'...`,
            severity: "info",
        });
        let successCount = 0;
        let errorCount = 0;

        const nodesToProcess = pendingAction.node
            ? [pendingAction.node]
            : selectedNodes;

        const promises = nodesToProcess.map(async (node) => {
            const isFrozen = !!nodeStatus[node]?.frozen_at && nodeStatus[node]?.frozen_at !== "0001-01-01T00:00:00Z";
            if (pendingAction.action === "freeze" && isFrozen) return;
            if (pendingAction.action === "unfreeze" && !isFrozen) return;
            const url = postActionUrl(node, pendingAction.action);
            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                });
                if (!response.ok) throw new Error();
                successCount++;
            } catch {
                errorCount++;
            }
        });

        Promise.all(promises).then(() => {
            setSnackbar({
                open: true,
                message:
                    successCount && !errorCount
                        ? `✅ '${actionLabel}' succeeded on ${successCount} node(s).`
                        : successCount
                            ? `⚠️ '${actionLabel}' partially succeeded: ${successCount} ok, ${errorCount} errors.`
                            : `❌ '${actionLabel}' failed on all nodes.`,
                severity: successCount && !errorCount ? "success" : successCount ? "warning" : "error",
            });

            setSelectedNodes([]);
            setFreezeDialogOpen(false);
            setStopDialogOpen(false);
            setRestartDialogOpen(false);
            setClearDialogOpen(false);
            setDrainDialogOpen(false);
            setSimpleConfirmDialogOpen(false);
            setUnprovisionDialogOpen(false);
            setDeleteDialogOpen(false);
            setSwitchDialogOpen(false);
            setGivebackDialogOpen(false);
            setConfirmationChecked(false);
            setUnprovisionCheckboxes({
                dataLoss: false,
                clusterwide: false,
                serviceInterruption: false,
            });
            setDeleteCheckboxes({
                configLoss: false,
                clusterwide: false,
            });
            setPendingAction(null);
        });
    };

    const filteredMenuItems = NODE_ACTIONS.filter(({name}) => {
        if (selectedNodes.length === 0) return false;
        return selectedNodes.some((nodename) => {
            const isFrozen = !!nodeStatus[nodename]?.frozen_at && nodeStatus[nodename]?.frozen_at !== "0001-01-01T00:00:00Z";
            if (name === "freeze" && isFrozen) return false;
            if (name === "unfreeze" && !isFrozen) return false;
            return true;
        });
    });

    return (
        <Box
            sx={{
                minHeight: "100vh",
                bgcolor: "background.default",
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-start",
                p: 2,
            }}
        >
            <Box
                sx={{
                    width: "100%",
                    maxWidth: isWideScreen ? "1600px" : "1000px",
                    bgcolor: "background.paper",
                    border: "2px solid",
                    borderColor: "divider",
                    borderRadius: 3,
                    boxShadow: 3,
                    p: 3,
                }}
            >
                <Typography variant="h4" gutterBottom align="center">
                    Node Status
                </Typography>

                <Box sx={{mb: 2}}>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleActionsMenuOpen}
                        disabled={selectedNodes.length === 0}
                    >
                        Actions on selected nodes
                    </Button>
                    <Menu
                        anchorEl={actionsMenuAnchor}
                        open={Boolean(actionsMenuAnchor)}
                        onClose={handleActionsMenuClose}
                    >
                        {filteredMenuItems.map(({name, icon}) => (
                            <MenuItem
                                key={name}
                                onClick={() => handleAction(name)}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                }}
                            >
                                <ListItemIcon>{icon}</ListItemIcon>
                                <ListItemText>
                                    {name
                                        .split(" ")
                                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                        .join(" ")
                                    }
                                </ListItemText>
                            </MenuItem>
                        ))}
                    </Menu>
                </Box>

                {Object.keys(nodeStatus).length === 0 ? (
                    <Box sx={{display: "flex", justifyContent: "center", my: 4}}>
                        <CircularProgress aria-label="Loading nodes"/>
                    </Box>
                ) : (
                    <TableContainer sx={{maxHeight: "60vh", overflow: "auto", boxShadow: "none", border: "none"}}>
                        <Table sx={{minWidth: 900}} aria-label="nodes table">
                            <TableHead
                                sx={{position: "sticky", top: 0, zIndex: 1, backgroundColor: "background.paper"}}>
                                <TableRow>
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedNodes.length === Object.keys(nodeStatus).length}
                                            onChange={(e) =>
                                                setSelectedNodes(e.target.checked ? Object.keys(nodeStatus) : [])
                                            }
                                        />
                                    </TableCell>
                                    <TableCell><strong>Name</strong></TableCell>
                                    <TableCell><strong>State</strong></TableCell>
                                    <TableCell><strong>Score</strong></TableCell>
                                    <TableCell><strong>Load (15m)</strong></TableCell>
                                    <TableCell><strong>Mem Avail</strong></TableCell>
                                    <TableCell><strong>Swap Avail</strong></TableCell>
                                    <TableCell><strong>Version</strong></TableCell>
                                    <TableCell><strong>Actions</strong></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {Object.keys(nodeStatus).map((nodename, index) => (
                                    <NodeRow
                                        key={index}
                                        nodename={nodename}
                                        stats={nodeStats[nodename]}
                                        status={nodeStatus[nodename]}
                                        monitor={nodeMonitor[nodename]}
                                        isSelected={selectedNodes.includes(nodename)}
                                        daemonNodename={daemon.nodename}
                                        onSelect={handleSelectNode}
                                        onMenuOpen={handleMenuOpen}
                                        onMenuClose={handleMenuClose}
                                        onAction={(nodename, action) => handleAction(action, nodename)}
                                        anchorEl={anchorEls[nodename]}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}

                <Snackbar
                    open={snackbar.open}
                    autoHideDuration={4000}
                    onClose={() => setSnackbar({...snackbar, open: false})}
                    anchorOrigin={{vertical: "bottom", horizontal: "center"}}
                >
                    <Alert
                        severity={snackbar.severity}
                        onClose={() => setSnackbar({...snackbar, open: false})}
                    >
                        {snackbar.message}
                    </Alert>
                </Snackbar>

                <FreezeDialog
                    open={freezeDialogOpen}
                    onClose={() => setFreezeDialogOpen(false)}
                    onConfirm={handleDialogConfirm}
                    checked={confirmationChecked}
                    setChecked={setConfirmationChecked}
                    disabled={false}
                />

                <StopDialog
                    open={stopDialogOpen}
                    onClose={() => setStopDialogOpen(false)}
                    onConfirm={handleDialogConfirm}
                    checked={confirmationChecked}
                    setChecked={setConfirmationChecked}
                    disabled={false}
                />

                <RestartDialog
                    open={restartDialogOpen}
                    onClose={() => setRestartDialogOpen(false)}
                    onConfirm={handleDialogConfirm}
                    checked={confirmationChecked}
                    setChecked={setConfirmationChecked}
                    disabled={false}
                />

                <ClearDialog
                    open={clearDialogOpen}
                    onClose={() => setClearDialogOpen(false)}
                    onConfirm={handleDialogConfirm}
                    checked={confirmationChecked}
                    setChecked={setConfirmationChecked}
                    disabled={false}
                />

                <DrainDialog
                    open={drainDialogOpen}
                    onClose={() => setDrainDialogOpen(false)}
                    onConfirm={handleDialogConfirm}
                    checked={confirmationChecked}
                    setChecked={setConfirmationChecked}
                    disabled={false}
                />

                <SimpleConfirmDialog
                    open={simpleConfirmDialogOpen}
                    onClose={() => setSimpleConfirmDialogOpen(false)}
                    onConfirm={handleDialogConfirm}
                    action={pendingAction?.action || ""}
                    target={
                        pendingAction?.node
                            ? `node ${pendingAction.node}`
                            : `${selectedNodes.length} nodes`
                    }
                />

                <UnprovisionDialog
                    open={unprovisionDialogOpen}
                    onClose={() => setUnprovisionDialogOpen(false)}
                    onConfirm={handleDialogConfirm}
                    checkboxes={unprovisionCheckboxes}
                    setCheckboxes={setUnprovisionCheckboxes}
                    disabled={false}
                />

                <DeleteDialog
                    open={deleteDialogOpen}
                    onClose={() => setDeleteDialogOpen(false)}
                    onConfirm={handleDialogConfirm}
                    checkboxes={deleteCheckboxes}
                    setCheckboxes={setDeleteCheckboxes}
                    disabled={false}
                />

                <SwitchDialog
                    open={switchDialogOpen}
                    onClose={() => setSwitchDialogOpen(false)}
                    onConfirm={handleDialogConfirm}
                    checked={confirmationChecked}
                    setChecked={setConfirmationChecked}
                    disabled={false}
                />

                <GivebackDialog
                    open={givebackDialogOpen}
                    onClose={() => setGivebackDialogOpen(false)}
                    onConfirm={handleDialogConfirm}
                    checked={confirmationChecked}
                    setChecked={setConfirmationChecked}
                    disabled={false}
                />
            </Box>
        </Box>
    );
};

export default NodesTable;
