import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import useFetchDaemonStatus from "../hooks/useFetchDaemonStatus.jsx";
import {createEventSource, closeEventSource} from "../eventSourceManager";
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, Typography, Button, CircularProgress, Box, Menu, MenuItem,
    Checkbox, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions
} from "@mui/material";
import {blue} from "@mui/material/colors";
import useEventStore from "../hooks/useEventStore.js";
import NodeRow from "../components/NodeRow.jsx";
import {URL_NODE} from "../config/apiPath.js";

const NodesTable = () => {
    const {daemon, fetchNodes, startEventReception} = useFetchDaemonStatus();
    const nodeStatus = useEventStore((state) => state.nodeStatus);
    const nodeStats = useEventStore((state) => state.nodeStats);
    const nodeMonitor = useEventStore((state) => state.nodeMonitor);

    const [anchorEls, setAnchorEls] = useState({});
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [actionsMenuAnchor, setActionsMenuAnchor] = useState(null);
    const [snackbar, setSnackbar] = useState({open: false, message: '', severity: 'info'});

    const [simpleDialogOpen, setSimpleDialogOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);

    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            fetchNodes(token);
            startEventReception(token);
        }
        return () => {
            closeEventSource();
        };
    }, []);

    const cellStyle = {
        px: { xs: 0.25, sm: 0.5, md: 1 },
        py: { xs: 0.25, sm: 0.5 },
        fontSize: { xs: '0.7rem', sm: '0.8rem' },
    };

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

    const handleTriggerAction = (nodename, action) => {
        setPendingAction({nodes: [nodename], action});
        setSimpleDialogOpen(true);
    };

    const handleExecuteActionOnSelected = (action) => {
        setPendingAction({nodes: [...selectedNodes], action});
        setSimpleDialogOpen(true);
        setActionsMenuAnchor(null);
    };

    const postActionUrl = ({node, action}) => `${URL_NODE}/${node}/${action}`;

    const postAction = async ({node, action}) => {
        const token = localStorage.getItem("authToken");
        setSnackbar({open: true, message: `Executing ${action} on ${node}...`, severity: "info"});

        try {
            const response = await fetch(postActionUrl({node, action}), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) throw new Error();

            setSnackbar({open: true, message: `✅ ${action} on ${node} succeeded`, severity: "success"});
        } catch (e) {
            setSnackbar({open: true, message: `❌ ${action} on ${node} failed`, severity: "error"});
        }

        handleMenuClose(node);
    };

    const handleActionsMenuOpen = (event) => {
        setActionsMenuAnchor(event.currentTarget);
    };

    const handleActionsMenuClose = () => {
        setActionsMenuAnchor(null);
    };

    const handleConfirmAction = async () => {
        if (pendingAction) {
            for (const node of pendingAction.nodes) {
                await postAction({node, action: pendingAction.action});
            }
            setSelectedNodes([]);
        }
        setSimpleDialogOpen(false);
        setPendingAction(null);
    };

    return (
        <Box sx={{minHeight: "100vh", bgcolor: "background.default", p: 2}}>
            <Paper elevation={3} sx={{p: 2, borderRadius: 2, bgcolor: "background.paper"}}>
                <Typography variant="h5" component="h1" gutterBottom align="center" sx={{mb: 3}}>
                    Node Status
                </Typography>

                <Box sx={{
                    mb: 2,
                    display: 'flex',
                    flexDirection: {xs: 'column', sm: 'row'},
                    alignItems: {xs: 'stretch', sm: 'center'},
                    gap: 2
                }}>
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
                        <MenuItem onClick={() => handleExecuteActionOnSelected("action/freeze")}>Freeze</MenuItem>
                        <MenuItem onClick={() => handleExecuteActionOnSelected("action/unfreeze")}>Unfreeze</MenuItem>
                        <MenuItem onClick={() => handleExecuteActionOnSelected("daemon/action/restart")}>Restart Daemon</MenuItem>
                        <MenuItem onClick={() => handleExecuteActionOnSelected("action/abort")}>Abort</MenuItem>
                        <MenuItem onClick={() => handleExecuteActionOnSelected("action/clear")}>Clear</MenuItem>
                        <MenuItem onClick={() => handleExecuteActionOnSelected("action/drain")}>Drain</MenuItem>
                        <MenuItem onClick={() => handleExecuteActionOnSelected("action/push/asset")}>Asset</MenuItem>
                        <MenuItem onClick={() => handleExecuteActionOnSelected("action/push/disk")}>Disk</MenuItem>
                        <MenuItem onClick={() => handleExecuteActionOnSelected("action/push/patch")}>Patch</MenuItem>
                        <MenuItem onClick={() => handleExecuteActionOnSelected("action/push/pkg")}>Pkg</MenuItem>
                        <MenuItem onClick={() => handleExecuteActionOnSelected("action/scan/capabilities")}>Capabilities</MenuItem>
                        <MenuItem onClick={() => handleExecuteActionOnSelected("action/sysreport")}>Sysreport</MenuItem>
                    </Menu>
                </Box>

                {Object.keys(nodeStatus).length === 0 ? (
                    <Box sx={{display: "flex", justifyContent: "center", my: 4}}>
                        <CircularProgress/>
                    </Box>
                ) : (
                    <TableContainer component={Paper} elevation={0} sx={{overflowX: 'auto'}}>
                        <Table sx={{minWidth: 900}} aria-label="nodes table">
                            <TableHead>
                                <TableRow sx={{bgcolor: blue[500]}}>
                                    <TableCell sx={{...cellStyle, color: "white", fontWeight: "bold"}}>
                                        <Checkbox
                                            checked={selectedNodes.length === Object.keys(nodeStatus).length}
                                            onChange={(e) =>
                                                setSelectedNodes(
                                                    e.target.checked ? Object.keys(nodeStatus) : []
                                                )
                                            }
                                        />
                                    </TableCell>
                                    <TableCell sx={{...cellStyle, color: "white", fontWeight: "bold"}}>Name</TableCell>
                                    <TableCell sx={{...cellStyle, color: "white", fontWeight: "bold"}}>State</TableCell>
                                    <TableCell sx={{...cellStyle, color: "white", fontWeight: "bold"}}>Score</TableCell>
                                    <TableCell sx={{...cellStyle, color: "white", fontWeight: "bold"}}>Load (15m)</TableCell>
                                    <TableCell sx={{...cellStyle, color: "white", fontWeight: "bold"}}>Mem Avail</TableCell>
                                    <TableCell sx={{...cellStyle, color: "white", fontWeight: "bold"}}>Swap Avail</TableCell>
                                    <TableCell sx={{...cellStyle, color: "white", fontWeight: "bold"}}>Version</TableCell>
                                    <TableCell sx={{...cellStyle, color: "white", fontWeight: "bold"}}>Action</TableCell>
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
                                        onAction={handleTriggerAction}
                                        anchorEl={anchorEls[nodename]}
                                        cellStyle={cellStyle}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Paper>
            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar({...snackbar, open: false})}
                anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}
            >
                <Alert
                    onClose={() => setSnackbar({...snackbar, open: false})}
                    severity={snackbar.severity}
                    variant="filled"
                    sx={{width: '100%'}}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>

            <Dialog open={simpleDialogOpen} onClose={() => setSimpleDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{textAlign: "center", fontWeight: "bold"}}>
                    Confirm {pendingAction?.action} Action
                </DialogTitle>
                <DialogContent sx={{padding: 3}}>
                    <Typography>
                        Are you sure you want to execute <strong>{pendingAction?.action}</strong> on
                        {" "}
                        <strong>
                            {pendingAction?.nodes.length === 1
                                ? pendingAction?.nodes[0]
                                : `${pendingAction?.nodes.length} nodes`}
                        </strong>
                        ?
                    </Typography>
                </DialogContent>
                <DialogActions sx={{justifyContent: "center", px: 3, pb: 2}}>
                    <Button onClick={() => setSimpleDialogOpen(false)} variant="outlined">
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleConfirmAction}
                    >
                        OK
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default NodesTable;