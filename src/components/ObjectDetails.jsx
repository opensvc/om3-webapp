import React from "react";
import {useParams} from "react-router-dom";
import {
    Box, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Typography, Tooltip, Divider
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
        <Box sx={{display: "flex", justifyContent: "center", px: 2, py: 4}}>
            <Box sx={{width: "100%", maxWidth: "1400px"}}>
                <Typography variant="h4" gutterBottom fontWeight="bold">
                    {decodedObjectName}
                </Typography>

                {globalStatus && (
                    <Paper elevation={2} sx={{p: 3, borderRadius: 3, mb: 4, backgroundColor: "#f9fafb"}}>
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                            <Typography variant="h6" fontWeight="medium" fontSize="1.3rem">
                                Global Status
                            </Typography>
                            <Box display="flex" alignItems="center" gap={2}>
                                <FiberManualRecordIcon sx={{color: getColor(globalStatus.avail), fontSize: "1.3rem"}}/>
                                {globalStatus.frozen === "frozen" && (
                                    <Tooltip title="Frozen">
                                        <AcUnitIcon fontSize="medium" sx={{color: blue[300]}}/>
                                    </Tooltip>
                                )}
                            </Box>
                        </Box>
                    </Paper>
                )}

                {Object.entries(objectData).map(([node, objectState]) => {
                    if (!objectState) return null;

                    const {avail, frozen_at, resources = {}} = objectState;
                    const isFrozen = frozen_at && frozen_at !== "0001-01-01T00:00:00Z";

                    return (
                        <Paper
                            key={node}
                            elevation={3}
                            sx={{
                                p: 3,
                                mb: 5,
                                borderRadius: 3,
                                backgroundColor: "#ffffff",
                                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)"
                            }}
                        >
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                <Typography variant="h6" fontWeight="medium" fontSize="1.25rem">
                                    Node: {node}
                                </Typography>
                                <Box display="flex" alignItems="center" gap={2}>
                                    <FiberManualRecordIcon sx={{color: getColor(avail), fontSize: "1.2rem"}}/>
                                    {isFrozen && (
                                        <Tooltip title="Frozen">
                                            <AcUnitIcon fontSize="medium" sx={{color: blue[300]}}/>
                                        </Tooltip>
                                    )}
                                </Box>
                            </Box>

                            <Divider sx={{mb: 2}}/>

                            <Typography variant="subtitle1" fontWeight="medium" mb={1} fontSize="1.1rem">
                                Resources
                            </Typography>

                            <TableContainer component={Paper} variant="outlined" sx={{borderRadius: 2}}>
                                <Table size="medium">
                                    <TableHead sx={{backgroundColor: "#f4f6f8"}}>
                                        <TableRow>
                                            <TableCell><strong>Name</strong></TableCell>
                                            <TableCell><strong>Label</strong></TableCell>
                                            <TableCell align="center"><strong>Status</strong></TableCell>
                                            <TableCell><strong>Type</strong></TableCell>
                                            <TableCell align="center"><strong>Provisioned</strong></TableCell>
                                            <TableCell><strong>Last Updated</strong></TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {Object.entries(resources).map(([resName, res]) => (
                                            <TableRow key={resName} hover>
                                                <TableCell>{resName}</TableCell>
                                                <TableCell>{res.label}</TableCell>
                                                <TableCell align="center">
                                                    <Box display="flex" justifyContent="center">
                                                        <FiberManualRecordIcon
                                                            sx={{color: getColor(res.status), fontSize: "1rem"}}
                                                        />
                                                    </Box>
                                                </TableCell>
                                                <TableCell>{res.type}</TableCell>
                                                <TableCell align="center">
                                                    <Box display="flex" justifyContent="center">
                                                        <FiberManualRecordIcon
                                                            sx={{
                                                                color: res.provisioned?.state ? green[500] : red[500],
                                                                fontSize: "1rem"
                                                            }}
                                                        />
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
        </Box>
    );
};

export default ObjectDetail;
