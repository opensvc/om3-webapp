import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
    Box,
    Button,
    Checkbox,
    Chip,
    Divider,
    Drawer,
    FormControl,
    IconButton,
    InputLabel,
    ListItemText,
    MenuItem,
    Select,
    TextField,
    Tooltip,
    Typography,
    useTheme
} from "@mui/material";
import {
    BugReport,
    Close,
    DeleteOutline,
    ExpandMore,
    KeyboardArrowUp,
    Pause,
    PlayArrow,
    Settings
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
    const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
    const [subscribedEventTypes, setSubscribedEventTypes] = useState(eventTypes);

    const logsEndRef = useRef(null);
    const logsContainerRef = useRef(null);
    const resizeTimeoutRef = useRef(null);

    // Event logs store
    const {eventLogs = [], isPaused, setPaused, clearLogs} = useEventLogStore();

    const filterData = useCallback((data) => {
        if (!data || typeof data !== 'object') return data;

        const filtered = {...data};
        delete filtered._rawEvent;
        return filtered;
    }, []);

    // Toggle expand/collapse
    const toggleExpand = useCallback((id) => {
        setExpandedLogIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    }, []);

    const syntaxHighlightJSON = (json, dense = false) => {
        if (typeof json !== 'string') {
            try {
                json = JSON.stringify(json, null, dense ? 0 : 2);
            } catch {
                json = String(json);
            }
        }

        json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
            let cls = 'json-number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'json-key';
                } else {
                    cls = 'json-string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'json-boolean';
            } else if (/null/.test(match)) {
                cls = 'json-null';
            }
            return `<span class="${cls}">${match}</span>`;
        });
    };

    const JSONView = ({data, dense = false}) => {
        const filteredData = useMemo(() => filterData(data), [data, filterData]);

        const jsonString = useMemo(() => {
            try {
                return dense ? JSON.stringify(filteredData) : JSON.stringify(filteredData, null, 2);
            } catch {
                return String(filteredData);
            }
        }, [filteredData, dense]);

        const coloredJSON = useMemo(() => syntaxHighlightJSON(jsonString, dense), [jsonString, dense]);

        return (
            <pre
                style={{
                    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                    fontSize: dense ? "0.80rem" : "0.78rem",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    margin: 0,
                    lineHeight: dense ? 1.2 : 1.4,
                    opacity: dense ? 0.9 : 1,
                    maxHeight: dense ? 160 : 'none',
                    overflow: dense ? 'hidden' : 'visible'
                }}
                dangerouslySetInnerHTML={{__html: coloredJSON}}
            />
        );
    };

    const jsonStyles = {
        '& .json-key': {
            color: theme.palette.primary.main,
            fontWeight: '600'
        },
        '& .json-string': {
            color: theme.palette.success.dark
        },
        '& .json-number': {
            color: theme.palette.info.main,
            fontWeight: '500'
        },
        '& .json-boolean': {
            color: theme.palette.warning.dark,
            fontWeight: '600'
        },
        '& .json-null': {
            color: theme.palette.grey[500],
            fontWeight: '600'
        }
    };

    // Get all unique event types from received logs for the filter dropdown
    const allReceivedEventTypes = useMemo(() => {
        const types = new Set();
        eventLogs.forEach(log => types.add(log.eventType));
        return Array.from(types).sort();
    }, [eventLogs]);

    // Compute filtered logs based on eventTypes prop AND received events
    const baseFilteredLogs = useMemo(() => {
        let filtered = Array.isArray(eventLogs) ? eventLogs : [];

        // Filter by eventTypes prop if provided (this is the display filter)
        if (eventTypes.length > 0) {
            filtered = filtered.filter(log => eventTypes.includes(log.eventType));
        }

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
    }, [eventLogs, eventTypes, objectName]);

    // Available event types for the filter dropdown (from baseFilteredLogs)
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
                    const filteredData = filterData(log.data || {});
                    const dataString = JSON.stringify(filteredData).toLowerCase();
                    dataMatch = dataString.includes(term);
                } catch (err) {
                    logger.warn("Error serializing log data for search:", err);
                }
                return typeMatch || dataMatch;
            });
        }

        return result;
    }, [baseFilteredLogs, eventTypeFilter, searchTerm, filterData]);


    const SubscriptionDialog = () => (
        <Drawer
            anchor="right"
            open={subscriptionDialogOpen}
            onClose={() => setSubscriptionDialogOpen(false)}
            sx={{
                '& .MuiDrawer-paper': {
                    width: 400,
                    maxWidth: '90vw',
                    p: 2
                }
            }}
        >
            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
                <Typography variant="h6">Event Subscriptions</Typography>
                <IconButton onClick={() => setSubscriptionDialogOpen(false)}>
                    <Close/>
                </IconButton>
            </Box>

            <Divider sx={{mb: 2}}/>

            <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                Select which event types you want to SUBSCRIBE to (this affects future events only):
            </Typography>

            <Box sx={{mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap'}}>
                <Button
                    size="small"
                    onClick={() => setSubscribedEventTypes([...eventTypes])}
                    disabled={eventTypes.length === 0}
                >
                    Subscribe to All
                </Button>
                <Button
                    size="small"
                    onClick={() => setSubscribedEventTypes([])}
                >
                    Unsubscribe from All
                </Button>
                <Button
                    size="small"
                    onClick={() => setSubscribedEventTypes([...eventTypes])}
                >
                    Reset to Default
                </Button>
            </Box>

            <Box sx={{maxHeight: '60vh', overflow: 'auto'}}>
                {eventTypes.length === 0 ? (
                    <Typography color="text.secondary" sx={{textAlign: 'center', py: 4}}>
                        No event types available for this page
                    </Typography>
                ) : (
                    eventTypes.map(eventType => (
                        <Box key={eventType} sx={{display: 'flex', alignItems: 'center', py: 0.5}}>
                            <Checkbox
                                checked={subscribedEventTypes.includes(eventType)}
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        setSubscribedEventTypes(prev => [...prev, eventType]);
                                    } else {
                                        setSubscribedEventTypes(prev => prev.filter(et => et !== eventType));
                                    }
                                }}
                                size="small"
                            />
                            <Box sx={{flex: 1, minWidth: 0}}>
                                <Typography variant="body2" noWrap>
                                    {eventType}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {eventStats[eventType] || 0} events received
                                </Typography>
                            </Box>
                        </Box>
                    ))
                )}
            </Box>

            <Box sx={{mt: 'auto', pt: 2}}>
                <Button
                    fullWidth
                    variant="contained"
                    onClick={() => setSubscriptionDialogOpen(false)}
                >
                    Apply Subscriptions
                </Button>
            </Box>
        </Drawer>
    );

    // Subscription info component
    const SubscriptionInfo = () => {
        if (subscribedEventTypes.length === 0 && !objectName) {
            return null;
        }

        const subscriptionText = [
            subscribedEventTypes.length > 0 && `${subscribedEventTypes.length} event type(s)`,
            objectName && `object: ${objectName}`
        ].filter(Boolean).join(' • ');

        return (
            <Box sx={{px: 1, py: 0.5}}>
                <Tooltip title="Click to manage event subscriptions">
                    <Chip
                        label={`Subscribed to: ${subscriptionText}`}
                        size="small"
                        color="info"
                        variant="outlined"
                        sx={{height: 24, fontSize: '0.75rem'}}
                        onClick={() => setSubscriptionDialogOpen(true)}
                        onDelete={() => setSubscribedEventTypes([...eventTypes])}
                        deleteIcon={<Settings/>}
                    />
                </Tooltip>
            </Box>
        );
    };

    // Function to get current subscriptions for external use
    const getCurrentSubscriptions = useCallback(() => {
        return [...subscribedEventTypes];
    }, [subscribedEventTypes]);

    // Expose subscriptions via ref or other method if needed
    useEffect(() => {
        console.log("Subscriptions updated:", subscribedEventTypes);
    }, [subscribedEventTypes]);

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

                {/* Compact subscription info */}
                <SubscriptionInfo/>

                {/* Filters */}
                <Box sx={{p: 1, display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap"}}>
                    <TextField
                        size="small"
                        placeholder="Search events..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        sx={{minWidth: 240, flexGrow: 1}}
                    />
                    {allReceivedEventTypes.length > 0 && (
                        <FormControl size="small" sx={{minWidth: 240}}>
                            <InputLabel>Event Types</InputLabel>
                            <Select
                                multiple
                                value={eventTypeFilter}
                                onChange={(e) => setEventTypeFilter(e.target.value)}
                                label="Event Types"
                                renderValue={(selected) => (selected.length === 0 ? "All events" : `${selected.length} selected`)}
                            >
                                {allReceivedEventTypes.map((et) => (
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
                <Box
                    ref={logsContainerRef}
                    onScroll={handleScroll}
                    sx={{
                        flex: 1,
                        overflow: "auto",
                        backgroundColor: theme.palette.grey[50],
                        padding: 1,
                        ...jsonStyles
                    }}
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
                                            bgcolor: isOpen ? theme.palette.action.selected : "transparent",
                                            transition: "background-color 0.2s ease"
                                        }}
                                    >
                                        {/* Header */}
                                        <Box sx={{display: "flex", alignItems: "center", gap: 1, p: 1}}>
                                            <Chip
                                                label={log.eventType}
                                                size="small"
                                                color={getEventColor(log.eventType)}
                                                sx={{fontWeight: '600'}}
                                            />
                                            <Typography variant="caption"
                                                        color="textSecondary">{formatTimestamp(log.timestamp)}</Typography>
                                            <ExpandMore sx={{
                                                marginLeft: "auto",
                                                transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                                                transition: "0.2s",
                                                color: theme.palette.text.secondary
                                            }}/>
                                        </Box>

                                        {/* Preview when collapsed: dense JSON WITH COLORS */}
                                        {!isOpen && (
                                            <Box sx={{
                                                p: 1,
                                                maxHeight: 160,
                                                overflow: "hidden",
                                                backgroundColor: theme.palette.background.default,
                                                borderRadius: 1,
                                                mx: 0.5,
                                                mb: 0.5
                                            }}>
                                                <JSONView data={log.data} dense={true}/>
                                            </Box>
                                        )}

                                        {/* Full details when expanded: pretty JSON with colors */}
                                        {isOpen && (
                                            <Box sx={{
                                                p: 1,
                                                borderTop: `1px solid ${theme.palette.divider}`,
                                                backgroundColor: theme.palette.background.default,
                                                borderRadius: 1,
                                                mx: 0.5,
                                                mb: 0.5
                                            }}>
                                                <JSONView data={log.data} dense={false}/>
                                            </Box>
                                        )}
                                    </Box>
                                );
                            })}

                            <div ref={logsEndRef} style={{height: 2}}/>
                        </>
                    )}
                </Box>

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

            {/* Subscription Management Dialog */}
            <SubscriptionDialog/>

            <style>{`
                .json-key { color: ${theme.palette.primary.main}; font-weight: 600; }
                .json-string { color: ${theme.palette.success.dark}; }
                .json-number { color: ${theme.palette.info.main}; font-weight: 500; }
                .json-boolean { color: ${theme.palette.warning.dark}; font-weight: 600; }
                .json-null { color: ${theme.palette.grey[500]}; font-weight: 600; }
            `}</style>
        </>
    );
};

export default EventLogger;
