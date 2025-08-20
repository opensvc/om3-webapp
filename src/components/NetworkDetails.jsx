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
    TableRow,
    TextField,
    Button,
    Collapse,
} from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import axios from "axios";
import {URL_NETWORK_IP} from "../config/apiPath.js";

const NetworkDetails = () => {
    const [ipDetails, setIpDetails] = useState([]);
    const [filteredIpDetails, setFilteredIpDetails] = useState([]);
    const [networkType, setNetworkType] = useState("N/A");
    const [nodeFilter, setNodeFilter] = useState("");
    const [pathFilter, setPathFilter] = useState("");
    const [ridFilter, setRidFilter] = useState("");
    const [showFilters, setShowFilters] = useState(true);
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
                    (item) => item.network?.name === networkName
                );

                console.log("Raw API response:", res.data.items);
                console.log("Filtered items for network:", filteredItems);
                setIpDetails(filteredItems);
                setFilteredIpDetails(filteredItems);
                setNetworkType(filteredItems.length > 0 ? filteredItems[0].network?.type || "N/A" : "N/A");
            } catch (err) {
                console.error("Error retrieving network IP details", err);
                setIpDetails([]);
                setFilteredIpDetails([]);
                setNetworkType("N/A");
            }
        };

        if (networkName) {
            fetchIpDetails();
        } else {
            setNetworkType("N/A");
            setIpDetails([]);
            setFilteredIpDetails([]);
        }
    }, [networkName]);

    useEffect(() => {
        // Apply filters to ipDetails with null checks
        const filtered = ipDetails.filter((detail) =>
            (nodeFilter === "" || (detail.node || "").toLowerCase().includes(nodeFilter.toLowerCase())) &&
            (pathFilter === "" || (detail.path || "").toLowerCase().includes(pathFilter.toLowerCase())) &&
            (ridFilter === "" || (detail.rid || "").toLowerCase().includes(ridFilter.toLowerCase()))
        );
        console.log("Applied filters:", {nodeFilter, pathFilter, ridFilter, filtered});
        setFilteredIpDetails(filtered);
    }, [ipDetails, nodeFilter, pathFilter, ridFilter]);

    return (
        <Box sx={{p: 3, maxWidth: "1400px", mx: "auto"}}>
            <Typography variant="h4" gutterBottom sx={{mb: 3}} align="center">
                Network Details: {networkName || "N/A"} ({networkType})
            </Typography>
            <Box
                sx={{
                    position: "sticky",
                    top: 64,
                    zIndex: 10,
                    backgroundColor: "background.paper",
                    pt: 2,
                    pb: 1,
                    mb: 2,
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
                        startIcon={showFilters ? <ExpandLessIcon/> : <ExpandMoreIcon/>}
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
                            onChange={(e) => setNodeFilter(e.target.value)}
                            sx={{minWidth: 200}}
                        />
                        <TextField
                            label="Path"
                            value={pathFilter}
                            onChange={(e) => setPathFilter(e.target.value)}
                            sx={{minWidth: 200}}
                        />
                        <TextField
                            label="RID"
                            value={ridFilter}
                            onChange={(e) => setRidFilter(e.target.value)}
                            sx={{minWidth: 200}}
                        />
                    </Box>
                </Collapse>
            </Box>
            <TableContainer component={Paper} sx={{width: "100%"}}>
                <Table sx={{minWidth: 700}}>
                    <TableHead>
                        <TableRow>
                            <TableCell><strong>IP</strong></TableCell>
                            <TableCell align="center"><strong>Node</strong></TableCell>
                            <TableCell align="center"><strong>Path</strong></TableCell>
                            <TableCell align="center"><strong>RID</strong></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredIpDetails.map((detail, index) => (
                            <TableRow key={`${detail.rid}-${index}`}>
                                <TableCell>{detail.ip || "N/A"}</TableCell>
                                <TableCell align="center">{detail.node || "N/A"}</TableCell>
                                <TableCell align="center">{detail.path || "N/A"}</TableCell>
                                <TableCell align="center">{detail.rid || "N/A"}</TableCell>
                            </TableRow>
                        ))}
                        {filteredIpDetails.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} align="center">
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
