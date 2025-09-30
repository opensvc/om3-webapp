import React, {useEffect, useState, useRef} from "react";
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
import {NODE_ACTIONS} from "../constants/actions";
import ActionDialogManager from "./ActionDialogManager";

// Safari detection
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

const NodesTable = () => {
    const {daemon, fetchNodes} = useFetchDaemonStatus();
    const nodeStatus = useEventStore((state) => state.nodeStatus);
    const nodeStats = useEventStore((state) => state.nodeStats);
    const nodeMonitor = useEventStore((state) => state.nodeMonitor);
    const theme = useTheme();
    const isWideScreen = useMediaQuery(theme.breakpoints.up("lg"));

    const [anchorEls, setAnchorEls] = useState({});
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [actionsMenuAnchor, setActionsMenuAnchor] = useState(null);
    const [snackbar, setSnackbar] = useState({open: false, message: "", severity: "info"});
    const [pendingAction, setPendingAction] = useState(null);
    const actionsMenuAnchorRef = useRef(null);
    const [menuPosition, setMenuPosition] = useState({top: 0, left: 0});

    // Compute the zoom level
    const getZoomLevel = () => {
        return window.devicePixelRatio || 1;
    };

    // Function to calculate the menu position
    const calculateMenuPosition = (anchorRef) => {
        if (anchorRef.current) {
            const zoomLevel = getZoomLevel();
            const rect = anchorRef.current.getBoundingClientRect();
            const scrollY = window.scrollY || window.pageYOffset;
            const scrollX = window.scrollX || window.pageXOffset;
            setMenuPosition({
                top: (rect.bottom + scrollY) / zoomLevel,
                left: (rect.right + scrollX) / zoomLevel,
            });
        }
    };

    const handleAction = (action, nodename = null) => {
        setPendingAction({action, node: nodename});
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
    }, [fetchNodes]);

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
        actionsMenuAnchorRef.current = event.currentTarget;
        if (isSafari) {
            setTimeout(() => calculateMenuPosition(actionsMenuAnchorRef), 0);
        }
    };

    const handleActionsMenuClose = () => {
        setActionsMenuAnchor(null);
        actionsMenuAnchorRef.current = null;
        setMenuPosition({top: 0, left: 0});
    };

    const postActionUrl = (node, action) => {
        if (action === "restart daemon") {
            return `${URL_NODE}/${node}/daemon/action/restart`;
        }
        return `${URL_NODE}/${node}/action/${action}`;
    };

    const handleDialogConfirm = async (action) => {
        if (!pendingAction) return;

        const token = localStorage.getItem("authToken");
        if (!token) {
            setSnackbar({
                open: true,
                message: "Authentication token not found",
                severity: "error",
            });
            return;
        }

        const actionLabel = action
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
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
            if (action === "freeze" && isFrozen) {
                errorCount++;
                return;
            }
            if (action === "unfreeze" && !isFrozen) {
                errorCount++;
                return;
            }
            const url = postActionUrl(node, action);
            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                });
                if (!response.ok) {
                    errorCount++;
                    console.error(`Failed to execute ${action} on ${node}: HTTP error! status: ${response.status}`);
                    return;
                }
                successCount++;
            } catch (error) {
                console.error(`Failed to execute ${action} on ${node}:`, error);
                errorCount++;
            }
        });

        await Promise.all(promises);
        setSnackbar({
            open: true,
            message:
                successCount && !errorCount
                    ? `✅ '${actionLabel}' succeeded on ${successCount} node(s).`
                    : successCount
                        ? `⚠️ '${actionLabel}' partially succeeded: ${successCount} ok, ${errorCount} errors.`
                        : `❌ '${actionLabel}' failed on all ${nodesToProcess.length} node(s).`,
            severity: successCount && !errorCount ? "success" : successCount ? "warning" : "error",
        });

        setSelectedNodes([]);
        setPendingAction(null);
    };

    const filteredMenuItems = NODE_ACTIONS.filter(({name}) => {
        if (selectedNodes.length === 0) return false;
        return selectedNodes.some((nodename) => {
            const isFrozen = !!nodeStatus[nodename]?.frozen_at && nodeStatus[nodename]?.frozen_at !== "0001-01-01T00:00:00Z";
            if (name === "freeze" && isFrozen) return false;
            return !(name === "unfreeze" && !isFrozen);
        });
    });

    // Menu props configuration
    const menuProps = {
        anchorOrigin: {
            vertical: "bottom",
            horizontal: "right",
        },
        transformOrigin: {
            vertical: "top",
            horizontal: "right",
        },
        sx: isSafari
            ? {
                "& .MuiMenu-paper": {
                    position: "fixed",
                    top: `${menuPosition.top}px !important`,
                    left: `${menuPosition.left}px !important`,
                    transform: "translateX(-100%)",
                    boxShadow: "0px 5px 15px rgba(0,0,0,0.2)",
                    zIndex: 1300,
                },
            }
            : {},
    };

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
                        ref={actionsMenuAnchorRef}
                    >
                        Actions on selected nodes
                    </Button>
                    <Menu
                        anchorEl={actionsMenuAnchor}
                        open={Boolean(actionsMenuAnchor)}
                        onClose={handleActionsMenuClose}
                        {...menuProps}
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
                                        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                                        .join(" ")}
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
                                sx={{position: "sticky", top: 0, zIndex: 1, backgroundColor: "background.paper"}}
                            >
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

                <ActionDialogManager
                    pendingAction={pendingAction}
                    handleConfirm={handleDialogConfirm}
                    target={pendingAction?.node ? `node ${pendingAction.node}` : `${selectedNodes.length} nodes`}
                    supportedActions={NODE_ACTIONS.map((action) => action.name)}
                    onClose={() => setPendingAction(null)}
                />
            </Box>
        </Box>
    );
};

export default NodesTable;
