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

const ALL_EVENT_TYPES = [
    'NodeStatusUpdated',
    'NodeMonitorUpdated',
    'NodeStatsUpdated',
    'DaemonHeartbeatUpdated',
    'ObjectStatusUpdated',
    'InstanceStatusUpdated',
    'ObjectDeleted',
    'InstanceMonitorUpdated',
    'InstanceConfigUpdated'
];

const DEBOUNCE_DELAY = process.env.NODE_ENV === 'test' ? 0 : 300;

const hashCode = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
};

const EventTypeItem = ({
                           eventType,
                           checked,
                           onChange,
                           eventCount
                       }) => (
    <Box key={eventType} sx={{display: 'flex', alignItems: 'center', py: 0.5, pl: 2}}>
        <Checkbox
            checked={checked}
            onChange={onChange}
            size="small"
        />
        <Box sx={{flex: 1}}>
            <Typography variant="body2">
                {eventType}
            </Typography>
            <Typography variant="caption">
                {eventCount} events received
            </Typography>
        </Box>
    </Box>
);

const SubscriptionDialog = ({
                                open,
                                onClose,
                                isDarkMode,
                                theme,
                                subscribedEventTypes,
                                setManualSubscriptions,
                                filteredEventTypes,
                                eventStats,
                                clearLogs
                            }) => {
    const [tempSubscribedEventTypes, setTempSubscribedEventTypes] = useState(subscribedEventTypes);

    const otherEventTypes = useMemo(() => {
        return ALL_EVENT_TYPES.filter(type => !filteredEventTypes.includes(type)).sort();
    }, [filteredEventTypes]);

    const handleSubscribeAll = () => {
        setTempSubscribedEventTypes([...ALL_EVENT_TYPES]);
    };

    const handleSubscribePageEvents = () => {
        const currentOther = tempSubscribedEventTypes.filter(
            type => !filteredEventTypes.includes(type)
        );
        setTempSubscribedEventTypes(
            [...new Set([...currentOther, ...filteredEventTypes])]
        );
    };

    const handleUnsubscribeAll = () => {
        setTempSubscribedEventTypes([]);
    };

    const renderEventTypeList = (eventTypes, isPageEvents = false) => (
        <Box sx={{mb: 3}}>
            <Typography
                variant="subtitle2"
                color={isDarkMode ? (isPageEvents ? '#90caf9' : '#a5d6a7') : (isPageEvents ? 'primary.main' : 'success.dark')}
                sx={{mb: 1}}
            >
                {isPageEvents ? 'Page Events' : 'Additional Events'} ({eventTypes.length})
            </Typography>

            {eventTypes.sort().map(eventType => (
                <EventTypeItem
                    key={String(eventType)}
                    eventType={eventType}
                    checked={tempSubscribedEventTypes.includes(eventType)}
                    onChange={(e) => {
                        setTempSubscribedEventTypes(prev =>
                            e.target.checked
                                ? [...new Set([...prev, eventType])]
                                : prev.filter(et => et !== eventType)
                        );
                    }}
                    eventCount={eventStats[eventType] || 0}
                />
            ))}
        </Box>
    );

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            sx={{
                '& .MuiDrawer-paper': {
                    width: 500,
                    maxWidth: '90vw',
                    p: 2,
                    backgroundColor: isDarkMode
                        ? theme.palette.background.paper
                        : '#ffffff'
                }
            }}
        >
            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
                <Typography variant="h6" color={isDarkMode ? '#ffffff' : 'inherit'}>
                    Event Subscriptions
                </Typography>
                <IconButton onClick={onClose} aria-label="Close">
                    <Close sx={{color: isDarkMode ? '#ffffff' : 'inherit'}}/>
                </IconButton>
            </Box>

            <Divider sx={{mb: 2}}/>

            <Typography
                variant="body2"
                color={isDarkMode ? '#cccccc' : 'text.secondary'}
                sx={{mb: 2}}
            >
                Select which event types you want to SUBSCRIBE to (future events only):
            </Typography>

            {/* ACTION BUTTONS */}
            <Box sx={{mb: 3, display: 'flex', gap: 1, flexWrap: 'wrap'}}>
                <Button
                    size="small"
                    variant="outlined"
                    onClick={handleSubscribeAll}
                >
                    Subscribe to All
                </Button>

                <Button
                    size="small"
                    variant="outlined"
                    onClick={handleSubscribePageEvents}
                    disabled={filteredEventTypes.length === 0}
                >
                    Subscribe to Page Events
                </Button>

                <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={handleUnsubscribeAll}
                >
                    Unsubscribe from All
                </Button>
            </Box>

            {/* EVENT LIST */}
            <Box sx={{maxHeight: '60vh', overflow: 'auto'}}>
                {filteredEventTypes.length > 0 && renderEventTypeList(filteredEventTypes, true)}

                {otherEventTypes.length > 0 && renderEventTypeList(otherEventTypes, false)}

                {tempSubscribedEventTypes.length === 0 && (
                    <Typography sx={{textAlign: 'center', py: 4}}>
                        No event types selected. You won't receive any events.
                    </Typography>
                )}
            </Box>

            {/* APPLY */}
            <Box sx={{mt: 'auto', pt: 2}}>
                <Button
                    fullWidth
                    variant="contained"
                    onClick={() => {
                        setManualSubscriptions(tempSubscribedEventTypes);
                        clearLogs();
                        onClose();
                    }}
                >
                    Apply Subscriptions ({tempSubscribedEventTypes.length})
                </Button>
            </Box>
        </Drawer>
    );
};

