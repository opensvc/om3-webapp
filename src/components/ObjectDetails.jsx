import React from "react";
import {useParams} from "react-router-dom";
import {
    Box, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Typography, Tooltip
} from "@mui/material";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import {green, red, grey, blue} from "@mui/material/colors";
import useEventStore from "../store/useEventStore";

const ObjectDetail = () => {
    const {objectName} = useParams();
    const decodedObjectName = decodeURIComponent(objectName);

    const objectStatus = useEventStore((state) => state.objectStatus);
    const objectInstanceStatus = useEventStore((state) => state.objectInstanceStatus);

    const objectData = objectInstanceStatus?.[decodedObjectName];
    const globalStatus = objectStatus?.[decodedObjectName];

    const getColor = (status) => {
        if (status === "up" || status === true) return green[500];
        if (status === "down" || status === false) return red[500];
        return grey[500];
    };

    if (!objectData) {
        return (
            <Box p={4}>
                <Typography align="center" color="textSecondary" fontSize="1.2rem">
                    No information available for object <code>{decodedObjectName}</code>.
                </Typography>
            </Box>
        );
    }

    return (
        <Box p={4}>
            <Typography variant="h4" gutterBottom>
                Object: <code>{decodedObjectName}</code>
            </Typography>

            {globalStatus && (
                <Box display="flex" alignItems="center" gap={2} mb={4}>
                    <FiberManualRecordIcon sx={{color: getColor(globalStatus.avail)}}/>
                    <Typography fontSize="1.15rem">
                        Global Status: {globalStatus.avail || "unknown"}
                    </Typography>
                    {globalStatus.frozen === "frozen" && (
                        <Tooltip title="Frozen">
                            <AcUnitIcon fontSize="small" sx={{color: blue[300]}}/>
                        </Tooltip>
                    )}
                </Box>
            )}

            {Object.entries(objectData).map(([node, objectState]) => {
                if (!objectState) return null;

                const {avail, frozen_at, resources = {}} = objectState;
                const isFrozen = frozen_at && frozen_at !== "0001-01-01T00:00:00Z";

                return (
                    <Paper key={node} elevation={2} sx={{p: 3, mb: 4, borderRadius: 3}}>
                        <Typography variant="h6" gutterBottom>
                            Node: {node}
                        </Typography>

                        <Box display="flex" alignItems="center" gap={2} mb={2}>
                            <FiberManualRecordIcon sx={{color: getColor(avail)}}/>
                            <Typography fontSize="1.05rem">
                                Node Status: {avail || "unknown"}
                            </Typography>
                            {isFrozen && (
                                <Tooltip title="Frozen">
                                    <AcUnitIcon fontSize="small" sx={{color: blue[300]}}/>
                                </Tooltip>
                            )}
                        </Box>

                        <Typography variant="subtitle1" gutterBottom>
                            Resources
                        </Typography>

                        <TableContainer component={Paper}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell><strong>Name</strong></TableCell>
                                        <TableCell><strong>Label</strong></TableCell>
                                        <TableCell><strong>Status</strong></TableCell>
                                        <TableCell><strong>Type</strong></TableCell>
                                        <TableCell><strong>Provisioned</strong></TableCell>
                                        <TableCell><strong>Last Updated</strong></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {Object.entries(resources).map(([resName, res]) => (
                                        <TableRow key={resName}>
                                            <TableCell>{resName}</TableCell>
                                            <TableCell>{res.label}</TableCell>
                                            <TableCell>
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <FiberManualRecordIcon sx={{color: getColor(res.status)}}/>
                                                    {res.status}
                                                </Box>
                                            </TableCell>
                                            <TableCell>{res.type}</TableCell>
                                            <TableCell>
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <FiberManualRecordIcon
                                                        sx={{color: res.provisioned?.state ? green[500] : red[500]}}/>
                                                    {res.provisioned?.state ? "Yes" : "No"}
                                                </Box>
                                            </TableCell>
                                            <TableCell>{res.provisioned?.mtime}</TableCell>
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
