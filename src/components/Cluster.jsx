import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Paper, Typography, Grid } from "@mui/material";
import useEventStore from "../store/useEventStore";
import useFetchDaemonStatus from "../hooks/useFetchDaemonStatus";

const ClusterOverview = () => {
    const navigate = useNavigate();
    const nodeStatus = useEventStore((state) => state.nodeStatus);
    const objectStatus = useEventStore((state) => state.objectStatus);
    const { fetchNodes, startEventReception } = useFetchDaemonStatus();

    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            fetchNodes(token);
            startEventReception(token);
        }
    }, []);

    const nodeCount = Object.keys(nodeStatus).length;

    const namespaces = new Set();
    Object.keys(objectStatus).forEach((objectPath) => {
        const parts = objectPath.split("/");
        if (parts.length === 3) {
            namespaces.add(parts[0]);
        }
    });
    const namespaceCount = namespaces.size;
    const objectCount = Object.keys(objectStatus).length;

    const StatCard = ({ title, value, onClick }) => (
        <Paper
            elevation={3}
            sx={{
                p: 3,
                borderRadius: 2,
                textAlign: 'center',
                cursor: 'pointer',
                '&:hover': {
                    boxShadow: 6,
                    transition: 'box-shadow 0.3s ease-in-out'
                }
            }}
            onClick={onClick}
        >
            <Typography variant="h6" gutterBottom>
                {title}
            </Typography>
            <Typography variant="h3" color="primary">
                {value}
            </Typography>
        </Paper>
    );

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
                Cluster Overview
            </Typography>

            <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                    <StatCard
                        title="Nodes"
                        value={nodeCount}
                        onClick={() => navigate("/nodes")}
                    />
                </Grid>
                <Grid item xs={12} md={4}>
                    <StatCard
                        title="Objects"
                        value={objectCount}
                        onClick={() => navigate("/objects")}
                    />
                </Grid>
                <Grid item xs={12} md={4}>
                    <StatCard
                        title="Namespaces"
                        value={namespaceCount}
                        onClick={() => navigate("/objects")}
                    />
                </Grid>
            </Grid>
        </Box>
    );
};

export default ClusterOverview;
