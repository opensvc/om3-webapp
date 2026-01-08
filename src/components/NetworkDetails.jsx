import React, {useEffect, useState, useMemo, useRef} from "react";
import {useParams} from "react-router-dom";
import {
    Box,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Button,
    Collapse,
    CircularProgress,
    Alert,
} from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import axios from "axios";
import debounce from "lodash.debounce";
import {URL_NETWORK_IP} from "../config/apiPath.js";
import logger from '../utils/logger.js';

const NetworkDetails = () => {
    const [ipDetails, setIpDetails] = useState([]);
    const [networkType, setNetworkType] = useState("N/A");
    const [nodeFilter, setNodeFilter] = useState("");
    const [pathFilter, setPathFilter] = useState("");
    const [ridFilter, setRidFilter] = useState("");
    const [showFilters, setShowFilters] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const {networkName} = useParams();
    const containerRef = useRef(null);

    // Scroll to top on component mount and when networkName changes
    useEffect(() => {
        window.scrollTo(0, 0);
        if (containerRef.current) {
            containerRef.current.scrollTop = 0;
        }
    }, [networkName]);

    useEffect(() => {
        let isMounted = true;
        const fetchIpDetails = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const token = localStorage.getItem("authToken");
                const res = await axios.get(URL_NETWORK_IP, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                const filteredItems = (res.data.items || []).filter(
                    (item) => item.network?.name === networkName
                );
                if (isMounted) {
                    setIpDetails(filteredItems);
                    setNetworkType(
                        filteredItems.length > 0
                            ? filteredItems[0].network?.type || "N/A"
                            : "N/A"
                    );
                }
            } catch (err) {
                logger.error("Error retrieving network IP details", err);
                if (isMounted) {
                    setError("Failed to load network details. Please try again.");
                    setIpDetails([]);
                    setNetworkType("N/A");
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        if (networkName) {
            fetchIpDetails();
        } else {
            setNetworkType("N/A");
            setIpDetails([]);
            setIsLoading(false);
        }

        return () => {
            isMounted = false;
        };
    }, [networkName]);

    // Debounced filter handlers
    const debouncedSetNodeFilter = useMemo(
        () => debounce((value) => setNodeFilter(value), 300),
        []
    );
    const debouncedSetPathFilter = useMemo(
        () => debounce((value) => setPathFilter(value), 300),
        []
    );
    const debouncedSetRidFilter = useMemo(
        () => debounce((value) => setRidFilter(value), 300),
        []
    );

    // Clean up debounced functions on unmount
    useEffect(() => {
        return () => {
            debouncedSetNodeFilter.cancel();
            debouncedSetPathFilter.cancel();
            debouncedSetRidFilter.cancel();
        };
    }, [debouncedSetNodeFilter, debouncedSetPathFilter, debouncedSetRidFilter]);

    const filteredIpDetails = useMemo(() => {
        return ipDetails.filter(
            (detail) =>
                (nodeFilter === "" ||
                    (detail.node || "")
                        .toLowerCase()
                        .includes(nodeFilter.toLowerCase())) &&
                (pathFilter === "" ||
                    (detail.path || "")
                        .toLowerCase()
                        .includes(pathFilter.toLowerCase())) &&
                (ridFilter === "" ||
                    (detail.rid || "")
                        .toLowerCase()
                        .includes(ridFilter.toLowerCase()))
        );
    }, [ipDetails, nodeFilter, pathFilter, ridFilter]);

    return (
        <Box
            sx={{
                height: "100vh",
                bgcolor: 'background.default',
                display: 'flex',
                flexDirection: 'column',
                p: 0,
                width: '100vw',
                margin: 0,
                overflow: 'hidden',
            }}
        >
            <Box
                ref={containerRef}
                sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    bgcolor: "background.paper",
                    border: "2px solid",
                    borderColor: "divider",
                    borderRadius: 0,
                    boxShadow: 3,
                    p: 3,
                    m: 0,
                    overflow: 'hidden',
                }}
            >
                <Typography
                    variant="h4"
                    gutterBottom
                    sx={{mb: 3, flexShrink: 0}}
                    align="center"
                >
                    Network Details: {networkName || "N/A"} ({networkType})
                </Typography>
                {error && (
                    <Alert severity="error" sx={{mb: 2, flexShrink: 0}}>
                        {error}
                    </Alert>
                )}
                <Box
                    sx={{
                        position: "sticky",
                        top: 64,
                        zIndex: 10,
                        backgroundColor: "background.paper",
                        pt: 2,
                        pb: 1,
                        mb: 2,
                        flexShrink: 0,
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            mb: 1,
                        }}
                    >
                        <Button
                            onClick={() => setShowFilters(!showFilters)}
                            startIcon={
                                showFilters ? <ExpandLessIcon/> : <ExpandMoreIcon/>
                            }
                            aria-label={showFilters ? "Hide filters" : "Show filters"}
                        >
                            {showFilters ? "Hide filters" : "Show filters"}
                        </Button>
                    </Box>
                    <Collapse in={showFilters} timeout="auto" unmountOnExit>
                        <Box
                            sx={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 2,
                                alignItems: "center",
                                pb: 2,
                            }}
                        >
                            <TextField
                                label="Node"
                                value={nodeFilter}
                                onChange={(e) => debouncedSetNodeFilter(e.target.value)}
                                sx={{minWidth: 200}}
                            />
                            <TextField
                                label="Path"
                                value={pathFilter}
                                onChange={(e) => debouncedSetPathFilter(e.target.value)}
                                sx={{minWidth: 200}}
                            />
                            <TextField
                                label="RID"
                                value={ridFilter}
                                onChange={(e) => debouncedSetRidFilter(e.target.value)}
                                sx={{minWidth: 200}}
                            />
                        </Box>
                    </Collapse>
                </Box>
                {isLoading ? (
                    <Box sx={{display: "flex", justifyContent: "center", my: 4, flex: 1}}>
                        <CircularProgress aria-label="Loading network details"/>
                    </Box>
                ) : (
                    <TableContainer
                        sx={{
                            flex: 1,
                            minHeight: 0,
                            overflow: "auto",
                            width: "100%"
                        }}
                    >
                        <Table sx={{minWidth: 700}} aria-label="Network details table">
                            <TableHead>
                                <TableRow>
                                    <TableCell scope="col">
                                        <strong>IP</strong>
                                    </TableCell>
                                    <TableCell align="center" scope="col">
                                        <strong>Node</strong>
                                    </TableCell>
                                    <TableCell align="center" scope="col">
                                        <strong>Path</strong>
                                    </TableCell>
                                    <TableCell align="center" scope="col">
                                        <strong>RID</strong>
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredIpDetails.length > 0 ? (
                                    filteredIpDetails.map((detail, index) => (
                                        <TableRow key={`${detail.rid}-${index}`}>
                                            <TableCell>{detail.ip || "N/A"}</TableCell>
                                            <TableCell align="center">
                                                {detail.node || "N/A"}
                                            </TableCell>
                                            <TableCell align="center">
                                                {detail.path || "N/A"}
                                            </TableCell>
                                            <TableCell align="center">
                                                {detail.rid || "N/A"}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell
                                            colSpan={4}
                                            align="center"
                                            sx={{color: "text.secondary"}}
                                        >
                                            No IP details available for this network.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>
        </Box>
    );
};

export default NetworkDetails;