const EventLogger = ({
                         eventTypes = [],
                         objectName = null,
                         title = "Event Logger",
                         buttonLabel = "Events"
                     }) => {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [eventTypeFilter, setEventTypeFilter] = useState([]);
    const [autoScroll, setAutoScroll] = useState(true);
    const [drawerHeight, setDrawerHeight] = useState(320);
    const [expandedLogIds, setExpandedLogIds] = useState([]);
    const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
    const [isResizing, setIsResizing] = useState(false);

    const filteredEventTypes = useMemo(() => {
        return eventTypes.filter(et => !CONNECTION_EVENTS.includes(et));
    }, [eventTypes]);

    const pageKey = useMemo(() => {
        const baseKey = objectName || 'global';
        const eventTypesKey = filteredEventTypes.sort().join(',');
        const hash = hashCode(eventTypesKey);
        return `eventLogger_${baseKey}_${hash}`;
    }, [objectName, filteredEventTypes]);

    const [manualSubscriptions, setManualSubscriptions] = useState([]);

    const subscribedEventTypes = useMemo(() => {
        const validSubscriptions = manualSubscriptions.filter(type =>
            ALL_EVENT_TYPES.includes(type)
        );
        return [...new Set(validSubscriptions)];
    }, [manualSubscriptions]);

    const logsEndRef = useRef(null);
    const logsContainerRef = useRef(null);
    const resizeTimeoutRef = useRef(null);
    const searchDebounceRef = useRef(null);
    const startYRef = useRef(0);
    const startHeightRef = useRef(0);
    const isDraggingRef = useRef(false);

    const {eventLogs = [], isPaused, setPaused, clearLogs} = useEventLogStore();

    useEffect(() => {
        setManualSubscriptions([...filteredEventTypes]);
    }, []);

    useEffect(() => {
        const token = localStorage.getItem("authToken");

        if (!drawerOpen) {
            closeLoggerEventSource();
            return;
        }

        if (token && drawerOpen) {
            const eventsToSubscribe = [...subscribedEventTypes];
            const connectionEvents = eventTypes.filter(et => CONNECTION_EVENTS.includes(et));
            eventsToSubscribe.push(...connectionEvents);

            const uniqueEvents = [...new Set(eventsToSubscribe)];

            if (uniqueEvents.length > 0) {
                logger.log("Starting logger reception (drawer opened):", {
                    pageKey,
                    subscribedEventTypes,
                    allEvents: uniqueEvents,
                    objectName
                });

                try {
                    startLoggerReception(token, uniqueEvents, objectName);
                } catch (error) {
                    logger.warn("Failed to start logger reception:", error);
                }
            } else {
                logger.log("No events to subscribe to for this page");
                closeLoggerEventSource();
            }
        }

        return () => {
            if (drawerOpen) {
                logger.log("Closing logger reception (drawer closing)");
                closeLoggerEventSource();
            }
        };
    }, [drawerOpen, subscribedEventTypes, objectName, eventTypes, pageKey]);

    useEffect(() => {
        if (searchDebounceRef.current) {
            clearTimeout(searchDebounceRef.current);
        }
        searchDebounceRef.current = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, DEBOUNCE_DELAY);

        return () => {
            if (searchDebounceRef.current) {
                clearTimeout(searchDebounceRef.current);
                searchDebounceRef.current = null;
            }
        };
    }, [searchTerm]);

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

        const escapedJson = escapeHtml(json);
        const highlightedJson = searchTerm ?
            escapedJson.replace(
                new RegExp(`(${escapeHtml(searchTerm).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                '<span class="search-highlight">$1</span>'
            ) :
            escapedJson;

        return highlightedJson.replace(
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
                if (match.includes('search-highlight')) {
                    return match;
                }
                return `<span class="${cls}">${match}</span>`;
            }
        );
    };

    const JSONView = ({data, dense = false, searchTerm = ''}) => {
        const filteredData = useMemo(() => filterData(data), [data]);
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

    const baseFilteredLogs = useMemo(() => {
        let filtered = Array.isArray(eventLogs) ? eventLogs : [];

        if (subscribedEventTypes.length === 0 && filteredEventTypes.length > 0) {
            filtered = filtered.filter(log => filteredEventTypes.includes(log.eventType));
        } else if (subscribedEventTypes.length > 0) {
            filtered = filtered.filter(log => subscribedEventTypes.includes(log.eventType));
        }

        const connectionEventsFromPage = eventTypes.filter(et => CONNECTION_EVENTS.includes(et));
        if (connectionEventsFromPage.length > 0) {
            filtered = filtered.filter(log =>
                subscribedEventTypes.includes(log.eventType) ||
                connectionEventsFromPage.includes(log.eventType)
            );
        }

        if (objectName) {
            filtered = filtered.filter(log => {
                const data = log.data || {};

                if (log.eventType?.includes?.("CONNECTION")) return true;

                if (log.eventType === "ObjectDeleted" && data._rawEvent) {
                    try {
                        const raw = JSON.parse(data._rawEvent);
                        if (raw.path === objectName || raw.labels?.path === objectName) return true;
                    } catch {
                    }
                }

                if (data.path === objectName) return true;
                if (data.labels?.path === objectName) return true;
                if (data.data?.path === objectName) return true;

                return data.data?.labels?.path === objectName;
            });
        }

        return filtered;
    }, [eventLogs, subscribedEventTypes, objectName, eventTypes, filteredEventTypes]);

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
        if (debouncedSearchTerm.trim()) {
            const term = debouncedSearchTerm.toLowerCase().trim();
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
    }, [baseFilteredLogs, eventTypeFilter, debouncedSearchTerm]);

    const SubscriptionInfo = () => {
        const eventTypeChips = useMemo(() => {
            if (subscribedEventTypes.length === 0) return null;

            return subscribedEventTypes.sort().map((type) => (
                <Chip
                    key={String(type)}
                    label={`${type} (${eventStats[type] || 0})`}
                    size="small"
                    variant="outlined"
                    onDelete={() => {
                        setManualSubscriptions(prev => prev.filter(t => t !== type));
                    }}
                    sx={{
                        backgroundColor: filteredEventTypes.includes(type)
                            ? (isDarkMode ? 'rgba(144, 202, 249, 0.2)' : 'rgba(25, 118, 210, 0.1)')
                            : (isDarkMode ? 'rgba(165, 214, 167, 0.2)' : 'rgba(76, 175, 80, 0.1)'),
                        color: filteredEventTypes.includes(type)
                            ? (isDarkMode ? '#90caf9' : 'primary.main')
                            : (isDarkMode ? '#a5d6a7' : 'success.dark'),
                        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : undefined,
                        fontSize: '0.7rem',
                        height: 20
                    }}
                />
            ));
        }, [subscribedEventTypes, eventStats, filteredEventTypes, isDarkMode, setManualSubscriptions]);

        return (
            <Box sx={{px: 1, py: 0.5}}>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1}}>
                    <Typography variant="body2" color={isDarkMode ? '#ffffff' : 'inherit'}>
                        Subscribed to: {subscribedEventTypes.length} event type(s)
                    </Typography>
                    {objectName && (
                        <Typography variant="body2" color={isDarkMode ? '#cccccc' : 'text.secondary'}>
                            • object: {objectName}
                        </Typography>
                    )}
                    <IconButton
                        onClick={() => setSubscriptionDialogOpen(true)}
                        size="small"
                        sx={{ml: 'auto', color: isDarkMode ? '#ffffff' : undefined}}
                    >
                        <Settings/>
                    </IconButton>
                </Box>

                {subscribedEventTypes.length > 0 && (
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap'}}>
                        {eventTypeChips}
                    </Box>
                )}
            </Box>
        );
    };

    useEffect(() => {
        logger.log("Subscriptions updated:", {
            subscribedEventTypes,
            filteredEventTypes,
            pageKey
        });
    }, [subscribedEventTypes, filteredEventTypes, pageKey]);

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

    const handleResizeStart = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        isDraggingRef.current = true;
        startYRef.current = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        startHeightRef.current = drawerHeight;
        document.body.style.userSelect = 'none';
        document.body.style.touchAction = 'none';
        document.body.style.overflow = 'hidden';
        if (resizeTimeoutRef.current) {
            clearTimeout(resizeTimeoutRef.current);
            resizeTimeoutRef.current = null;
        }
    }, [drawerHeight]);

    const handleResizeMove = useCallback((e) => {
        if (!isDraggingRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        const deltaY = startYRef.current - clientY;
        const newHeight = Math.max(220, Math.min(window.innerHeight * 0.8, startHeightRef.current + deltaY));
        if (resizeTimeoutRef.current) {
            clearTimeout(resizeTimeoutRef.current);
        }
        resizeTimeoutRef.current = setTimeout(() => {
            setDrawerHeight(newHeight);
        }, 16);
    }, []);

    const handleResizeEnd = useCallback(() => {
        if (!isDraggingRef.current) return;
        setIsResizing(false);
        isDraggingRef.current = false;
        document.body.style.userSelect = '';
        document.body.style.touchAction = '';
        document.body.style.overflow = '';
        if (resizeTimeoutRef.current) {
            clearTimeout(resizeTimeoutRef.current);
            resizeTimeoutRef.current = null;
        }
    }, []);

    useEffect(() => {
        const handleMouseMove = (e) => handleResizeMove(e);
        const handleTouchMove = (e) => handleResizeMove(e);
        const handleMouseUp = (e) => handleResizeEnd(e);
        const handleTouchEnd = (e) => handleResizeEnd(e);
        const handleTouchCancel = (e) => handleResizeEnd(e);

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('touchmove', handleTouchMove, {passive: false});
            document.addEventListener('mouseup', handleMouseUp);
            document.addEventListener('touchend', handleTouchEnd);
            document.addEventListener('touchcancel', handleTouchCancel);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('touchend', handleTouchEnd);
            document.removeEventListener('touchcancel', handleTouchCancel);

            if (resizeTimeoutRef.current) {
                clearTimeout(resizeTimeoutRef.current);
                resizeTimeoutRef.current = null;
            }

            if (searchDebounceRef.current) {
                clearTimeout(searchDebounceRef.current);
                searchDebounceRef.current = null;
            }
        };
    }, [isResizing, handleResizeMove, handleResizeEnd]);

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
        setDebouncedSearchTerm("");
        setEventTypeFilter([]);
        setExpandedLogIds([]);
    }, [clearLogs]);

    const handleClearFilters = useCallback(() => {
        setSearchTerm("");
        setDebouncedSearchTerm("");
        setEventTypeFilter([]);
    }, []);

    const paperStyle = {
        height: drawerHeight,
        maxHeight: "80vh",
        overflow: "hidden",
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        backgroundColor: isDarkMode ? theme.palette.grey[900] : theme.palette.background.paper,
        touchAction: 'none'
    };

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

    const renderMenuItems = useMemo(() => {
        if (availableEventTypes.length === 0) return null;

        return availableEventTypes.map((et) => (
            <MenuItem key={String(et)} value={String(et)}>
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
        ));
    }, [availableEventTypes, eventTypeFilter, eventStats, isDarkMode]);

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
                    </Button>
                </Tooltip>
            )}

            <Drawer
                anchor="bottom"
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                variant="persistent"
                slotProps={{
                    paper: {
                        style: paperStyle
                    }
                }}
            >
                <div
                    onMouseDown={handleResizeStart}
                    onTouchStart={handleResizeStart}
                    style={{
                        width: "100%",
                        height: 24,
                        minHeight: 24,
                        backgroundColor: isResizing
                            ? (isDarkMode ? theme.palette.primary.dark : theme.palette.primary.light)
                            : (isDarkMode ? theme.palette.grey[700] : theme.palette.grey[300]),
                        cursor: "row-resize",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        touchAction: "none",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                        MozUserSelect: "none",
                        msUserSelect: "none",
                        position: "relative",
                        zIndex: 2,
                        transition: "background-color 0.2s ease"
                    }}
                    className="resize-handle"
                    aria-label="Resize handle"
                >
                    <div style={{
                        width: 60,
                        height: 6,
                        backgroundColor: isDarkMode ? theme.palette.grey[500] : theme.palette.grey[500],
                        borderRadius: 3,
                        opacity: isResizing ? 0.8 : 1
                    }}/>
                </div>

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
                        {(eventTypeFilter.length > 0 || debouncedSearchTerm) &&
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

                    <Box sx={{display: 'flex', gap: 0.5, alignItems: "center"}}>
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

                <SubscriptionInfo/>

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
                        slotProps={{
                            input: {
                                endAdornment: searchTerm && (
                                    <IconButton
                                        size="small"
                                        onClick={() => setSearchTerm("")}
                                        sx={{color: isDarkMode ? '#ffffff' : undefined}}
                                    >
                                        <Close fontSize="small"/>
                                    </IconButton>
                                )
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
                                {renderMenuItems}
                            </Select>
                        </FormControl>
                    )}
                </Box>

                <Divider sx={{backgroundColor: isDarkMode ? theme.palette.divider : undefined}}/>

                <Box
                    ref={logsContainerRef}
                    onScroll={handleScroll}
                    sx={{
                        flex: 1,
                        overflow: "auto",
                        backgroundColor: isDarkMode ? theme.palette.grey[900] : theme.palette.grey[50],
                        padding: 1,
                        ...jsonStyles,
                        WebkitOverflowScrolling: 'touch'
                    }}
                >
                    {filteredLogs.length === 0 ? (
                        <Box sx={{p: 4, textAlign: "center"}}>
                            <Typography
                                color={isDarkMode ? '#cccccc' : 'textSecondary'}
                            >
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
                                        key={String(safeId)}
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
                                            transition: "background-color 0.2s ease",
                                            touchAction: 'manipulation'
                                        }}
                                    >
                                        <Box sx={{display: "flex", alignItems: "center", gap: 1, p: 1}}>
                                            <EventTypeChip
                                                eventType={log.eventType}
                                                searchTerm={debouncedSearchTerm}
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
                                                <JSONView data={log.data} dense={true}
                                                          searchTerm={debouncedSearchTerm}/>
                                            </Box>
                                        )}
                                        {isOpen && (
                                            <Box sx={{
                                                p: 1,
                                                borderTop: `1px solid ${isDarkMode ? theme.palette.divider : theme.palette.divider}`,
                                                backgroundColor: isDarkMode ? theme.palette.grey[800] : theme.palette.background.default,
                                                borderRadius: 1,
                                                mx: 0.5,
                                                mb: 0.5
                                            }}>
                                                <JSONView data={log.data} dense={false}
                                                          searchTerm={debouncedSearchTerm}/>
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

            <SubscriptionDialog
                open={subscriptionDialogOpen}
                onClose={() => setSubscriptionDialogOpen(false)}
                isDarkMode={isDarkMode}
                theme={theme}
                subscribedEventTypes={subscribedEventTypes}
                setManualSubscriptions={setManualSubscriptions}
                filteredEventTypes={filteredEventTypes}
                eventStats={eventStats}
                clearLogs={clearLogs}
            />

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
                @media (max-width: 768px) {
                    .MuiDrawer-paper {
                        max-height: 90vh !important;
                        touch-action: none;
                    }
                    .resize-handle {
                        height: 32px !important;
                        min-height: 32px !important;
                    }
                    .MuiChip-root {
                        font-size: 0.7rem !important;
                    }
                    .MuiTypography-body2 {
                        font-size: 0.8rem !important;
                    }
                    .MuiButton-root {
                        padding: 6px 12px !important;
                        min-height: 36px !important;
                    }
                    .MuiIconButton-root {
                        padding: 6px !important;
                        min-width: 36px !important;
                        min-height: 36px !important;
                    }
                    .MuiTextField-root, .MuiFormControl-root {
                        min-width: 100% !important;
                    }
                }
                
                @media screen and (max-width: 768px) {
                    input, select, textarea {
                        font-size: 16px !important;
                    }
                }
            `}</style>
        </>
    );
};

export default EventLogger;
