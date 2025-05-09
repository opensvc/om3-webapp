import {
    Box, Checkbox, IconButton, LinearProgress, Menu, MenuItem, TableCell, TableRow, Tooltip
} from "@mui/material";
import {FaSnowflake, FaWifi} from "react-icons/fa";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import {blue, green} from "@mui/material/colors";

// Constants for colors and styles
const COLORS = {
    frozen: blue[200],
    daemon: green[500],
    error: "error",
    warning: "warning",
    success: "success"
};

const STYLES = {
    progress: {mt: 1, height: 4},
    flexBox: {display: "flex", gap: 1}
};

// Menu items configuration
const MENU_ITEMS = [
    {label: "Freeze", action: "action/freeze", condition: (isFrozen) => !isFrozen},
    {label: "Unfreeze", action: "action/unfreeze", condition: (isFrozen) => isFrozen},
    {label: "Restart Daemon", action: "daemon/action/restart"},
    {label: "Abort", action: "action/abort"},
    {label: "Clear", action: "action/clear"},
    {label: "Drain", action: "action/drain"},
    {label: "Asset", action: "action/push/asset"},
    {label: "Disk", action: "action/push/disk"},
    {label: "Patch", action: "action/push/patch"},
    {label: "Pkg", action: "action/push/pkg"},
    {label: "Capabilities", action: "action/scan/capabilities"},
    {label: "Sysreport", action: "action/sysreport"}
];

const NodeRow = ({
                     nodename, stats, status, monitor, isSelected, daemonNodename,
                     onSelect, onMenuOpen, onMenuClose, onAction, anchorEl
                 }) => {
    const isFrozen = status?.frozen_at && status?.frozen_at !== "0001-01-01T00:00:00Z";
    const isDaemonNode = daemonNodename === nodename;

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
                <Box sx={STYLES.flexBox}>
                    {monitor?.state !== "idle" && monitor?.state}
                    {isFrozen && (
                        <Tooltip title="Frozen">
                            <span><FaSnowflake style={{color: COLORS.frozen}}/></span>
                        </Tooltip>
                    )}
                    {isDaemonNode && (
                        <Tooltip title="Daemon Node">
                            <span><FaWifi style={{color: COLORS.daemon}}/></span>
                        </Tooltip>
                    )}
                </Box>
            </TableCell>
            <TableCell>{stats?.score || "N/A"}</TableCell>
            <TableCell>
                {stats?.load_15m ? (
                    <>
                        {stats.load_15m}
                        <LinearProgress
                            variant="determinate"
                            value={Math.min(stats.load_15m * 20, 100)}
                            sx={STYLES.progress}
                            color={
                                stats.load_15m > 4
                                    ? COLORS.error
                                    : stats.load_15m > 2
                                        ? COLORS.warning
                                        : COLORS.success
                            }
                        />
                    </>
                ) : "N/A"}
            </TableCell>
            <TableCell>
                {stats?.mem_avail ? (
                    <>
                        {stats.mem_avail}%
                        <LinearProgress
                            variant="determinate"
                            value={stats.mem_avail}
                            sx={STYLES.progress}
                            color={
                                stats.mem_avail < 20
                                    ? COLORS.error
                                    : stats.mem_avail < 50
                                        ? COLORS.warning
                                        : COLORS.success
                            }
                        />
                    </>
                ) : "N/A"}
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
                    {MENU_ITEMS.map(({label, action, condition}) => (
                        condition === undefined || condition(isFrozen) ? (
                            <MenuItem
                                key={action}
                                onClick={() => onAction(nodename, action)}
                            >
                                {label}
                            </MenuItem>
                        ) : null
                    ))}
                </Menu>
            </TableCell>
        </TableRow>
    );
};

export default NodeRow;