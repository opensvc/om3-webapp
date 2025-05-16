import {
    Box,
    Checkbox,
    IconButton,
    LinearProgress,
    Menu,
    MenuItem,
    TableCell,
    TableRow,
    Tooltip
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import {
    FaSnowflake,
    FaPlay,
    FaSync,
    FaStop,
    FaBroom,
    FaTint,
    FaBox,
    FaHdd,
    FaPuzzlePiece,
    FaArchive,
    FaBrain,
    FaClipboardList,
    FaWifi
} from "react-icons/fa";
import {blue, green} from "@mui/material/colors";

const COLORS = {
    frozen: blue[200],
    daemon: green[500],
    error: "error",
    warning: "warning",
    success: "success"
};

const STYLES = {
    progress: {mt: 1, height: 4},
    flexBox: {display: "flex", gap: 1, alignItems: "center"}
};

const MENU_ITEMS = [
    {label: "Freeze", action: "action/freeze", icon: <FaSnowflake/>, condition: (isFrozen) => !isFrozen},
    {label: "Unfreeze", action: "action/unfreeze", icon: <FaPlay/>, condition: (isFrozen) => isFrozen},
    {label: "Restart Daemon", action: "daemon/action/restart", icon: <FaSync/>},
    {label: "Abort", action: "action/abort", icon: <FaStop/>},
    {label: "Clear", action: "action/clear", icon: <FaBroom/>},
    {label: "Drain", action: "action/drain", icon: <FaTint/>},
    {label: "Asset", action: "action/push/asset", icon: <FaBox/>},
    {label: "Disk", action: "action/push/disk", icon: <FaHdd/>},
    {label: "Patch", action: "action/push/patch", icon: <FaPuzzlePiece/>},
    {label: "Pkg", action: "action/push/pkg", icon: <FaArchive/>},
    {label: "Capabilities", action: "action/scan/capabilities", icon: <FaBrain/>},
    {label: "Sysreport", action: "action/sysreport", icon: <FaClipboardList/>}
];

const NodeRow = ({
                     nodename,
                     stats,
                     status,
                     monitor,
                     isSelected,
                     daemonNodename,
                     onSelect,
                     onMenuOpen,
                     onMenuClose,
                     onAction,
                     anchorEl
                 }) => {
    const isFrozen = !!status?.frozen_at && status.frozen_at !== "0001-01-01T00:00:00Z";
    console.log('NodeRow: isFrozen=', isFrozen, 'status=', status);
    const isDaemonNode = daemonNodename === nodename;
    const filteredMenuItems = MENU_ITEMS.filter(({ condition }) => condition === undefined || condition(isFrozen));
    console.log('Filtered Menu Items:', filteredMenuItems.map(item => item.label));

    return (
        <TableRow hover aria-label={`Node ${nodename} row`}>
            <TableCell>
                <Checkbox
                    checked={isSelected}
                    onChange={(e) => onSelect(e, nodename)}
                    inputProps={{ 'aria-label': `Select node ${nodename}` }}
                />
            </TableCell>
            <TableCell>{nodename || "-"}</TableCell>
            <TableCell>
                <Box sx={STYLES.flexBox}>
                    {monitor?.state !== "idle" && monitor?.state}
                    {isFrozen && (
                        <Tooltip title="Frozen">
                            <span aria-label="Frozen indicator"><FaSnowflake style={{color: COLORS.frozen}}/></span>
                        </Tooltip>
                    )}
                    {isDaemonNode && (
                        <Tooltip title="Daemon Node">
                            <span aria-label="Daemon node indicator"><FaWifi style={{color: COLORS.daemon}}/></span>
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
                                stats.load_15m > 4 ? COLORS.error :
                                    stats.load_15m > 2 ? COLORS.warning : COLORS.success
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
                                stats.mem_avail < 20 ? COLORS.error :
                                    stats.mem_avail < 50 ? COLORS.warning : COLORS.success
                            }
                        />
                    </>
                ) : "N/A"}
            </TableCell>
            <TableCell>{stats?.swap_avail || "N/A"}%</TableCell>
            <TableCell>{status?.agent || "N/A"}</TableCell>
            <TableCell>
                <IconButton
                    onClick={(e) => onMenuOpen(e, nodename)}
                    aria-label={`More actions for node ${nodename}`}
                >
                    <MoreVertIcon/>
                </IconButton>
                <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => onMenuClose(nodename)}>
                    {filteredMenuItems.map(({label, action, icon}) => (
                        <MenuItem
                            key={action}
                            onClick={() => {
                                onAction(nodename, action);
                                onMenuClose(nodename);
                            }}
                            sx={{display: "flex", alignItems: "center", gap: 1}}
                            aria-label={`${label} action`}
                        >
                            {icon && <Box sx={{minWidth: 20}}>{icon}</Box>}
                            {label}
                        </MenuItem>
                    ))}
                </Menu>
            </TableCell>
        </TableRow>
    );
};

export default NodeRow;