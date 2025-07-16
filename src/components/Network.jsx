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
    TableRow
} from "@mui/material";
import axios from "axios";
import {URL_NETWORK} from "../config/apiPath.js";

const Network = () => {
    const [networks, setNetworks] = useState([]);
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

                // Sort networks alphabetically by name
                const sortedNetworks = (res.data.items || []).sort((a, b) =>
                    a.name.localeCompare(b.name)
                );
                setNetworks(sortedNetworks);
            } catch (err) {
                console.error("Error retrieving networks", err);
            }
        };

        fetchNetworks();
    }, []);

    return (
        <Box sx={{p: 3, maxWidth: "1400px", mx: "auto"}}>
            <Typography variant="h4" gutterBottom sx={{mb: 3}} align="center">
                Networks
            </Typography>
            <TableContainer component={Paper} sx={{width: "100%"}}>
                <Table sx={{minWidth: 700}}>
                    <TableHead>
                        <TableRow>
                            <TableCell><strong>Name</strong></TableCell>
                            <TableCell><strong>Type</strong></TableCell>
                            <TableCell align="center"><strong>Network</strong></TableCell>
                            <TableCell align="center"><strong>Size</strong></TableCell>
                            <TableCell align="center"><strong>Free</strong></TableCell>
                            <TableCell align="center"><strong>Used</strong></TableCell>
                            <TableCell align="center"><strong>Usage</strong></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {networks.map((network) => {
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
                                        <Typography>
                                            {network.name}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>{network.type}</TableCell>
                                    <TableCell align="center">{network.network}</TableCell>
                                    <TableCell align="center">{network.size}</TableCell>
                                    <TableCell align="center">{network.free}</TableCell>
                                    <TableCell align="center">{network.used}</TableCell>
                                    <TableCell align="center">{usedPercentage}%</TableCell>
                                </TableRow>
                            );
                        })}
                        {networks.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} align="center">
                                    No networks available.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default Network;
