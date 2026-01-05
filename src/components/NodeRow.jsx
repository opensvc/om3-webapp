import React, {useRef, useState} from "react";
import {
    Box,
    Checkbox,
    IconButton,
    LinearProgress,
    Menu,
    MenuItem,
    TableCell,
    TableRow,
    Tooltip,
    Typography,
    ListItemIcon,
    ListItemText,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ArticleIcon from "@mui/icons-material/Article";
import {Wifi, AcUnit} from "@mui/icons-material";
import {blue, green, red, orange} from "@mui/material/colors";
import {NODE_ACTIONS} from "../constants/actions";

const isSafari = () => /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

const COLORS = {
    frozen: blue[600],
    daemon: green[500],
    error: red[500],
    warning: orange[500],
    success: green[500],
};

const STYLES = {
    progress: {mt: 1, height: 4},
    flexBox: {display: "flex", gap: 0.5, alignItems: "center", justifyContent: "center"},
};

const formatDate = (dateString) => {
    if (!dateString || dateString === "0001-01-01T00:00:00Z") {
        return "-";
    }

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
};

const NodeRow = ({
                     nodename,
                     stats,
                     status,
                     monitor,
                     isSelected,
                     daemonNodename,
                     onSelect,
                     onMenuOpen,
                     onAction,
                     onMenuClose,
                     anchorEl,
                     onOpenLogs,
                 }) => {
    const menuAnchorRef = useRef(null);
    const [menuPosition, setMenuPosition] = useState({top: 0, left: 0});

    const isFrozen = !!status?.frozen_at && status.frozen_at !== "0001-01-01T00:00:00Z";
    const isDaemonNode = daemonNodename === nodename;
    const filteredMenuItems = NODE_ACTIONS.filter(({name}) => {
        if (name === "freeze" && isFrozen) return false;
        return !(name === "unfreeze" && !isFrozen);
    });

    const getZoomLevel = () => window.devicePixelRatio || 1;

    const calculateMenuPosition = () => {
        if (!menuAnchorRef.current) return;
        const zoomLevel = getZoomLevel();
        const rect = menuAnchorRef.current.getBoundingClientRect();
        const scrollY = window.scrollY ?? window.pageYOffset ?? 0;
        const scrollX = window.scrollX ?? window.pageXOffset ?? 0;
        setMenuPosition({
            top: (rect.bottom + scrollY) / zoomLevel,
            left: (rect.right + scrollX) / zoomLevel,
        });
    };

    const handleMenuOpen = (e) => {
        if (anchorEl) return;
        onMenuOpen(e, nodename);
        if (isSafari()) {
            setTimeout(() => {
                calculateMenuPosition();
            }, 0);
        }
    };

    const menuProps = {
        anchorOrigin: {vertical: "bottom", horizontal: "right"},
        transformOrigin: {vertical: "top", horizontal: "right"},
        sx: isSafari()
            ? {
                "& .MuiMenu-paper": {
                    position: "fixed",
                    top: `${menuPosition.top}px !important`,
                    left: `${menuPosition.left}px !important`,
                    transform: "translateX(-100%)",
                    boxShadow: "0px 5px 15px rgba(0,0,0,0.2)",
                    zIndex: 1300,
                },
            }
            : {},
    };

    return (
        <TableRow hover aria-label={`Node ${nodename} row`} sx={{cursor: "pointer"}}>
            <TableCell align="center" sx={{width: 50}}>
                <Checkbox
                    checked={isSelected}
                    onChange={(e) => onSelect(e, nodename)}
                    slotProps={{input: {"aria-label": `Select node ${nodename}`}}}
                    onClick={(e) => e.stopPropagation()}
                />
            </TableCell>
            <TableCell align="center">
                <Typography>{nodename || "-"}</Typography>
            </TableCell>
            <TableCell align="center">
                <Box sx={STYLES.flexBox}>
                    {monitor && monitor.state !== "idle" && (
                        <Typography variant="caption">{monitor.state}</Typography>
                    )}
                    {isFrozen && (
                        <AcUnit sx={{color: COLORS.frozen, ml: 0.5}} aria-label="Frozen indicator"/>
                    )}
                    {isDaemonNode && (
                        <Wifi sx={{color: COLORS.daemon, ml: 0.5}} aria-label="Daemon node indicator"/>
                    )}
                </Box>
            </TableCell>
            <TableCell align="center">
                <Typography>{stats?.score || "N/A"}</Typography>
            </TableCell>
            <TableCell align="center">
                {stats?.load_15m ? (
                    <Box>
                        <Typography>{stats.load_15m}</Typography>
                        <LinearProgress
                            variant="determinate"
                            value={Math.min(stats.load_15m * 20, 100)}
                            sx={STYLES.progress}
                            color={stats.load_15m > 4 ? "error" : stats.load_15m > 2 ? "warning" : "success"}
                        />
                    </Box>
                ) : (
                    <Typography>N/A</Typography>
                )}
            </TableCell>
            <TableCell align="center">
                {stats?.mem_avail ? (
                    <Box>
                        <Typography>{stats.mem_avail}%</Typography>
                        <LinearProgress
                            variant="determinate"
                            value={stats.mem_avail}
                            sx={STYLES.progress}
                            color={stats.mem_avail < 20 ? "error" : stats.mem_avail < 50 ? "warning" : "success"}
                        />
                    </Box>
                ) : (
                    <Typography>N/A</Typography>
                )}
            </TableCell>
            <TableCell align="center">
                <Typography>{stats?.swap_avail || "N/A"}%</Typography>
            </TableCell>
            <TableCell align="center">
                <Typography>{status?.agent || "N/A"}</Typography>
            </TableCell>
            <TableCell align="center">
                {status?.booted_at && status.booted_at !== "0001-01-01T00:00:00Z" ? (
                    <Tooltip title={new Date(status.booted_at).toLocaleString()}>
                        <Typography>
                            {formatDate(status.booted_at)}
                        </Typography>
                    </Tooltip>
                ) : (
                    <Typography>-</Typography>
                )}
            </TableCell>
            <TableCell align="center">
                <Tooltip title={monitor?.updated_at && monitor.updated_at !== "0001-01-01T00:00:00Z"
                    ? new Date(monitor.updated_at).toLocaleString()
                    : "-"}>
                    <Typography>
                        {formatDate(monitor?.updated_at)}
                    </Typography>
                </Tooltip>
            </TableCell>
            <TableCell align="center">
                <IconButton
                    onClick={handleMenuOpen}
                    aria-label={`More actions for node ${nodename}`}
                    ref={menuAnchorRef}
                >
                    <MoreVertIcon/>
                </IconButton>
                <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={() => onMenuClose(nodename)}
                    {...menuProps}
                >
                    {filteredMenuItems.map(({name, icon}) => (
                        <MenuItem
                            key={name}
                            onClick={(e) => {
                                e.stopPropagation();
                                onAction(nodename, name);
                                onMenuClose(nodename);
                            }}
                            sx={{display: "flex", alignItems: "center", gap: 1}}
                            aria-label={`${name} action`}
                        >
                            <ListItemIcon>{icon}</ListItemIcon>
                            <ListItemText>
                                {name
                                    .split(" ")
                                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                                    .join(" ")}
                            </ListItemText>
                        </MenuItem>
                    ))}
                </Menu>
            </TableCell>
            <TableCell align="center">
                <IconButton
                    onClick={() => onOpenLogs(nodename)}
                    color="primary"
                    aria-label={`View logs for node ${nodename}`}
                >
                    <ArticleIcon/>
                </IconButton>
            </TableCell>
        </TableRow>
    );
};

export default NodeRow;
