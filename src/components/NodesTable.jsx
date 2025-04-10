import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import useFetchDaemonStatus from "../hooks/useFetchDaemonStatus.jsx";
import {createEventSource} from "../eventSourceManager";
import {FaSnowflake, FaWifi} from "react-icons/fa";
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, Typography, Button, CircularProgress, Box, IconButton,
    Tooltip, LinearProgress, Menu, MenuItem, Checkbox
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import {blue, green} from "@mui/material/colors";
import useEventStore from "../store/useEventStore";

const NodesTable = () => {
    const {daemon, fetchNodes} = useFetchDaemonStatus();
    const nodeStatus = useEventStore((state) => state.nodeStatus);
    const nodeStats = useEventStore((state) => state.nodeStats);
    const nodeMonitor = useEventStore((state) => state.nodeMonitor);
    const [anchorEls, setAnchorEls] = useState({});
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [actionsMenuAnchor, setActionsMenuAnchor] = useState(null);
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
            console.log(`✅ Node ${nodename} ${action}d successfully`);
        } catch (error) {
            console.error("🚨 Error performing action:", error);
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
                        <MenuItem onClick={() => handleExecuteActionOnSelected("daemon/action/restart")}>Restart
                            Daemon</MenuItem>
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
                                {Object.keys(nodeStatus).map((nodename, index) => {
                                    const stats = nodeStats[nodename];
                                    const status = nodeStatus[nodename];
                                    const monitor = nodeMonitor[nodename];
                                    const isFrozen = status?.frozen_at && status?.frozen_at !== "0001-01-01T00:00:00Z";

                                    return (
                                        <TableRow key={index} hover>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedNodes.includes(nodename)}
                                                    onChange={(e) => handleSelectNode(e, nodename)}
                                                />
                                            </TableCell>
                                            <TableCell>{nodename || "-"}</TableCell>
                                            <TableCell>
                                                <Box sx={{display: "flex", gap: 1}}>
                                                    {monitor?.state && monitor?.state !== "idle" && monitor.state}
                                                    {isFrozen && (
                                                        <Tooltip title="Frozen">
                                                            <span><FaSnowflake style={{color: blue[200]}}/></span>
                                                        </Tooltip>
                                                    )}
                                                    {daemon.nodename === nodename && (
                                                        <Tooltip title="Daemon Node">
                                                            <span><FaWifi style={{color: green[500]}}/></span>
                                                        </Tooltip>
                                                    )}
                                                </Box>
                                            </TableCell>
                                            <TableCell>{stats?.score || "N/A"}</TableCell>
                                            <TableCell>
                                                {stats?.load_15m ? (
                                                    <>
                                                        {stats?.load_15m}
                                                        <LinearProgress
                                                            variant="determinate"
                                                            value={Math.min(stats?.load_15m * 20, 100)}
                                                            sx={{mt: 1, height: 4}}
                                                            color={
                                                                stats?.load_15m > 4
                                                                    ? "error"
                                                                    : stats?.load_15m > 2
                                                                        ? "warning"
                                                                        : "success"
                                                            }
                                                        />
                                                    </>
                                                ) : "N/A"}
                                            </TableCell>
                                            <TableCell>
                                                {stats?.mem_avail || "N/A"}%
                                                {stats?.mem_avail && (
                                                    <LinearProgress
                                                        variant="determinate"
                                                        value={stats?.mem_avail}
                                                        sx={{mt: 1, height: 4}}
                                                        color={
                                                            stats?.mem_avail < 20
                                                                ? "error"
                                                                : stats?.mem_avail < 50
                                                                    ? "warning"
                                                                    : "success"
                                                        }
                                                    />
                                                )}
                                            </TableCell>
                                            <TableCell>{stats?.swap_avail || "N/A"}%</TableCell>
                                            <TableCell>{status?.agent || "N/A"}</TableCell>
                                            <TableCell>
                                                <IconButton onClick={(e) => handleMenuOpen(e, nodename)}>
                                                    <MoreVertIcon/>
                                                </IconButton>
                                                <Menu
                                                    anchorEl={anchorEls[nodename]}
                                                    open={Boolean(anchorEls[nodename])}
                                                    onClose={() => handleMenuClose(nodename)}
                                                >
                                                    {!isFrozen && (
                                                        <MenuItem
                                                            onClick={() => handleAction(nodename, "action/freeze")}>
                                                            Freeze
                                                        </MenuItem>
                                                    )}
                                                    {isFrozen && (
                                                        <MenuItem
                                                            onClick={() => handleAction(nodename, "action/unfreeze")}>
                                                            Unfreeze
                                                        </MenuItem>
                                                    )}
                                                    <MenuItem
                                                        onClick={() => handleAction(nodename, "daemon/action/restart")}>
                                                        Restart Daemon
                                                    </MenuItem>
                                                </Menu>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Paper>
        </Box>
    );
};

export default NodesTable;
