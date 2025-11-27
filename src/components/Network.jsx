import React, {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
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
    LinearProgress,
    Tooltip
} from "@mui/material";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import axios from "axios";
import {URL_NETWORK} from "../config/apiPath.js";
import logger from '../utils/logger.js';

const Network = () => {
    const [networks, setNetworks] = useState([]);
    const [sortColumn, setSortColumn] = useState("name");
    const [sortDirection, setSortDirection] = useState("asc");
    const navigate = useNavigate();

    useEffect(() => {
        const fetchNetworks = async () => {
            try {
                const token = localStorage.getItem("authToken");
                const res = await axios.get(URL_NETWORK, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                setNetworks(res.data.items || []);
            } catch (err) {
                logger.error("Error retrieving networks", err);
            }
        };

        fetchNetworks();
    }, []);

    const sortedNetworks = React.useMemo(() => {
        return [...networks].sort((a, b) => {
            let diff = 0;
            if (sortColumn === "name") {
                diff = a.name.localeCompare(b.name);
            } else if (sortColumn === "type") {
                diff = a.type.localeCompare(b.type);
            } else if (sortColumn === "network") {
                diff = a.network.localeCompare(b.network);
            } else if (sortColumn === "usage") {
                const usedPercentageA = a.size ? (a.used / a.size) * 100 : 0;
                const usedPercentageB = b.size ? (b.used / b.size) * 100 : 0;
                diff = usedPercentageA - usedPercentageB;
            }
            return sortDirection === "asc" ? diff : -diff;
        });
    }, [networks, sortColumn, sortDirection]);

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
                <Typography variant="h4" gutterBottom sx={{mb: 3}} align="center">
                    Networks
                </Typography>
                <TableContainer component={Paper} sx={{width: "100%"}}>
                    <Table sx={{minWidth: 700}}>
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
                                <TableCell align="center" onClick={() => handleSort("network")}
                                           sx={{cursor: "pointer"}}>
                                    <Box sx={{display: "flex", alignItems: "center", justifyContent: "center"}}>
                                        <strong>Network</strong>
                                        {sortColumn === "network" &&
                                            (sortDirection === "asc" ? <KeyboardArrowUpIcon/> :
                                                <KeyboardArrowDownIcon/>)}
                                    </Box>
                                </TableCell>
                                <TableCell align="center" onClick={() => handleSort("usage")} sx={{cursor: "pointer"}}>
                                    <Box sx={{display: "flex", alignItems: "center", justifyContent: "center"}}>
                                        <strong>Usage</strong>
                                        {sortColumn === "usage" &&
                                            (sortDirection === "asc" ? <KeyboardArrowUpIcon/> :
                                                <KeyboardArrowDownIcon/>)}
                                    </Box>
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {sortedNetworks.map((network) => {
                                const usedPercentage = network.size
                                    ? ((network.used / network.size) * 100).toFixed(1)
                                    : "N/A";
                                return (
                                    <TableRow
                                        key={network.name}
                                        onClick={() => navigate(`/network/${network.name}`)}
                                        sx={{cursor: "pointer", "&:hover": {backgroundColor: "action.hover"}}}
                                    >
                                        <TableCell>
                                            <Typography>{network.name}</Typography>
                                        </TableCell>
                                        <TableCell>{network.type}</TableCell>
                                        <TableCell align="center">{network.network}</TableCell>
                                        <TableCell align="center">
                                            {usedPercentage === "N/A" ? (
                                                <Typography>N/A</Typography>
                                            ) : (
                                                <Tooltip title={`${network.used}/${network.size}`}>
                                                    <Box sx={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        alignItems: "center",
                                                        gap: 0.5
                                                    }}>
                                                        <Typography variant="body2">{usedPercentage}%</Typography>
                                                        <LinearProgress
                                                            variant="determinate"
                                                            value={Math.min(usedPercentage, 100)}
                                                            sx={{mt: 1, height: 4, width: "100%"}}
                                                            color={
                                                                usedPercentage > 80 ? "error" :
                                                                    usedPercentage > 50 ? "warning" : "success"
                                                            }
                                                        />
                                                    </Box>
                                                </Tooltip>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {sortedNetworks.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} align="center">
                                        No networks available.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>
        </Box>
    );
};

export default Network;
