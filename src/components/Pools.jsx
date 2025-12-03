import React, {useEffect, useState, useMemo} from "react";
import {
    Box,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    CircularProgress,
    Button,
    Alert
} from "@mui/material";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import axios from "axios";
import {URL_POOL} from "../config/apiPath.js";
import logger from '../utils/logger.js';

const Pools = () => {
    const [pools, setPools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sortColumn, setSortColumn] = useState("name");
    const [sortDirection, setSortDirection] = useState("asc");

    useEffect(() => {
        let isMounted = true;

        const fetchPools = async () => {
            try {
                setLoading(true);
                setError(null);
                const token = localStorage.getItem("authToken");
                const res = await axios.get(URL_POOL, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                const items = Array.isArray(res.data.items) ? res.data.items : [];
                if (isMounted) {
                    setPools(items);
                    setLoading(false);
                }
            } catch (err) {
                if (isMounted) {
                    setPools([]);
                    setError("Failed to load pools. Please try again.");
                    setLoading(false);
                }
                logger.error("Error retrieving pools", err);
            }
        };

        fetchPools();
        return () => {
            isMounted = false;
        };
    }, []);

    // Memoize sorted pools to optimize performance
    const sortedPools = useMemo(() => {
        return [...pools].sort((a, b) => {
            let diff = 0;
            if (sortColumn === "name") {
                diff = (a.name || '').localeCompare(b.name || '');
            } else if (sortColumn === "type") {
                diff = (a.type || '').localeCompare(b.type || '');
            } else if (sortColumn === "volume_count") {
                diff = (a.volume_count ?? 0) - (b.volume_count ?? 0);
            } else if (sortColumn === "usage") {
                const usedPercentageA = a.size && a.used >= 0 ? (a.used / a.size) * 100 : 0;
                const usedPercentageB = b.size && b.used >= 0 ? (b.used / b.size) * 100 : 0;
                diff = usedPercentageA - usedPercentageB;
            } else if (sortColumn === "head") {
                diff = (a.head || '').localeCompare(b.head || '');
            }
            return sortDirection === "asc" ? diff : -diff;
        });
    }, [pools, sortColumn, sortDirection]);

    const handleRetry = () => {
        setLoading(true);
        setError(null);
        setPools([]);
        const fetchPools = async () => {
            try {
                const token = localStorage.getItem("authToken");
                const res = await axios.get(URL_POOL, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                const items = Array.isArray(res.data.items) ? res.data.items : [];
                setPools(items);
                setLoading(false);
            } catch (err) {
                setPools([]);
                setError("Failed to load pools. Please try again.");
                setLoading(false);
                logger.error("Error retrieving pools", err);
            }
        };
        fetchPools();
    };

    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortColumn(column);
            setSortDirection("asc");
        }
    };

    return (
        <Box
            sx={{
                p: 0,
                width: '100vw',
                margin: 0,
                minHeight: '100vh',
                bgcolor: 'background.default',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start'
            }}
        >
            <Box
                sx={{
                    width: "100%",
                    bgcolor: "background.paper",
                    border: "2px solid",
                    borderColor: "divider",
                    borderRadius: 0,
                    boxShadow: 3,
                    p: 3,
                    m: 0,
                }}
            >
                
                {loading ? (
                    <Box sx={{display: 'flex', justifyContent: 'center', py: 4}}>
                        <CircularProgress/>
                    </Box>
                ) : error ? (
                    <Box sx={{maxWidth: '600px', mx: 'auto', mb: 3}}>
                        <Alert
                            severity="error"
                            action={
                                <Button color="inherit" size="small" onClick={handleRetry}>
                                    Retry
                                </Button>
                            }
                        >
                            {error}
                        </Alert>
                    </Box>
                ) : (
                    <TableContainer component={Paper} sx={{width: "100%"}}>
                        <Table sx={{minWidth: 700}} aria-label="pools table">
                            <TableHead>
                                <TableRow>
                                    <TableCell onClick={() => handleSort("name")} sx={{cursor: "pointer"}}>
                                        <Box sx={{display: "flex", alignItems: "center"}}>
                                            <strong>Name</strong>
                                            {sortColumn === "name" &&
                                                (sortDirection === "asc" ? <KeyboardArrowUpIcon/> :
                                                    <KeyboardArrowDownIcon/>)}
                                        </Box>
                                    </TableCell>
                                    <TableCell onClick={() => handleSort("type")} sx={{cursor: "pointer"}}>
                                        <Box sx={{display: "flex", alignItems: "center"}}>
                                            <strong>Type</strong>
                                            {sortColumn === "type" &&
                                                (sortDirection === "asc" ? <KeyboardArrowUpIcon/> :
                                                    <KeyboardArrowDownIcon/>)}
                                        </Box>
                                    </TableCell>
                                    <TableCell align="center" onClick={() => handleSort("volume_count")}
                                               sx={{cursor: "pointer"}}>
                                        <Box sx={{display: "flex", alignItems: "center", justifyContent: "center"}}>
                                            <strong>Volume Count</strong>
                                            {sortColumn === "volume_count" &&
                                                (sortDirection === "asc" ? <KeyboardArrowUpIcon/> :
                                                    <KeyboardArrowDownIcon/>)}
                                        </Box>
                                    </TableCell>
                                    <TableCell align="center" onClick={() => handleSort("usage")}
                                               sx={{cursor: "pointer"}}>
                                        <Box sx={{display: "flex", alignItems: "center", justifyContent: "center"}}>
                                            <strong>Usage</strong>
                                            {sortColumn === "usage" &&
                                                (sortDirection === "asc" ? <KeyboardArrowUpIcon/> :
                                                    <KeyboardArrowDownIcon/>)}
                                        </Box>
                                    </TableCell>
                                    <TableCell onClick={() => handleSort("head")} sx={{cursor: "pointer"}}>
                                        <Box sx={{display: "flex", alignItems: "center"}}>
                                            <strong>Head</strong>
                                            {sortColumn === "head" &&
                                                (sortDirection === "asc" ? <KeyboardArrowUpIcon/> :
                                                    <KeyboardArrowDownIcon/>)}
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {sortedPools.length > 0 ? (
                                    sortedPools.map((pool) => {
                                        const usedPercentage = pool.size && pool.used >= 0
                                            ? ((pool.used / pool.size) * 100).toFixed(1)
                                            : "N/A";
                                        return (
                                            <TableRow key={pool.name || Math.random()}>
                                                <TableCell>{pool.name || "N/A"}</TableCell>
                                                <TableCell>{pool.type || "N/A"}</TableCell>
                                                <TableCell align="center">{pool.volume_count ?? "N/A"}</TableCell>
                                                <TableCell align="center">{usedPercentage}%</TableCell>
                                                <TableCell>{pool.head || "N/A"}</TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} align="center" sx={{color: 'text.secondary'}}>
                                            No pools available.
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

export default Pools;
