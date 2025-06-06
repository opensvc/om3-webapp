import React, {useEffect, useState} from "react";
import {
    Box,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow
} from "@mui/material";
import axios from "axios";
import {URL_POOL} from "../config/apiPath.js";

const Pools = () => {
    const [pools, setPools] = useState([]);

    useEffect(() => {
        const fetchPools = async () => {
            try {
                const token = localStorage.getItem("authToken");
                const res = await axios.get(URL_POOL, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                setPools(res.data.items || []);
            } catch (err) {
                console.error("Erreur lors de la récupération des pools", err);
            }
        };

        fetchPools();
    }, []);

    return (
        <Box sx={{p: 3, maxWidth: "1400px", mx: "auto"}}>
            <Typography variant="h4" gutterBottom sx={{mb: 3}} align="center">
                Pools
            </Typography>
            <TableContainer component={Paper} sx={{width: "100%"}}>
                <Table sx={{minWidth: 700}}>
                    <TableHead>
                        <TableRow>
                            <TableCell><strong>Name</strong></TableCell>
                            <TableCell><strong>Type</strong></TableCell>
                            <TableCell align="center"><strong>Volume Count</strong></TableCell>
                            <TableCell align="center"><strong>Usage</strong></TableCell>
                            <TableCell><strong>Head</strong></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {pools.map((pool) => {
                            const usedPercentage = pool.size
                                ? ((pool.used / pool.size) * 100).toFixed(1)
                                : "N/A";
                            return (
                                <TableRow key={pool.name}>
                                    <TableCell>{pool.name}</TableCell>
                                    <TableCell>{pool.type}</TableCell>
                                    <TableCell align="center">{pool.volume_count}</TableCell>
                                    <TableCell align="center">{usedPercentage}%</TableCell>
                                    <TableCell>{pool.head}</TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default Pools;
