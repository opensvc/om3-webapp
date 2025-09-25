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
import axios from "axios";
import {URL_POOL} from "../config/apiPath.js";

const Pools = () => {
    const [pools, setPools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
                console.error("Error retrieving pools", err);
            }
        };

        fetchPools();
        return () => {
            isMounted = false;
        };
    }, []);

    // Memoize sorted pools to optimize performance
    const sortedPools = useMemo(() => {
        return [...pools].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [pools]);

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
                console.error("Error retrieving pools", err);
            }
        };
        fetchPools();
    };

    return (
        <Box sx={{p: 3, maxWidth: "1400px", mx: "auto"}}>
            <Typography variant="h4" gutterBottom sx={{mb: 3}} align="center">
                Pools
            </Typography>
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
                                <TableCell scope="col">Name</TableCell>
                                <TableCell scope="col">Type</TableCell>
                                <TableCell scope="col" align="center">Volume Count</TableCell>
                                <TableCell scope="col" align="center">Usage</TableCell>
                                <TableCell scope="col">Head</TableCell>
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
    );
};

export default Pools;
