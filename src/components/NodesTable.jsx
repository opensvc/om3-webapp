import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import useFetchDaemonStatus from "../hooks/useFetchDaemonStatus.jsx";
import {createEventSource} from "../eventSourceManager";
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, Typography, Button, CircularProgress, Box, Menu, MenuItem, Checkbox, Snackbar, Alert
} from "@mui/material";
import {blue} from "@mui/material/colors";
import useEventStore from "../store/useEventStore";
import NodeRow from "../components/NodeRow.jsx";

const NodesTable = () => {
    const {daemon, fetchNodes} = useFetchDaemonStatus();
    const nodeStatus = useEventStore((state) => state.nodeStatus);
    const nodeStats = useEventStore((state) => state.nodeStats);
    const nodeMonitor = useEventStore((state) => state.nodeMonitor);
    const [anchorEls, setAnchorEls] = useState({});
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [actionsMenuAnchor, setActionsMenuAnchor] = useState(null);
    const [snackbar, setSnackbar] = useState({open: false, message: '', severity: 'info'});
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            fetchNodes(token);
            createEventSource(`/sse`, token);
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("authToken");
        navigate("/login");
    };

    const handleMenuOpen = (event, nodename) => {
        setAnchorEls((prev) => ({...prev, [nodename]: event.currentTarget}));
    };

    const handleMenuClose = (nodename) => {
        setAnchorEls((prev) => ({...prev, [nodename]: null}));
    };

    const handleAction = async (nodename, action) => {
        const token = localStorage.getItem("authToken");

        setSnackbar({open: true, message: `Executing ${action} on ${nodename}...`, severity: 'info'});

        try {
            const response = await fetch(`/node/name/${nodename}/${action}`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to ${action} node`);
            }

            setSnackbar({open: true, message: `✅ ${action} on ${nodename} succeeded`, severity: 'success'});
        } catch (error) {
            console.error("🚨 Error performing action:", error);
            setSnackbar({open: true, message: `❌ ${action} on ${nodename} failed`, severity: 'error'});
        } finally {
            handleMenuClose(nodename);
        }
    };

    const handleSelectNode = (event, nodename) => {
        if (event.target.checked) {
            setSelectedNodes((prev) => [...prev, nodename]);
        } else {
            setSelectedNodes((prev) => prev.filter((node) => node !== nodename));
        }
    };

    const handleExecuteActionOnSelected = (action) => {
        selectedNodes.forEach((nodename) => {
            handleAction(nodename, action);
        });
        setSelectedNodes([]);
    };

    const handleActionsMenuOpen = (event) => {
        setActionsMenuAnchor(event.currentTarget);
    };

    const handleActionsMenuClose = () => {
        setActionsMenuAnchor(null);
    };

    return (
        <Box sx={{minHeight: "100vh", bgcolor: "background.default", p: 3}}>
            <Paper elevation={3} sx={{p: 3, borderRadius: 2, bgcolor: "background.paper"}}>
                <Typography variant="h4" component="h1" gutterBottom align="center" sx={{mb: 4}}>
                    Node Status
                </Typography>
                <Box sx={{mb: 3}}>
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
                    </Menu>
                </Box>

                {Object.keys(nodeStatus).length === 0 ? (
                    <Box sx={{display: "flex", justifyContent: "center", my: 4}}>
                        <CircularProgress/>
                    </Box>
                ) : (
                    <TableContainer component={Paper} elevation={0}>
                        <Table sx={{width: "100%", tableLayout: "fixed"}} aria-label="nodes table">
                            <TableHead>
                                <TableRow sx={{bgcolor: blue[500]}}>
                                    <TableCell sx={{color: "white", fontWeight: "bold"}}>
                                        <Checkbox
                                            checked={selectedNodes.length === Object.keys(nodeStatus).length}
                                            onChange={(e) =>
                                                setSelectedNodes(
                                                    e.target.checked ? Object.keys(nodeStatus) : []
                                                )
                                            }
                                        />
                                    </TableCell>
                                    <TableCell sx={{color: "white", fontWeight: "bold"}}>Name</TableCell>
                                    <TableCell sx={{color: "white", fontWeight: "bold"}}>State</TableCell>
                                    <TableCell sx={{color: "white", fontWeight: "bold"}}>Score</TableCell>
                                    <TableCell sx={{color: "white", fontWeight: "bold"}}>Load (15m)</TableCell>
                                    <TableCell sx={{color: "white", fontWeight: "bold"}}>Mem Avail</TableCell>
                                    <TableCell sx={{color: "white", fontWeight: "bold"}}>Swap Avail</TableCell>
                                    <TableCell sx={{color: "white", fontWeight: "bold"}}>Version</TableCell>
                                    <TableCell sx={{color: "white", fontWeight: "bold"}}>Action</TableCell>
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
                                        onAction={handleAction}
                                        anchorEl={anchorEls[nodename]}
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
        </Box>
    );
};

export default NodesTable;
