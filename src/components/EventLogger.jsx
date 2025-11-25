import React, {useEffect, useState, useRef, useCallback, useMemo} from "react";
import {
    Box,
    Typography,
    IconButton,
    TextField,
    Chip,
    Button,
    Tooltip,
    useTheme,
    Checkbox,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    ListItemText,
    Drawer,
    Divider
} from "@mui/material";
import {
    PlayArrow,
    Pause,
    DeleteOutline,
    BugReport,
    Close,
    KeyboardArrowUp,
    ExpandMore
} from "@mui/icons-material";
import useEventLogStore from "../hooks/useEventLogStore";
import logger from "../utils/logger.js";

const EventLogger = ({
                         eventTypes = [],
                         objectName = null,
                         title = "Event Logger",
                         buttonLabel = "Events"
                     }) => {
    const theme = useTheme();

    // UI state
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [eventTypeFilter, setEventTypeFilter] = useState([]);
    const [autoScroll, setAutoScroll] = useState(true);
    const [drawerHeight, setDrawerHeight] = useState(320);
    const [forceUpdate, setForceUpdate] = useState(0);
    const [expandedLogIds, setExpandedLogIds] = useState([]);

    const logsEndRef = useRef(null);
    const logsContainerRef = useRef(null);
    const resizeTimeoutRef = useRef(null);

    // Event logs store
    const {eventLogs = [], isPaused, setPaused, clearLogs} = useEventLogStore();

    // Toggle expand/collapse
    const toggleExpand = useCallback((id) => {
        setExpandedLogIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    }, []);

    // JSON preview dense (compact)
    const denseJSON = (data) => {
        try {
            return JSON.stringify(data);
        } catch {
            return String(data);
        }
    };

    // Compute filtered logs
    const baseFilteredLogs = useMemo(() => {
        const safeLogs = Array.isArray(eventLogs) ? eventLogs : [];
        let filtered = safeLogs;

        if (eventTypes.length > 0) filtered = filtered.filter(log => eventTypes.includes(log.eventType));

        if (objectName) {
            filtered = filtered.filter(log => {
                const data = log.data || {};
                if (log.eventType?.includes?.("CONNECTION")) return true;
                if (data.path === objectName) return true;
                if (data.labels?.path === objectName) return true;
                if (data.data?.path === objectName) return true;
                if (data.data?.labels?.path === objectName) return true;
                if (log.eventType === "ObjectDeleted") {
                    try {
                        const raw = data._rawEvent ? JSON.parse(data._rawEvent) : {};
                        if (raw.path === objectName || raw.labels?.path === objectName) return true;
                    } catch {
                    }
                }
                return false;
            });
        }

        return filtered;
    }, [eventLogs, eventTypes, objectName, forceUpdate]);

    const availableEventTypes = useMemo(() => {
        const types = new Set();
        baseFilteredLogs.forEach(log => types.add(log.eventType));
        return Array.from(types).sort();
    }, [baseFilteredLogs]);

    const eventStats = useMemo(() => {
        const stats = {};
        baseFilteredLogs.forEach(log => {
            stats[log.eventType] = (stats[log.eventType] || 0) + 1;
        });
        return stats;
    }, [baseFilteredLogs]);

    const filteredLogs = useMemo(() => {
        let result = [...baseFilteredLogs];

        if (eventTypeFilter.length > 0) result = result.filter(log => eventTypeFilter.includes(log.eventType));

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            result = result.filter(log => {
                const typeMatch = String(log.eventType || "").toLowerCase().includes(term);
                let dataMatch = false;
                try {
                    const dataString = JSON.stringify(log.data || {}).toLowerCase();
                    dataMatch = dataString.includes(term);
                } catch (err) {
                    logger.warn("Error serializing log data for search:", err);
                }
                return typeMatch || dataMatch;
            });
        }

        return result;
    }, [baseFilteredLogs, eventTypeFilter, searchTerm]);

    useEffect(() => {
        setForceUpdate(prev => prev + 1);
    }, [eventLogs.length, drawerOpen]);

    useEffect(() => {
        if (autoScroll && logsEndRef.current && filteredLogs.length > 0 && drawerOpen) {
            const scrollToBottom = () => logsEndRef.current?.scrollIntoView({behavior: "smooth", block: "end"});
            requestAnimationFrame(() => setTimeout(scrollToBottom, 100));
        }
    }, [filteredLogs, autoScroll, drawerOpen]);

    const handleScroll = useCallback(() => {
        if (!logsContainerRef.current) return;
        const {scrollTop, scrollHeight, clientHeight} = logsContainerRef.current;
        const atBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
        if (atBottom !== autoScroll) setAutoScroll(atBottom);
    }, [autoScroll]);

    const startResizing = useCallback((mouseDownEvent) => {
        if (mouseDownEvent?.preventDefault) mouseDownEvent.preventDefault();
        const startY = mouseDownEvent?.clientY ?? 0;
        const startHeight = drawerHeight;

        const handleMouseMove = (mouseMoveEvent) => {
            if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
            resizeTimeoutRef.current = setTimeout(() => {
                const deltaY = startY - (mouseMoveEvent?.clientY ?? startY);
                const newHeight = Math.max(220, Math.min(800, startHeight + deltaY));
                setDrawerHeight(newHeight);
            }, 16);
        };

        const handleMouseUp = () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
    }, [drawerHeight]);

    const formatTimestamp = (ts) => {
        try {
            return new Date(ts).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                fractionalSecondDigits: 3
            });
        } catch {
            return String(ts);
        }
    };

    const getEventColor = (eventType = "") => {
        if (eventType.includes("ERROR")) return "error";
        if (eventType.includes("UPDATED")) return "primary";
        if (eventType.includes("DELETED")) return "warning";
        if (eventType.includes("CONNECTION")) return "info";
        return "default";
    };

    const handleClear = useCallback(() => {
        clearLogs();
        setSearchTerm("");
        setEventTypeFilter([]);
        setExpandedLogIds([]);
    }, [clearLogs]);

    const handleClearFilters = useCallback(() => {
        setSearchTerm("");
        setEventTypeFilter([]);
    }, []);

    const paperStyle = {
        height: drawerHeight,
        maxHeight: "80vh",
        overflow: "hidden",
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        backgroundColor: theme.palette.background.paper
    };

    return (
        <>
            {!drawerOpen && (
                <Tooltip title={title}>
                    <Button
                        variant="contained"
                        color="primary.light"
                        startIcon={<BugReport/>}
                        onClick={() => setDrawerOpen(true)}
                        sx={{position: "fixed", bottom: 16, right: 16, zIndex: 9999, borderRadius: "20px", px: 2}}
                    >
                        {buttonLabel}
                        {baseFilteredLogs.length > 0 && (
                            <Chip label={baseFilteredLogs.length} size="small" color="primary"
                                  sx={{ml: 1, height: 20, minWidth: 20}}/>
                        )}
                    </Button>
                </Tooltip>
            )}

            <Drawer
                anchor="bottom"
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                variant="persistent"
                PaperProps={{style: paperStyle}}
            >
                {/* Resizer */}
                <div
                    onMouseDown={startResizing}
                    style={{
                        width: "100%",
                        height: 10,
                        backgroundColor: theme.palette.grey[300],
                        cursor: "row-resize",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    }}
                >
                    <div style={{width: 48, height: 6, backgroundColor: theme.palette.grey[500], borderRadius: 2}}/>
                </div>

                {/* Header */}
                <Box sx={{p: 1, display: "flex", alignItems: "center", justifyContent: "space-between"}}>
                    <Box sx={{display: "flex", alignItems: "center", gap: 1}}>
                        <Typography variant="h6" sx={{fontSize: "1rem"}}>{title}</Typography>
                        <Chip label={`${filteredLogs.length}/${baseFilteredLogs.length} events`} size="small"
                              variant="outlined"/>
                        {isPaused && <Chip label="PAUSED" color="warning" size="small"/>}
                        {(eventTypeFilter.length > 0 || searchTerm) &&
                            <Chip label="Filtered" color="info" size="small" onDelete={handleClearFilters}/>}
                        {objectName &&
                            <Chip label={`Object: ${objectName}`} color="secondary" size="small" variant="outlined"/>}
                    </Box>

                    <Box sx={{display: "flex", gap: 0.5, alignItems: "center"}}>
                        <Tooltip title={isPaused ? "Resume" : "Pause"}>
                            <IconButton onClick={() => setPaused(!isPaused)} color={isPaused ? "warning" : "primary"}
                                        size="small">
                                {isPaused ? <PlayArrow/> : <Pause/>}
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Clear logs">
                            <IconButton onClick={handleClear} size="small" disabled={eventLogs.length === 0}>
                                <DeleteOutline/>
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Close">
                            <IconButton onClick={() => setDrawerOpen(false)} size="small"><Close/></IconButton>
                        </Tooltip>
                    </Box>
                </Box>

                <Divider/>

                {/* Filters */}
                <Box sx={{p: 1, display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap"}}>
                    <TextField
                        size="small"
                        placeholder="Search events..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        sx={{minWidth: 240, flexGrow: 1}}
                    />
                    {availableEventTypes.length > 0 && (
                        <FormControl size="small" sx={{minWidth: 240}}>
                            <InputLabel>Event Types</InputLabel>
                            <Select
                                multiple
                                value={eventTypeFilter}
                                onChange={(e) => setEventTypeFilter(e.target.value)}
                                label="Event Types"
                                renderValue={(selected) => (selected.length === 0 ? "All events" : `${selected.length} selected`)}
                            >
                                {availableEventTypes.map((et) => (
                                    <MenuItem key={et} value={et}>
                                        <Checkbox checked={eventTypeFilter.includes(et)} size="small"/>
                                        <ListItemText
                                            primary={
                                                <Box sx={{display: "flex", alignItems: "center", gap: 1}}>
                                                    <Chip label={eventStats[et] || 0} size="small" variant="outlined"
                                                          sx={{height: 20, minWidth: 20}}/>
                                                    {et}
                                                </Box>
                                            }
                                        />
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}
                </Box>

                <Divider/>

                {/* Logs container */}
                <div
                    ref={logsContainerRef}
                    onScroll={handleScroll}
                    style={{flex: 1, overflow: "auto", backgroundColor: theme.palette.grey[50], padding: 8}}
                >
                    {filteredLogs.length === 0 ? (
                        <Box sx={{p: 4, textAlign: "center"}}>
                            <Typography color="textSecondary">
                                {eventLogs.length === 0
                                    ? "No events logged"
                                    : "No events match current filters"}
                            </Typography>
                        </Box>
                    ) : (
                        <>
                            {filteredLogs.map((log) => {
                                const safeId = log.id ?? Math.random().toString(36).slice(2, 9);
                                const isOpen = expandedLogIds.includes(safeId);

                                return (
                                    <Box
                                        key={safeId}
                                        onClick={() => toggleExpand(safeId)}
                                        sx={{
                                            cursor: "pointer",
                                            borderBottom: `1px solid ${theme.palette.divider}`,
                                            mb: 1,
                                            borderRadius: 1,
                                            "&:hover": {bgcolor: theme.palette.action.hover},
                                            bgcolor: isOpen ? theme.palette.action.selected : "transparent"
                                        }}
                                    >
                                        {/* Header */}
                                        <Box sx={{display: "flex", alignItems: "center", gap: 1, p: 1}}>
                                            <Chip label={log.eventType} size="small"
                                                  color={getEventColor(log.eventType)}/>
                                            <Typography variant="caption"
                                                        color="textSecondary">{formatTimestamp(log.timestamp)}</Typography>
                                            <ExpandMore sx={{
                                                marginLeft: "auto",
                                                transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                                                transition: "0.2s"
                                            }}/>
                                        </Box>

                                        {/* Preview when collapsed: dense JSON */}
                                        {!isOpen && (
                                            <Typography
                                                component="pre"
                                                sx={{
                                                    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                                                    fontSize: "0.80rem",
                                                    whiteSpace: "pre-wrap",
                                                    wordBreak: "break-word",
                                                    p: 1,
                                                    maxHeight: 160,
                                                    overflow: "hidden"
                                                }}
                                            >
                                                {denseJSON(log.data)}
                                            </Typography>
                                        )}

                                        {/* Full details when expanded: pretty JSON */}
                                        {isOpen && (
                                            <Typography
                                                component="pre"
                                                sx={{
                                                    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                                                    fontSize: "0.78rem",
                                                    whiteSpace: "pre-wrap",
                                                    wordBreak: "break-word",
                                                    p: 1
                                                }}
                                            >
                                                {JSON.stringify(log.data, null, 2)}
                                            </Typography>
                                        )}
                                    </Box>
                                );
                            })}

                            <div ref={logsEndRef} style={{height: 2}}/>
                        </>
                    )}
                </div>


                {!autoScroll && filteredLogs.length > 0 && (
                    <Box sx={{p: 1, borderTop: `1px solid ${theme.palette.divider}`, textAlign: "center"}}>
                        <Button size="small" startIcon={<KeyboardArrowUp/>} onClick={() => {
                            setAutoScroll(true);
                            setTimeout(() => logsEndRef.current?.scrollIntoView({behavior: "smooth"}), 100);
                        }}>
                            Scroll to bottom
                        </Button>
                    </Box>
                )}
            </Drawer>
        </>
    );
};

export default EventLogger;
