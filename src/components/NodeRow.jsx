import {
    Box, Checkbox, IconButton, LinearProgress, Menu, MenuItem, TableCell, TableRow, Tooltip
} from "@mui/material";
import {FaSnowflake, FaWifi} from "react-icons/fa";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import {blue, green} from "@mui/material/colors";
import React from "react";

const NodeRow = ({
                     nodename, stats, status, monitor, isSelected, daemonNodename,
                     onSelect, onMenuOpen, onMenuClose, onAction, anchorEl
                 }) => {
    const isFrozen = status?.frozen_at && status?.frozen_at !== "0001-01-01T00:00:00Z";

    return (
        <TableRow hover>
            <TableCell>
                <Checkbox
                    checked={isSelected}
                    onChange={(e) => onSelect(e, nodename)}
                />
            </TableCell>
            <TableCell>{nodename || "-"}</TableCell>
            <TableCell>
                <Box sx={{display: "flex", gap: 1}}>
                    {monitor?.state && monitor?.state !== "idle" && monitor.state}
                    {isFrozen && (
                        <Tooltip title="Frozen">
                            <span><FaSnowflake style={{color: blue[200]}}/></span>
                        </Tooltip>
                    )}
                    {daemonNodename === nodename && (
                        <Tooltip title="Daemon Node">
                            <span><FaWifi style={{color: green[500]}}/></span>
                        </Tooltip>
                    )}
                </Box>
            </TableCell>
            <TableCell>{stats?.score || "N/A"}</TableCell>
            <TableCell>
                {stats?.load_15m ? (
                    <>
                        {stats?.load_15m}
                        <LinearProgress
                            variant="determinate"
                            value={Math.min(stats?.load_15m * 20, 100)}
                            sx={{mt: 1, height: 4}}
                            color={
                                stats?.load_15m > 4
                                    ? "error"
                                    : stats?.load_15m > 2
                                        ? "warning"
                                        : "success"
                            }
                        />
                    </>
                ) : "N/A"}
            </TableCell>
            <TableCell>
                {stats?.mem_avail || "N/A"}%
                {stats?.mem_avail && (
                    <LinearProgress
                        variant="determinate"
                        value={stats?.mem_avail}
                        sx={{mt: 1, height: 4}}
                        color={
                            stats?.mem_avail < 20
                                ? "error"
                                : stats?.mem_avail < 50
                                    ? "warning"
                                    : "success"
                        }
                    />
                )}
            </TableCell>
            <TableCell>{stats?.swap_avail || "N/A"}%</TableCell>
            <TableCell>{status?.agent || "N/A"}</TableCell>
            <TableCell>
                <IconButton onClick={(e) => onMenuOpen(e, nodename)}>
                    <MoreVertIcon/>
                </IconButton>
                <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={() => onMenuClose(nodename)}
                >
                    {!isFrozen && (
                        <MenuItem onClick={() => onAction(nodename, "action/freeze")}>Freeze</MenuItem>
                    )}
                    {isFrozen && (
                        <MenuItem onClick={() => onAction(nodename, "action/unfreeze")}>Unfreeze</MenuItem>
                    )}
                    <MenuItem onClick={() => onAction(nodename, "daemon/action/restart")}>
                        Restart Daemon
                    </MenuItem>
                </Menu>
            </TableCell>
        </TableRow>
    );
};

export default NodeRow;
