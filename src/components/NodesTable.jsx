import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useFetchDaemonStatus from "../hooks/useFetchDaemonStatus.jsx";
import { createEventSource } from "../eventSourceManager";
import { FaSnowflake, FaWifi, FaSignOutAlt } from "react-icons/fa";
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
import { blue, green, red } from "@mui/material/colors";

const NodesTable = () => {
    const { daemon, nodes, fetchNodes } = useFetchDaemonStatus();
    const [token, setToken] = useState("");
    const [eventNodes, setEventNodes] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const storedToken = localStorage.getItem("authToken");
        if (storedToken) {
            setToken(storedToken);
            fetchNodes(storedToken);
            createEventSource("/sse", storedToken, setEventNodes);
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("authToken");
        navigate("/login");
    };

    const mergedNodes = nodes.map((node) => {
        const updatedNode = eventNodes.find((n) => n.node === node.nodename);
        return updatedNode
            ? {
                ...node,
                status: {
                    ...node.status,
                    frozen_at: updatedNode.node_status?.frozen_at,
                },
            }
            : node;
    });

    return (
        <Box
            sx={{
                minHeight: "100vh",
                bgcolor: "background.default",
                p: 3,
            }}
        >
            {/* Header with Logout */}
            <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 3 }}>
                <Button
                    variant="contained"
                    color="error"
                    startIcon={<FaSignOutAlt />}
                    onClick={handleLogout}
                    sx={{ boxShadow: 3 }}
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
                <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 4 }}>
                    Node Status
                </Typography>

                {mergedNodes.length === 0 ? (
                    <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <TableContainer component={Paper} elevation={0}>
                        <Table sx={{ minWidth: 650 }} aria-label="nodes table">
                            <TableHead>
                                <TableRow sx={{ bgcolor: blue[500] }}>
                                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>Name</TableCell>
                                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>State</TableCell>
                                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>Score</TableCell>
                                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>Load (15m)</TableCell>
                                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>Mem Avail</TableCell>
                                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>Swap Avail</TableCell>
                                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>Version</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {mergedNodes.map((node, index) => (
                                    <TableRow
                                        key={index}
                                        hover
                                        sx={{
                                            "&:last-child td, &:last-child th": { border: 0 },
                                            transition: "background-color 0.2s",
                                        }}
                                    >
                                        <TableCell component="th" scope="row">
                                            {node.nodename || "-"}
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: "flex", gap: 1 }}>
                                                {daemon.nodename === node.nodename && (
                                                    <Tooltip title="Daemon Node">
                                                        <FaWifi style={{ color: green[500] }} />
                                                    </Tooltip>
                                                )}
                                                {node.status?.frozen_at && node.status.frozen_at !== "0001-01-01T00:00:00Z" && (
                                                    <Tooltip title="Frozen">
                                                        <FaSnowflake style={{ color: blue[200] }} />
                                                    </Tooltip>
                                                )}
                                            </Box>
                                        </TableCell>
                                        <TableCell>{node.stats?.score || "N/A"}</TableCell>
                                        <TableCell>
                                            {node.stats?.load_15m ? (
                                                <>
                                                    {node.stats.load_15m}
                                                    <LinearProgress
                                                        variant="determinate"
                                                        value={Math.min(node.stats.load_15m * 20, 100)}
                                                        sx={{ mt: 1, height: 4 }}
                                                        color={
                                                            node.stats.load_15m > 4 ? "error" : node.stats.load_15m > 2 ? "warning" : "success"
                                                        }
                                                    />
                                                </>
                                            ) : (
                                                "N/A"
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {node.stats?.mem_avail || "N/A"}%
                                            {node.stats?.mem_avail && (
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={node.stats.mem_avail}
                                                    sx={{ mt: 1, height: 4 }}
                                                    color={
                                                        node.stats.mem_avail < 20 ? "error" : node.stats.mem_avail < 50 ? "warning" : "success"
                                                    }
                                                />
                                            )}
                                        </TableCell>
                                        <TableCell>{node.stats?.swap_avail || "N/A"}%</TableCell>
                                        <TableCell>{node.status?.agent || "N/A"}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Paper>
        </Box>
    );
};

export default NodesTable;