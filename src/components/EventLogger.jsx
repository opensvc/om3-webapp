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
import {startLoggerReception, closeLoggerEventSource} from "../eventSourceManager";

const CONNECTION_EVENTS = [
    'CONNECTION_OPENED',
    'CONNECTION_ERROR',
    'RECONNECTION_ATTEMPT',
    'MAX_RECONNECTIONS_REACHED',
    'CONNECTION_CLOSED'
];

const EventLogger = ({
                         eventTypes = [],
                         objectName = null,
                         title = "Event Logger",
                         buttonLabel = "Events"
                     }) => {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';

    // UI state
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [eventTypeFilter, setEventTypeFilter] = useState([]);
    const [autoScroll, setAutoScroll] = useState(true);
    const [drawerHeight, setDrawerHeight] = useState(320);
    const [forceUpdate, setForceUpdate] = useState(0);
    const [expandedLogIds, setExpandedLogIds] = useState([]);
    const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);

    const filteredEventTypes = useMemo(() => {
        return eventTypes.filter(et => !CONNECTION_EVENTS.includes(et));
    }, [eventTypes]);

    const [subscribedEventTypes, setSubscribedEventTypes] = useState(filteredEventTypes);

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

    const escapeHtml = useCallback((text) => {
        if (typeof text !== 'string') return text;
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }, []);

    const createHighlightedHtml = useCallback((text, searchTerm) => {
        if (!searchTerm || !text) return escapeHtml(text);

        const term = searchTerm.toLowerCase();
        const lowerText = text.toLowerCase();
        let lastIndex = 0;
        const parts = [];

        while (lastIndex < text.length) {
            const index = lowerText.indexOf(term, lastIndex);
            if (index === -1) {
                parts.push(escapeHtml(text.substring(lastIndex)));
                break;
            }

            if (index > lastIndex) {
                parts.push(escapeHtml(text.substring(lastIndex, index)));
            }

            parts.push(
                `<span class="search-highlight">${escapeHtml(text.substring(index, index + term.length))}</span>`
            );

            lastIndex = index + term.length;
        }

        return parts.join('');
    }, [escapeHtml]);

    // Toggle expand/collapse
    const toggleExpand = useCallback((id) => {
        setExpandedLogIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    }, []);

    const syntaxHighlightJSON = (json, dense = false, searchTerm = '') => {
        if (typeof json !== 'string') {
            try {
                json = JSON.stringify(json, null, dense ? 0 : 2);
            } catch {
                json = String(json);
            }
        }

        json = escapeHtml(json);

        const applyHighlightToMatch = (match, searchTerm) => {
            if (!searchTerm) return match;

            const term = searchTerm.toLowerCase();
            const lowerMatch = match.toLowerCase();
            const index = lowerMatch.indexOf(term);

            if (index === -1) return match;

            const before = match.substring(0, index);
            const highlight = match.substring(index, index + term.length);
            const after = match.substring(index + term.length);

            return `${before}<span class="search-highlight">${highlight}</span>${after}`;
        };

        return json.replace(
            /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
            (match) => {
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

                const highlightedMatch = searchTerm ? applyHighlightToMatch(match, searchTerm) : match;

                return `<span class="${cls}">${highlightedMatch}</span>`;
            }
        );
    };

    const JSONView = ({data, dense = false, searchTerm = ''}) => {
        const filteredData = useMemo(() => filterData(data), [data, filterData]);

        const jsonString = useMemo(() => {
            try {
                return dense ? JSON.stringify(filteredData) : JSON.stringify(filteredData, null, 2);
            } catch {
                return String(filteredData);
            }
        }, [filteredData, dense]);

        const coloredJSON = useMemo(() => syntaxHighlightJSON(jsonString, dense, searchTerm), [jsonString, dense, searchTerm]);

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
                    overflow: dense ? 'hidden' : 'visible',
                    backgroundColor: 'transparent',
                    color: isDarkMode ? '#ffffff' : theme.palette.text.primary
                }}
                dangerouslySetInnerHTML={{__html: coloredJSON}}
            />
        );
    };

    const jsonStyles = {
        '& .json-key': {
            color: isDarkMode ? '#90caf9' : theme.palette.primary.main,
            fontWeight: '600'
        },
        '& .json-string': {
            color: isDarkMode ? '#a5d6a7' : theme.palette.success.dark
        },
        '& .json-number': {
            color: isDarkMode ? '#80cbc4' : theme.palette.info.main,
            fontWeight: '500'
        },
        '& .json-boolean': {
            color: isDarkMode ? '#ffcc80' : theme.palette.warning.dark,
            fontWeight: '600'
        },
        '& .json-null': {
            color: isDarkMode ? theme.palette.grey[400] : theme.palette.grey[500],
            fontWeight: '600'
        }
    };

    // Compute filtered logs based on filteredEventTypes prop AND received events
    const baseFilteredLogs = useMemo(() => {
        let filtered = Array.isArray(eventLogs) ? eventLogs : [];
        filtered = filtered.filter(log => !CONNECTION_EVENTS.includes(log.eventType));

        // Filter by filteredEventTypes prop if provided (this is the display filter)
        if (filteredEventTypes.length > 0) {
            filtered = filtered.filter(log => filteredEventTypes.includes(log.eventType));
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
    }, [eventLogs, filteredEventTypes, objectName]);

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


    const SubscriptionDialog = () => {
        const [tempSubscribedEventTypes, setTempSubscribedEventTypes] = useState(subscribedEventTypes);

        return (
            <Drawer
                anchor="right"
                open={subscriptionDialogOpen}
                onClose={() => setSubscriptionDialogOpen(false)}
                sx={{
                    '& .MuiDrawer-paper': {
                        width: 400,
                        maxWidth: '90vw',
                        p: 2,
                        backgroundColor: isDarkMode ? theme.palette.background.paper : '#ffffff'
                    }
                }}
            >
                <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
                    <Typography variant="h6" color={isDarkMode ? '#ffffff' : 'inherit'}>
                        Event Subscriptions
                    </Typography>
                    <IconButton onClick={() => setSubscriptionDialogOpen(false)}>
                        <Close sx={{color: isDarkMode ? '#ffffff' : 'inherit'}}/>
                    </IconButton>
                </Box>

                <Divider sx={{mb: 2, backgroundColor: isDarkMode ? theme.palette.divider : undefined}}/>

                <Typography variant="body2" color={isDarkMode ? '#cccccc' : 'text.secondary'} sx={{mb: 2}}>
                    Select which event types you want to SUBSCRIBE to (this affects future events only):
                </Typography>

                <Box sx={{mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap'}}>
                    <Button
                        size="small"
                        onClick={() => setTempSubscribedEventTypes([...filteredEventTypes])}
                        disabled={filteredEventTypes.length === 0}
                        sx={{
                            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : undefined,
                            color: isDarkMode ? '#ffffff' : undefined
                        }}
                    >
                        Subscribe to All
                    </Button>
                    <Button
                        size="small"
                        onClick={() => setTempSubscribedEventTypes([])}
                        sx={{
                            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : undefined,
                            color: isDarkMode ? '#ffffff' : undefined
                        }}
                    >
                        Unsubscribe from All
                    </Button>
                </Box>

                <Box sx={{maxHeight: '60vh', overflow: 'auto'}}>
                    {filteredEventTypes.length === 0 ? (
                        <Typography color={isDarkMode ? '#cccccc' : 'text.secondary'} sx={{textAlign: 'center', py: 4}}>
                            No event types available for this page
                        </Typography>
                    ) : (
                        filteredEventTypes.map(eventType => (
                            <Box key={eventType} sx={{display: 'flex', alignItems: 'center', py: 0.5}}>
                                <Checkbox
                                    checked={tempSubscribedEventTypes.includes(eventType)}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setTempSubscribedEventTypes(prev => [...prev, eventType]);
                                        } else {
                                            setTempSubscribedEventTypes(prev => prev.filter(et => et !== eventType));
                                        }
                                    }}
                                    size="small"
                                    sx={{
                                        color: isDarkMode ? '#ffffff' : undefined,
                                        '&.Mui-checked': {
                                            color: isDarkMode ? '#90caf9' : undefined,
                                        }
                                    }}
                                />
                                <Box sx={{flex: 1, minWidth: 0}}>
                                    <Typography variant="body2" noWrap color={isDarkMode ? '#ffffff' : 'inherit'}>
                                        {eventType}
                                    </Typography>
                                    <Typography variant="caption" color={isDarkMode ? '#999999' : 'text.secondary'}>
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
                        onClick={() => {
                            setSubscribedEventTypes(tempSubscribedEventTypes);
                            setSubscriptionDialogOpen(false);
                        }}
                        sx={{
                            backgroundColor: isDarkMode ? '#1976d2' : undefined,
                            color: '#ffffff'
                        }}
                    >
                        Apply Subscriptions
                    </Button>
                </Box>
            </Drawer>
        );
    };

    // Subscription info component
    const SubscriptionInfo = () => {
        const subscriptionText = [
            `${subscribedEventTypes.length} event type(s)`,
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
                        sx={{
                            height: 24,
                            fontSize: '0.75rem',
                            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : undefined,
                            color: isDarkMode ? '#ffffff' : undefined,
                            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : undefined
                        }}
                        onClick={() => setSubscriptionDialogOpen(true)}
                        onDelete={() => setSubscribedEventTypes([...filteredEventTypes])}
                        deleteIcon={<Settings sx={{color: isDarkMode ? '#ffffff' : undefined}}/>}
                    />
                </Tooltip>
            </Box>
        );
    };

    // Function to get current subscriptions for external use
    const getCurrentSubscriptions = useCallback(() => {
        return [...subscribedEventTypes];
    }, [subscribedEventTypes]);

    useEffect(() => {
        logger.log("Subscriptions updated:", subscribedEventTypes);
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
        backgroundColor: isDarkMode ? theme.palette.grey[900] : theme.palette.background.paper
    };

    // Manage logger EventSource
    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            startLoggerReception(token, subscribedEventTypes, objectName);
        }
        return () => {
            closeLoggerEventSource();
        };
    }, [subscribedEventTypes, objectName]);

    const EventTypeChip = ({eventType, searchTerm}) => {
        const color = getEventColor(eventType);

        return (
            <Chip
                label={eventType}
                size="small"
                color={color === "default" ? "default" : color}
                sx={{
                    fontWeight: '600',
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : undefined,
                    color: isDarkMode ? '#ffffff' : undefined,
                    ...(searchTerm && eventType.toLowerCase().includes(searchTerm.toLowerCase()) && {
                        borderWidth: 2,
                        borderStyle: 'solid',
                        borderColor: '#ffeb3b'
                    })
                }}
            />
        );
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
                        sx={{
                            position: "fixed",
                            bottom: 16,
                            right: 16,
                            zIndex: 9999,
                            borderRadius: "20px",
                            px: 2,
                            backgroundColor: isDarkMode ? '#333333' : undefined,
                            color: isDarkMode ? '#ffffff' : '#000000',
                            '&:hover': {
                                backgroundColor: isDarkMode ? '#555555' : undefined,
                            },
                            '& .MuiButton-startIcon': {
                                color: isDarkMode ? '#ffffff' : '#000000'
                            }
                        }}
                    >
                        {buttonLabel}
                        {baseFilteredLogs.length > 0 && (
                            <Chip
                                label={baseFilteredLogs.length}
                                size="small"
                                sx={{
                                    ml: 1,
                                    height: 20,
                                    minWidth: 20,
                                    backgroundColor: isDarkMode ? '#1976d2' : '#000000',
                                    color: '#ffffff',
                                    '& .MuiChip-label': {
                                        color: '#ffffff'
                                    }
                                }}
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
                PaperProps={{style: paperStyle}}
            >
                {/* Resizer */}
                <div
                    onMouseDown={startResizing}
                    style={{
                        width: "100%",
                        height: 10,
                        backgroundColor: isDarkMode ? theme.palette.grey[700] : theme.palette.grey[300],
                        cursor: "row-resize",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    }}
                >
                    <div style={{
                        width: 48,
                        height: 6,
                        backgroundColor: isDarkMode ? theme.palette.grey[500] : theme.palette.grey[500],
                        borderRadius: 2
                    }}/>
                </div>

                {/* Header */}
                <Box sx={{p: 1, display: "flex", alignItems: "center", justifyContent: "space-between"}}>
                    <Box sx={{display: "flex", alignItems: "center", gap: 1}}>
                        <Typography variant="h6" sx={{fontSize: "1rem", color: isDarkMode ? '#ffffff' : 'inherit'}}>
                            {title}
                        </Typography>
                        <Chip
                            label={`${filteredLogs.length}/${baseFilteredLogs.length} events`}
                            size="small"
                            variant="outlined"
                            sx={{
                                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : undefined,
                                color: isDarkMode ? '#ffffff' : undefined,
                                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : undefined
                            }}
                        />
                        {isPaused && (
                            <Chip
                                label="PAUSED"
                                color="warning"
                                size="small"
                                sx={{
                                    backgroundColor: isDarkMode ? 'rgba(255, 152, 0, 0.2)' : undefined,
                                    color: isDarkMode ? '#ff9800' : undefined
                                }}
                            />
                        )}
                        {(eventTypeFilter.length > 0 || searchTerm) &&
                            <Chip
                                label="Filtered"
                                color="info"
                                size="small"
                                onDelete={handleClearFilters}
                                sx={{
                                    backgroundColor: isDarkMode ? 'rgba(33, 150, 243, 0.2)' : undefined,
                                    color: isDarkMode ? '#2196f3' : undefined
                                }}
                            />
                        }
                    </Box>

                    <Box sx={{display: "flex", gap: 0.5, alignItems: "center"}}>
                        <Tooltip title={isPaused ? "Resume" : "Pause"}>
                            <IconButton
                                onClick={() => setPaused(!isPaused)}
                                color={isPaused ? "warning" : "primary"}
                                size="small"
                                sx={{color: isDarkMode ? '#ffffff' : undefined}}
                            >
                                {isPaused ? <PlayArrow/> : <Pause/>}
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Clear logs">
                            <IconButton
                                onClick={handleClear}
                                size="small"
                                disabled={eventLogs.length === 0}
                                sx={{color: isDarkMode ? '#ffffff' : undefined}}
                            >
                                <DeleteOutline/>
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Close">
                            <IconButton
                                onClick={() => setDrawerOpen(false)}
                                size="small"
                                sx={{color: isDarkMode ? '#ffffff' : undefined}}
                            >
                                <Close/>
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>

                <Divider sx={{backgroundColor: isDarkMode ? theme.palette.divider : undefined}}/>

                {/* Compact subscription info */}
                <SubscriptionInfo/>

                {/* Filters */}
                <Box sx={{p: 1, display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap"}}>
                    <TextField
                        size="small"
                        placeholder="Search events..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        sx={{
                            minWidth: 240,
                            flexGrow: 1,
                            '& .MuiInputBase-root': {
                                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : undefined,
                                color: isDarkMode ? '#ffffff' : undefined
                            },
                            '& .MuiInputLabel-root': {
                                color: isDarkMode ? '#cccccc' : undefined
                            },
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : undefined
                            }
                        }}
                    />
                    {availableEventTypes.length > 0 && (
                        <FormControl size="small" sx={{minWidth: 240}}>
                            <InputLabel sx={{color: isDarkMode ? '#cccccc' : undefined}}>
                                Event Types
                            </InputLabel>
                            <Select
                                multiple
                                value={eventTypeFilter}
                                onChange={(e) => setEventTypeFilter(e.target.value)}
                                label="Event Types"
                                renderValue={(selected) => (
                                    <span style={{color: isDarkMode ? '#ffffff' : 'inherit'}}>
                                        {selected.length === 0 ? "All events" : `${selected.length} selected`}
                                    </span>
                                )}
                                sx={{
                                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : undefined,
                                    color: isDarkMode ? '#ffffff' : undefined,
                                    '& .MuiOutlinedInput-notchedOutline': {
                                        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : undefined
                                    },
                                    '& .MuiSvgIcon-root': {
                                        color: isDarkMode ? '#ffffff' : undefined
                                    }
                                }}
                            >
                                {availableEventTypes.map((et) => (
                                    <MenuItem key={et} value={et}>
                                        <Checkbox
                                            checked={eventTypeFilter.includes(et)}
                                            size="small"
                                            sx={{
                                                color: isDarkMode ? '#ffffff' : undefined,
                                                '&.Mui-checked': {
                                                    color: isDarkMode ? '#90caf9' : undefined,
                                                }
                                            }}
                                        />
                                        <ListItemText
                                            primary={
                                                <Box sx={{display: "flex", alignItems: "center", gap: 1}}>
                                                    <Chip
                                                        label={eventStats[et] || 0}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{
                                                            height: 20,
                                                            minWidth: 20,
                                                            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : undefined,
                                                            color: isDarkMode ? '#ffffff' : undefined,
                                                            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : undefined
                                                        }}
                                                    />
                                                    <span
                                                        style={{color: isDarkMode ? '#ffffff' : 'inherit'}}>{et}</span>
                                                </Box>
                                            }
                                        />
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}
                </Box>

                <Divider sx={{backgroundColor: isDarkMode ? theme.palette.divider : undefined}}/>

                {/* Logs container */}
                <Box
                    ref={logsContainerRef}
                    onScroll={handleScroll}
                    sx={{
                        flex: 1,
                        overflow: "auto",
                        backgroundColor: isDarkMode ? theme.palette.grey[900] : theme.palette.grey[50],
                        padding: 1,
                        ...jsonStyles
                    }}
                >
                    {filteredLogs.length === 0 ? (
                        <Box sx={{p: 4, textAlign: "center"}}>
                            <Typography color={isDarkMode ? '#cccccc' : 'textSecondary'}>
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
                                            borderBottom: `1px solid ${isDarkMode ? theme.palette.divider : theme.palette.divider}`,
                                            mb: 1,
                                            borderRadius: 1,
                                            "&:hover": {
                                                bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : theme.palette.action.hover
                                            },
                                            bgcolor: isOpen
                                                ? isDarkMode ? 'rgba(255, 255, 255, 0.1)' : theme.palette.action.selected
                                                : "transparent",
                                            transition: "background-color 0.2s ease"
                                        }}
                                    >
                                        {/* Header */}
                                        <Box sx={{display: "flex", alignItems: "center", gap: 1, p: 1}}>
                                            <EventTypeChip
                                                eventType={log.eventType}
                                                searchTerm={searchTerm}
                                            />
                                            <Typography
                                                variant="caption"
                                                color={isDarkMode ? '#cccccc' : 'textSecondary'}
                                            >
                                                {formatTimestamp(log.timestamp)}
                                            </Typography>
                                            <ExpandMore sx={{
                                                marginLeft: "auto",
                                                transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                                                transition: "0.2s",
                                                color: isDarkMode ? '#ffffff' : theme.palette.text.secondary
                                            }}/>
                                        </Box>

                                        {/* Preview when collapsed */}
                                        {!isOpen && (
                                            <Box sx={{
                                                p: 1,
                                                maxHeight: 160,
                                                overflow: "hidden",
                                                backgroundColor: isDarkMode ? theme.palette.grey[800] : theme.palette.background.default,
                                                borderRadius: 1,
                                                mx: 0.5,
                                                mb: 0.5
                                            }}>
                                                <JSONView data={log.data} dense={true} searchTerm={searchTerm}/>
                                            </Box>
                                        )}

                                        {/* Full details when expanded */}
                                        {isOpen && (
                                            <Box sx={{
                                                p: 1,
                                                borderTop: `1px solid ${isDarkMode ? theme.palette.divider : theme.palette.divider}`,
                                                backgroundColor: isDarkMode ? theme.palette.grey[800] : theme.palette.background.default,
                                                borderRadius: 1,
                                                mx: 0.5,
                                                mb: 0.5
                                            }}>
                                                <JSONView data={log.data} dense={false} searchTerm={searchTerm}/>
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
                    <Box sx={{
                        p: 1,
                        borderTop: `1px solid ${isDarkMode ? theme.palette.divider : theme.palette.divider}`,
                        textAlign: "center"
                    }}>
                        <Button
                            size="small"
                            startIcon={<KeyboardArrowUp sx={{color: isDarkMode ? '#ffffff' : undefined}}/>}
                            onClick={() => {
                                setAutoScroll(true);
                                setTimeout(() => logsEndRef.current?.scrollIntoView({behavior: "smooth"}), 100);
                            }}
                            sx={{
                                color: isDarkMode ? '#ffffff' : undefined,
                                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : undefined,
                                '&:hover': {
                                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : undefined
                                }
                            }}
                        >
                            Scroll to bottom
                        </Button>
                    </Box>
                )}
            </Drawer>

            {/* Subscription Management Dialog */}
            <SubscriptionDialog/>

            <style>{`
                .json-key { color: ${isDarkMode ? '#90caf9' : theme.palette.primary.main}; font-weight: 600; }
                .json-string { color: ${isDarkMode ? '#a5d6a7' : theme.palette.success.dark}; }
                .json-number { color: ${isDarkMode ? '#80cbc4' : theme.palette.info.main}; font-weight: 500; }
                .json-boolean { color: ${isDarkMode ? '#ffcc80' : theme.palette.warning.dark}; font-weight: 600; }
                .json-null { color: ${isDarkMode ? theme.palette.grey[400] : theme.palette.grey[500]}; font-weight: 600; }
                .search-highlight { 
                    background-color: ${isDarkMode ? '#ffeb3b' : '#ffeb3b'}; 
                    color: ${isDarkMode ? '#000000' : '#000000'};
                    padding: 0 2px;
                    border-radius: 2px;
                    font-weight: bold;
                }
            `}</style>
        </>
    );
};

export default EventLogger;
