import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import useFetchDaemonStatus from "../hooks/useFetchDaemonStatus.jsx";
import {createEventSource2} from "../eventSourceManager";
import {FaSnowflake, FaWifi, FaSignOutAlt} from "react-icons/fa";
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Typography,
    Button,
    CircularProgress,
    Box,
    IconButton,
    Tooltip,
    LinearProgress,
} from "@mui/material";
import {blue, green, red} from "@mui/material/colors";

const NodesTable = () => {
    const {daemon, nodes, fetchNodes} = useFetchDaemonStatus();
    const [token, setToken] = useState("");
    const [eventNodes, setEventNodes] = useState([]);
    const [nodeStatus, setNodeStatus] = useState({});
    const [nodeStats, setNodeStats] = useState({});
    const [nodeMonitor, setNodeMonitor] = useState({});
    const navigate = useNavigate();

    const onEventToState = {
        "NodeStatusUpdated": setNodeStatus,
        "NodeMonitorUpdated": setNodeMonitor,
        "NodeStatsUpdated": setNodeStats,
    }
    useEffect(() => {
        const storedToken = localStorage.getItem("authToken");
        if (storedToken) {
            setToken(storedToken);
            fetchNodes(storedToken);
            createEventSource2("/sse", storedToken, onEventToState);
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("authToken");
        navigate("/login");
    };

    return (
        <Box
            sx={{
                minHeight: "100vh",
                bgcolor: "background.default",
                p: 3,
            }}
        >
            {/* Header with Logout */}
            <Box sx={{display: "flex", justifyContent: "flex-end", mb: 3}}>
                <Button
                    variant="contained"
                    color="error"
                    startIcon={<FaSignOutAlt/>}
                    onClick={handleLogout}
                    sx={{boxShadow: 3}}
                >
                    Logout
                </Button>
            </Box>

            {/* Main Content */}
            <Paper
                elevation={3}
                sx={{
                    p: 3,
                    borderRadius: 2,
                    bgcolor: "background.paper",
                }}
            >
                <Typography variant="h4" component="h1" gutterBottom align="center" sx={{mb: 4}}>
                    Node Status
                </Typography>

                {nodeStatus.length === 0 ? (
                    <Box sx={{display: "flex", justifyContent: "center", my: 4}}>
                        <CircularProgress/>
                    </Box>
                ) : (
                    <TableContainer component={Paper} elevation={0}>
                        <Table sx={{minWidth: 650}} aria-label="nodes table">
                            <TableHead>
                                <TableRow sx={{bgcolor: blue[500]}}>
                                    <TableCell sx={{color: "white", fontWeight: "bold"}}>Name</TableCell>
                                    <TableCell sx={{color: "white", fontWeight: "bold"}}>State</TableCell>
                                    <TableCell sx={{color: "white", fontWeight: "bold"}}>Score</TableCell>
                                    <TableCell sx={{color: "white", fontWeight: "bold"}}>Load (15m)</TableCell>
                                    <TableCell sx={{color: "white", fontWeight: "bold"}}>Mem Avail</TableCell>
                                    <TableCell sx={{color: "white", fontWeight: "bold"}}>Swap Avail</TableCell>
                                    <TableCell sx={{color: "white", fontWeight: "bold"}}>Version</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {Object.keys(nodeStatus).map((nodename, index) => {
                                    const stats = nodeStats[nodename]
                                    const status = nodeStatus[nodename]
                                    const monitor = nodeMonitor[nodename]
                                    return (
                                        <TableRow
                                            key={index}
                                            hover
                                            sx={{
                                                "&:last-child td, &:last-child th": {border: 0},
                                                transition: "background-color 0.2s",
                                            }}
                                        >
                                            <TableCell component="th" scope="row">
                                                {nodename || "-"}
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{display: "flex", gap: 1}}>
                                                    {monitor?.state && monitor?.state !== "idle" && (
                                                        monitor.state
                                                    )}
                                                    {status?.frozen_at && status?.frozen_at !== "0001-01-01T00:00:00Z" && (
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
                                                                stats?.load_15m > 4 ? "error" : stats?.load_15m > 2 ? "warning" : "success"
                                                            }
                                                        />
                                                    </>
                                                ) : (
                                                    "N/A"
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {stats?.mem_avail || "N/A"}%
                                                {stats?.mem_avail && (
                                                    <LinearProgress
                                                        variant="determinate"
                                                        value={stats?.mem_avail}
                                                        sx={{mt: 1, height: 4}}
                                                        color={
                                                            stats?.mem_avail < 20 ? "error" : stats?.mem_avail < 50 ? "warning" : "success"
                                                        }
                                                    />
                                                )}
                                            </TableCell>
                                            <TableCell>{stats?.swap_avail || "N/A"}%</TableCell>
                                            <TableCell>{status?.agent || "N/A"}</TableCell>
                                        </TableRow>
                                    )
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
