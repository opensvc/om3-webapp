import React from "react";
import {useParams} from "react-router-dom";
import {
    Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Typography, Tooltip
} from "@mui/material";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import {green, red, grey, blue} from "@mui/material/colors";
import useEventStore from "../store/useEventStore";

const ObjectDetail = () => {
    const {objectName} = useParams();
    const decodedObjectName = decodeURIComponent(objectName);

    const objectStatus = useEventStore((state) => state.objectInstanceStatus);
    const objectData = objectStatus?.[decodedObjectName];

    if (!objectData) {
        return (
            <Box p={4}>
                <Typography align="center" color="textSecondary" sx={{fontSize: '1.2rem'}}>
                    No information available for object <code>{decodedObjectName}</code>.
                </Typography>
            </Box>
        );
    }

    const getColor = (status) => {
        if (status === "up") return green[500];
        if (status === "down") return red[500];
        return grey[500];
    };

    return (
        <Box p={4}>
            <Typography variant="h4" gutterBottom sx={{fontSize: '2rem'}}>
                Object: <code>{decodedObjectName}</code>
            </Typography>

            {Object.entries(objectData).map(([node, objectState]) => {
                if (!objectState) return null;

                const {avail, frozen_at, resources = {}} = objectState;
                const isFrozen = frozen_at && frozen_at !== "0001-01-01T00:00:00Z";

                return (
                    <Paper key={node} elevation={2} sx={{p: 3, mb: 4}}>
                        <Typography variant="h6" gutterBottom sx={{fontSize: '1.5rem'}}>
                            Node: {node}
                        </Typography>

                        <Box display="flex" alignItems="center" gap={2} mb={2}>
                            <FiberManualRecordIcon sx={{color: getColor(avail)}}/>
                            <Typography variant="body1" sx={{fontSize: '1.2rem'}}>
                                Status: {avail || "unknown"}
                            </Typography>
                            {isFrozen && (
                                <Tooltip title="Frozen">
                                    <AcUnitIcon fontSize="small" sx={{color: blue[300]}}/>
                                </Tooltip>
                            )}
                        </Box>

                        <Typography variant="subtitle1" gutterBottom sx={{fontSize: '1.3rem'}}>
                            Resources
                        </Typography>

                        <TableContainer component={Paper}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{fontSize: '1.1rem'}}><strong>Name</strong></TableCell>
                                        <TableCell sx={{fontSize: '1.1rem'}}><strong>Label</strong></TableCell>
                                        <TableCell sx={{fontSize: '1.1rem'}}><strong>Status</strong></TableCell>
                                        <TableCell sx={{fontSize: '1.1rem'}}><strong>Type</strong></TableCell>
                                        <TableCell sx={{fontSize: '1.1rem'}}><strong>Provisioned</strong></TableCell>
                                        <TableCell sx={{fontSize: '1.1rem'}}><strong>Last Updated</strong></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {Object.entries(resources).map(([resName, res]) => (
                                        <TableRow key={resName}>
                                            <TableCell sx={{fontSize: '1rem'}}>{resName}</TableCell>
                                            <TableCell sx={{fontSize: '1rem'}}>{res.label}</TableCell>
                                            <TableCell sx={{fontSize: '1rem'}}>
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <FiberManualRecordIcon sx={{color: getColor(res.status)}}/>
                                                    {res.status}
                                                </Box>
                                            </TableCell>
                                            <TableCell sx={{fontSize: '1rem'}}>{res.type}</TableCell>
                                            <TableCell sx={{fontSize: '1rem'}}>
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <FiberManualRecordIcon
                                                        sx={{color: res.provisioned?.state ? green[500] : red[500]}}/>
                                                    {res.provisioned?.state ? "Yes" : "No"}
                                                </Box>
                                            </TableCell>
                                            <TableCell sx={{fontSize: '1rem'}}>{res.provisioned?.mtime}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                );
            })}
        </Box>
    );
};

export default ObjectDetail;
