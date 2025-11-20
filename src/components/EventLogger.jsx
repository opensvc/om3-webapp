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
    Search,
    BugReport,
    Close,
    KeyboardArrowUp
} from "@mui/icons-material";
import useEventLogStore from "../hooks/useEventLogStore";

const EventLogger = ({
                         eventTypes = [],
                         objectName = null,
                         title = "Event Logger",
                         buttonLabel = "Events"
                     }) => {
    const theme = useTheme();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [eventTypeFilter, setEventTypeFilter] = useState([]);
    const [autoScroll, setAutoScroll] = useState(true);
    const [drawerHeight, setDrawerHeight] = useState(300);
    const [forceUpdate, setForceUpdate] = useState(0);

    const logsEndRef = useRef(null);
    const logsContainerRef = useRef(null);
    const resizeTimeoutRef = useRef(null);

    const {
        eventLogs,
        isPaused,
        setPaused,
        clearLogs
    } = useEventLogStore();

    const baseFilteredLogs = useMemo(() => {
        let filtered = eventLogs;

        if (eventTypes.length > 0) {
            filtered = filtered.filter(log => eventTypes.includes(log.eventType));
        }

        if (objectName) {
            filtered = filtered.filter(log => {
                if (log.eventType.includes('CONNECTION')) {
                    return true;
                }

                const eventData = log.data || {};

                if (eventData.path === objectName) {
                    return true;
                }

                if (eventData.labels?.path === objectName) {
                    return true;
                }
                if (eventData.data?.path === objectName) {
                    return true;
                }

                if (eventData.data?.labels?.path === objectName) {
                    return true;
                }

                if (log.eventType === 'ObjectDeleted') {
                    try {
                        const rawData = eventData._rawEvent ? JSON.parse(eventData._rawEvent) : {};
                        if (rawData.path === objectName || rawData.labels?.path === objectName) {
                            return true;
                        }
                    } catch (e) {}
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

        if (eventTypeFilter.length > 0) {
            result = result.filter(log => eventTypeFilter.includes(log.eventType));
        }

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            result = result.filter(log => {
                const eventTypeMatch = log.eventType.toLowerCase().includes(term);

                let dataMatch = false;
                try {
                    const dataString = JSON.stringify(log.data || {}).toLowerCase();
                    dataMatch = dataString.includes(term);
                } catch (error) {
                    console.warn("Error stringifying log data:", error);
                }

                return eventTypeMatch || dataMatch;
            });
        }

        return result;
    }, [baseFilteredLogs, eventTypeFilter, searchTerm]);


    useEffect(() => {
        setForceUpdate(prev => prev + 1);
    }, [eventLogs.length, drawerOpen]);

    useEffect(() => {
        if (autoScroll && logsEndRef.current && filteredLogs.length > 0 && drawerOpen) {
            const scrollToBottom = () => {
                if (logsEndRef.current) {
                    logsEndRef.current.scrollIntoView({
                        behavior: "smooth",
                        block: "end"
                    });
                }
            };

            requestAnimationFrame(() => {
                setTimeout(scrollToBottom, 100);
            });
        }
    }, [filteredLogs, autoScroll, drawerOpen]);

    const handleScroll = useCallback(() => {
        if (!logsContainerRef.current) return;

        const {scrollTop, scrollHeight, clientHeight} = logsContainerRef.current;
        const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;

        if (isAtBottom !== autoScroll) {
            setAutoScroll(isAtBottom);
        }
    }, [autoScroll]);

    const startResizing = useCallback((mouseDownEvent) => {
        mouseDownEvent.preventDefault();
        const startY = mouseDownEvent.clientY;
        const startHeight = drawerHeight;

        const handleMouseMove = (mouseMoveEvent) => {
            if (resizeTimeoutRef.current) {
                clearTimeout(resizeTimeoutRef.current);
            }

            resizeTimeoutRef.current = setTimeout(() => {
                const deltaY = startY - mouseMoveEvent.clientY;
                const newHeight = Math.max(200, Math.min(600, startHeight + deltaY));
                setDrawerHeight(newHeight);
            }, 16);
        };

        const handleMouseUp = () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            if (resizeTimeoutRef.current) {
                clearTimeout(resizeTimeoutRef.current);
            }
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
    }, [drawerHeight]);

    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            fractionalSecondDigits: 3,
        });
    };

    const getEventColor = (eventType) => {
        if (eventType.includes('ERROR')) return 'error';
        if (eventType.includes('UPDATED')) return 'primary';
        if (eventType.includes('DELETED')) return 'warning';
        if (eventType.includes('CONNECTION')) return 'info';
        return 'default';
    };

    const handleClear = useCallback(() => {
        clearLogs();
        setSearchTerm("");
        setEventTypeFilter([]);
        setForceUpdate(prev => prev + 1);
    }, [clearLogs]);

    const handleClearFilters = useCallback(() => {
        setSearchTerm("");
        setEventTypeFilter([]);
        setForceUpdate(prev => prev + 1);
    }, []);

    const handleEventTypeFilterChange = useCallback((event) => {
        setEventTypeFilter(event.target.value);
        setForceUpdate(prev => prev + 1);
    }, []);

    const handleSearchChange = useCallback((event) => {
        setSearchTerm(event.target.value);
    }, []);

    const handleTogglePause = useCallback(() => {
        setPaused(!isPaused);
        setForceUpdate(prev => prev + 1);
    }, [isPaused, setPaused]);

    useEffect(() => {
        return () => {
            if (resizeTimeoutRef.current) {
                clearTimeout(resizeTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        setAutoScroll(true);
    }, [eventTypeFilter, searchTerm]);

    return (
        <>
            {!drawerOpen && (
                <Tooltip title={title}>
                    <Button
                        variant="contained"
                        color="secondary"
                        startIcon={<BugReport/>}
                        onClick={() => setDrawerOpen(true)}
                        sx={{
                            position: 'fixed',
                            bottom: 16,
                            right: 16,
                            zIndex: 9999,
                            borderRadius: '20px',
                            minWidth: 'auto',
                            px: 2
                        }}
                    >
                        {buttonLabel}
                        {baseFilteredLogs.length > 0 && (
                            <Chip
                                label={baseFilteredLogs.length}
                                size="small"
                                color="primary"
                                sx={{ml: 1, height: 20, minWidth: 20}}
                            />
                        )}
                    </Button>
                </Tooltip>
            )}

            <Drawer
                anchor="bottom"
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                variant="persistent"
                sx={{
                    '& .MuiDrawer-paper': {
                        height: drawerHeight,
                        maxHeight: '70vh',
                        overflow: 'hidden',
                        borderTopLeftRadius: 8,
                        borderTopRightRadius: 8,
                        bgcolor: theme.palette.background.paper
                    }
                }}
            >
                <Box
                    sx={{
                        width: '100%',
                        height: 8,
                        bgcolor: 'grey.300',
                        cursor: 'row-resize',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        '&:hover': {
                            bgcolor: 'primary.main',
                        }
                    }}
                    onMouseDown={startResizing}
                >
                    <Box sx={{width: 40, height: 4, bgcolor: 'grey.500', borderRadius: 1}}/>
                </Box>

                {/* Header */}
                <Box sx={{p: 1, display: "flex", alignItems: "center", justifyContent: "space-between"}}>
                    <Box sx={{display: "flex", alignItems: "center", gap: 1}}>
                        <Typography variant="h6" sx={{fontSize: '1rem'}}>
                            {title}
                        </Typography>
                        <Chip
                            label={`${filteredLogs.length}/${baseFilteredLogs.length} events`}
                            size="small"
                            variant="outlined"
                        />
                        {isPaused && (
                            <Chip label="PAUSED" color="warning" size="small"/>
                        )}
                        {(eventTypeFilter.length > 0 || searchTerm) && (
                            <Chip
                                label="Filtered"
                                color="info"
                                size="small"
                                onDelete={handleClearFilters}
                            />
                        )}
                        {objectName && (
                            <Chip
                                label={`Object: ${objectName}`}
                                color="secondary"
                                size="small"
                                variant="outlined"
                            />
                        )}
                    </Box>

                    <Box sx={{display: "flex", gap: 0.5, alignItems: "center"}}>
                        <Tooltip title={isPaused ? "Resume" : "Pause"}>
                            <IconButton
                                onClick={handleTogglePause}
                                color={isPaused ? "warning" : "primary"}
                                size="small"
                            >
                                {isPaused ? <PlayArrow/> : <Pause/>}
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Clear logs">
                            <IconButton
                                onClick={handleClear}
                                size="small"
                                disabled={eventLogs.length === 0}
                            >
                                <DeleteOutline/>
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Close">
                            <IconButton onClick={() => setDrawerOpen(false)} size="small">
                                <Close/>
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>

                <Divider/>

                <Box sx={{p: 1, display: "flex", gap: 1, alignItems: "center", flexWrap: 'wrap'}}>
                    <TextField
                        size="small"
                        placeholder="Search events..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                        sx={{minWidth: 200, flexGrow: 1}}
                    />

                    {availableEventTypes.length > 0 && (
                        <FormControl size="small" sx={{minWidth: 200}}>
                            <InputLabel>Event Types</InputLabel>
                            <Select
                                multiple
                                value={eventTypeFilter}
                                onChange={handleEventTypeFilterChange}
                                label="Event Types"
                                renderValue={(selected) =>
                                    selected.length === 0 ? "All events" : `${selected.length} selected`
                                }
                            >
                                {availableEventTypes.map((eventType) => (
                                    <MenuItem key={eventType} value={eventType}>
                                        <Checkbox
                                            checked={eventTypeFilter.includes(eventType)}
                                            size="small"
                                        />
                                        <ListItemText
                                            primary={
                                                <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                                                    <Chip
                                                        label={eventStats[eventType] || 0}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{height: 20, minWidth: 20}}
                                                    />
                                                    {eventType}
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

                <Box
                    ref={logsContainerRef}
                    onScroll={handleScroll}
                    sx={{
                        flex: 1,
                        overflow: "auto",
                        bgcolor: theme.palette.grey[50],
                        p: 0,
                        position: 'relative'
                    }}
                >
                    {filteredLogs.length === 0 ? (
                        <Box sx={{p: 4, textAlign: "center"}}>
                            <Typography color="textSecondary">
                                {baseFilteredLogs.length === 0
                                    ? "No events logged"
                                    : eventTypeFilter.length > 0
                                        ? `No events match the selected types: ${eventTypeFilter.join(', ')}`
                                        : "No events match current filters"}
                            </Typography>
                        </Box>
                    ) : (
                        <>
                            {filteredLogs.map((log) => (
                                <Box
                                    key={log.id}
                                    sx={{
                                        py: 0.75,
                                        px: 2,
                                        borderBottom: `1px solid ${theme.palette.divider}`,
                                        '&:hover': {
                                            bgcolor: theme.palette.action.hover,
                                        },
                                        transition: "background-color 0.2s",
                                    }}
                                >
                                    <Box sx={{display: "flex", alignItems: "flex-start", gap: 2}}>
                                        {/* Colonne info compacte */}
                                        <Box sx={{minWidth: 200, flexShrink: 0}}>
                                            <Box sx={{display: "flex", alignItems: "center", gap: 1, mb: 0.5}}>
                                                <Chip
                                                    label={log.eventType}
                                                    size="small"
                                                    color={getEventColor(log.eventType)}
                                                    sx={{
                                                        height: 20,
                                                        fontSize: '0.7rem',
                                                        maxWidth: '180px'
                                                    }}
                                                />
                                            </Box>
                                            <Typography
                                                variant="caption"
                                                color="textSecondary"
                                                sx={{fontSize: '0.7rem'}}
                                            >
                                                {formatTimestamp(log.timestamp)}
                                            </Typography>
                                        </Box>

                                        <Box sx={{flex: 1, minWidth: 0}}>
                                            <Typography
                                                component="pre"
                                                sx={{
                                                    fontSize: '0.75rem',
                                                    margin: 0,
                                                    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word',
                                                    lineHeight: 1.4
                                                }}
                                            >
                                                {JSON.stringify(log.data, null, 2)}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>
                            ))}
                            <div ref={logsEndRef} style={{height: '1px'}}/>
                        </>
                    )}
                </Box>

                {!autoScroll && filteredLogs.length > 0 && (
                    <Box sx={{p: 1, borderTop: `1px solid ${theme.palette.divider}`, textAlign: 'center'}}>
                        <Button
                            size="small"
                            startIcon={<KeyboardArrowUp/>}
                            onClick={() => {
                                setAutoScroll(true);
                                setTimeout(() => {
                                    logsEndRef.current?.scrollIntoView({behavior: "smooth"});
                                }, 100);
                            }}
                        >
                            Scroll to bottom
                        </Button>
                    </Box>
                )}
            </Drawer>
        </>
    );
};

export default EventLogger;
