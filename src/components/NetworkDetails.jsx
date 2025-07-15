import React, {useEffect, useState} from "react";
import {useParams} from "react-router-dom";
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
import {URL_NETWORK_IP} from "../config/apiPath.js";

const NetworkDetails = () => {
    const [ipDetails, setIpDetails] = useState([]);
    const {networkName} = useParams();

    useEffect(() => {
        const fetchIpDetails = async () => {
            try {
                const token = localStorage.getItem("authToken");
                const res = await axios.get(URL_NETWORK_IP, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                // Filter IPs by network name
                const filteredItems = (res.data.items || []).filter(
                    (item) => item.network.name === networkName
                );
                setIpDetails(filteredItems);
            } catch (err) {
                console.error("Error retrieving network IP details", err);
                setIpDetails([]);
            }
        };

        if (networkName) {
            fetchIpDetails();
        }
    }, [networkName]);

    return (
        <Box sx={{p: 3, maxWidth: "1400px", mx: "auto"}}>
            <Typography variant="h4" gutterBottom sx={{mb: 3}} align="center">
                Network Details: {networkName || "N/A"}
            </Typography>
            <TableContainer component={Paper} sx={{width: "100%"}}>
                <Table sx={{minWidth: 700}}>
                    <TableHead>
                        <TableRow>
                            <TableCell><strong>IP</strong></TableCell>
                            <TableCell><strong>Network</strong></TableCell>
                            <TableCell><strong>Type</strong></TableCell>
                            <TableCell align="center"><strong>Node</strong></TableCell>
                            <TableCell align="center"><strong>Path</strong></TableCell>
                            <TableCell align="center"><strong>RID</strong></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {ipDetails.map((detail) => (
                            <TableRow key={detail.rid}>
                                <TableCell>{detail.ip}</TableCell>
                                <TableCell>{detail.network.name}</TableCell>
                                <TableCell>{detail.network.type}</TableCell>
                                <TableCell align="center">{detail.node}</TableCell>
                                <TableCell align="center">{detail.path}</TableCell>
                                <TableCell align="center">{detail.rid}</TableCell>
                            </TableRow>
                        ))}
                        {ipDetails.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} align="center">
                                    No IP details available for this network.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default NetworkDetails;