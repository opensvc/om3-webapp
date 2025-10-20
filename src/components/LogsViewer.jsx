import React, {useEffect, useState, useRef, useCallback} from "react";
import {
    Box,
    Paper,
    Typography,
    IconButton,
    TextField,
    Chip,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Button,
    Tooltip,
    useTheme,
    Alert,
    CircularProgress,
} from "@mui/material";
import {
    PlayArrow,
    Pause,
    DeleteOutline,
    Download,
    Search,
} from "@mui/icons-material";
import {URL_NODE} from "../config/apiPath.js";

const LogsViewer = ({
                        nodename,
                        type = "node",
                        namespace = "root",
                        kind = "svc",
                        instanceName,
                        maxLogs = 1000,
                        height = "500px"
                    }) => {
    const theme = useTheme();
    const [logs, setLogs] = useState([]);
    const [filteredLogs, setFilteredLogs] = useState([]);
    const [isPaused, setIsPaused] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [levelFilter, setLevelFilter] = useState("all");
    const [autoScroll, setAutoScroll] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const logsEndRef = useRef(null);
    const logsContainerRef = useRef(null);
    const isUnmountedRef = useRef(false);
    const abortControllerRef = useRef(null);
    const logBufferRef = useRef([]);
    const seenLogsRef = useRef(new Set());
    const updateIntervalRef = useRef(null);
    const lastFetchTimeRef = useRef(0);
    const UPDATE_INTERVAL = 5000;
    const MIN_FETCH_INTERVAL = 4000;

    useEffect(() => {
        isUnmountedRef.current = isPaused;
    }, [isPaused]);

    const buildLogUrl = useCallback(() => {
        if (type === "instance" && instanceName && instanceName.trim() !== "") {
            return `${URL_NODE}/${nodename}/instance/path/${namespace}/${kind}/${instanceName}/log`;
        }
        return `${URL_NODE}/${nodename}/log`;
    }, [type, nodename, namespace, kind, instanceName]);

    const buildTitle = useCallback(() => {
        if (type === "instance") {
            return "Instance Logs";
        }
        return "Node Logs";
    }, [type]);

    const buildSubtitle = useCallback(() => {
        if (type === "instance" && instanceName && instanceName.trim() !== "") {
            return `${instanceName} on ${nodename}`;
        }
        return nodename;
    }, [type, nodename, instanceName]);

    const buildDownloadFilename = useCallback(() => {
        const timestamp = new Date().toISOString();
        if (type === "instance" && instanceName && instanceName.trim() !== "") {
            return `${nodename}-${instanceName}-logs-${timestamp}.txt`;
        }
        return `${nodename}-logs-${timestamp}.txt`;
    }, [type, nodename, instanceName]);

    const parseLogMessage = useCallback((logData) => {
        try {
            if (logData.JSON) {
                const jsonData = JSON.parse(logData.JSON);
                return {
                    timestamp: new Date(jsonData.time || logData.__REALTIME_TIMESTAMP / 1000),
                    level: jsonData.level || "info",
                    message: jsonData.message || logData.MESSAGE || "",
                    method: jsonData.method || logData.METHOD || "",
                    path: jsonData.path || logData.PATH || "",
                    node: jsonData.node || logData.NODE || nodename,
                    requestUuid: jsonData.request_uuid || logData.REQUEST_UUID || "",
                    pkg: jsonData.pkg || logData.PKG || "",
                    raw: logData,
                    __REALTIME_TIMESTAMP: logData.__REALTIME_TIMESTAMP,
                };
            }
            return {
                timestamp: new Date(parseInt(logData.__REALTIME_TIMESTAMP) / 1000),
                level: "info",
                message: logData.MESSAGE || JSON.stringify(logData),
                node: logData.NODE || nodename,
                raw: logData,
                __REALTIME_TIMESTAMP: logData.__REALTIME_TIMESTAMP,
            };
        } catch (e) {
            console.warn("Failed to parse log:", e);
            return {
                timestamp: new Date(),
                level: "info",
                message: JSON.stringify(logData),
                node: nodename,
                raw: logData,
                __REALTIME_TIMESTAMP: Date.now() * 1000,
            };
        }
    }, [nodename]);

    const updateLogs = useCallback(() => {
        if (logBufferRef.current.length === 0 || isUnmountedRef.current) {
            return;
        }

        setLogs((prev) => {
            const newLogs = [...prev, ...logBufferRef.current].slice(-maxLogs);
            logBufferRef.current = [];
            return newLogs;
        });
    }, [maxLogs]);

    const fetchLogs = useCallback(async (signal, isInitialFetch = false) => {
        if (isUnmountedRef.current || !nodename) return;

        if (type === "instance") {
            if (!instanceName || instanceName.trim() === "") {
                setErrorMessage("Instance name is required for instance logs");
                return;
            }
        }

        const currentTime = Date.now();
        if (!isInitialFetch && currentTime - lastFetchTimeRef.current < MIN_FETCH_INTERVAL) {
            setTimeout(() => fetchLogs(signal, false), MIN_FETCH_INTERVAL - (currentTime - lastFetchTimeRef.current));
            return;
        }
        lastFetchTimeRef.current = currentTime;

        const token = localStorage.getItem("authToken");
        if (!token) {
            setErrorMessage("Authentication token not found");
            setIsConnected(false);
            return;
        }

        try {
            const url = buildLogUrl();

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Accept': 'text/event-stream',
                },
                signal,
            });

            if (!response.ok) {
                setErrorMessage(`HTTP error! status: ${response.status}`);
                setIsConnected(false);
                return;
            }

            setIsConnected(true);
            setErrorMessage("");
            setIsLoading(false);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const {value, done} = await reader.read();

                if (done) break;

                if (signal.aborted) {
                    reader.releaseLock();
                    return;
                }

                buffer += decoder.decode(value, {stream: true});
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ') && !isUnmountedRef.current) {
                        try {
                            const jsonStr = line.slice(6).trim();
                            if (jsonStr) {
                                const logData = JSON.parse(jsonStr);
                                const parsedLog = parseLogMessage(logData);
                                const timestamp = parsedLog.__REALTIME_TIMESTAMP;
                                if (timestamp && !seenLogsRef.current.has(timestamp)) {
                                    seenLogsRef.current.add(timestamp);
                                    logBufferRef.current.push(parsedLog);
                                }
                            }
                        } catch (e) {
                            console.warn("Failed to parse log line:", e, line);
                        }
                    }
                }
            }

            updateLogs();
            reader.releaseLock();
        } catch (error) {
            if (error.name === 'AbortError') {
                return;
            }
            console.error("Failed to fetch logs:", error);
            setIsConnected(false);

            if (error.message.includes('401')) {
                setErrorMessage("Authentication failed. Please refresh your token.");
            } else if (error.message.includes('404')) {
                if (type === "instance") {
                    setErrorMessage(`Instance logs endpoint not found for ${instanceName} on node ${nodename}`);
                } else {
                    setErrorMessage(`Node logs endpoint not found for node ${nodename}`);
                }
            } else {
                setErrorMessage(`Failed to fetch logs: ${error.message}`);
            }
        } finally {
            setIsLoading(false);
            if (!signal.aborted && !isUnmountedRef.current && !isPaused) {
                setTimeout(() => fetchLogs(signal, false), UPDATE_INTERVAL);
            }
        }
    }, [nodename, type, instanceName, maxLogs, buildLogUrl, parseLogMessage, updateLogs, isPaused]);

    const startStreaming = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setIsLoading(true);
        setErrorMessage("");
        const controller = new AbortController();
        abortControllerRef.current = controller;
        fetchLogs(controller.signal, true);
    }, [fetchLogs]);

    useEffect(() => {
        if (isPaused) {
            if (updateIntervalRef.current) {
                clearInterval(updateIntervalRef.current);
                updateIntervalRef.current = null;
            }
        } else {
            updateIntervalRef.current = setInterval(() => {
                if (logBufferRef.current.length > 0) {
                    updateLogs();
                }
            }, UPDATE_INTERVAL);
        }
        return () => {
            if (updateIntervalRef.current) {
                clearInterval(updateIntervalRef.current);
            }
        };
    }, [updateLogs, isPaused]);

    useEffect(() => {
        let filtered = logs;

        if (levelFilter !== "all") {
            filtered = filtered.filter((log) => log.level === levelFilter);
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(
                (log) =>
                    log.message.toLowerCase().includes(term) ||
                    log.method?.toLowerCase().includes(term) ||
                    log.path?.toLowerCase().includes(term) ||
                    log.pkg?.toLowerCase().includes(term)
            );
        }

        setFilteredLogs(filtered);
    }, [logs, searchTerm, levelFilter]);

    useEffect(() => {
        if (autoScroll && logsEndRef.current && filteredLogs.length > 0) {
            logsEndRef.current.scrollIntoView({behavior: "smooth"});
        }
    }, [filteredLogs, autoScroll]);

    useEffect(() => {
        if (!nodename) return;

        if (type === "instance") {
            if (!instanceName || instanceName.trim() === "") {
                setErrorMessage("Instance name is required for instance logs");
                return;
            }
        }

        isUnmountedRef.current = false;
        if (!isPaused) {
            startStreaming();
        }

        return () => {
            isUnmountedRef.current = true;
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [nodename, type, instanceName, startStreaming, isPaused]);

    useEffect(() => {
        if (isPaused) {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        } else {
            startStreaming();
        }
    }, [isPaused, startStreaming]);

    const handleScroll = useCallback(() => {
        if (!logsContainerRef.current) return;
        const {scrollTop, scrollHeight, clientHeight} = logsContainerRef.current;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
        setAutoScroll(isAtBottom);
    }, []);

    const formatTime = (timestamp) => {
        return timestamp.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            fractionalSecondDigits: 3,
        });
    };

    const getLevelColor = (level) => {
        switch (level) {
            case "error":
                return theme.palette.error.main;
            case "warn":
            case "warning":
                return theme.palette.warning.main;
            case "debug":
                return theme.palette.info.main;
            default:
                return theme.palette.text.primary;
        }
    };

    const handleDownload = () => {
        const content = filteredLogs
            .map(
                (log) =>
                    `[${log.timestamp.toISOString()}] [${log.level.toUpperCase()}] ${log.message}`
            )
            .join("\n");
        const blob = new Blob([content], {type: "text/plain"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = buildDownloadFilename();
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleManualReconnect = () => {
        setErrorMessage("");
        setLogs([]);
        setFilteredLogs([]);
        seenLogsRef.current.clear();
        startStreaming();
    };

    const handleClearLogs = () => {
        setLogs([]);
        setFilteredLogs([]);
        logBufferRef.current = [];
        seenLogsRef.current.clear();
    };

    return (
        <Paper
            elevation={3}
            sx={{
                p: 2,
                display: "flex",
                flexDirection: "column",
                height: "100%",
                bgcolor: theme.palette.background.paper,
            }}
        >
            <Box sx={{
                mb: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 2
            }}>
                <Box sx={{display: "flex", alignItems: "center", gap: 1}}>
                    <Typography variant="body2" sx={{color: "text.secondary"}}>
                        {buildSubtitle()}
                    </Typography>
                    <Chip
                        label={isConnected ? "Connected" : "Disconnected"}
                        color={isConnected ? "success" : "error"}
                        size="small"
                    />
                    {isLoading && (
                        <CircularProgress size={16}/>
                    )}
                </Box>

                <Box sx={{display: "flex", gap: 1}}>
                    <Tooltip title={isPaused ? "Resume" : "Pause"}>
                        <IconButton
                            onClick={() => setIsPaused(!isPaused)}
                            color={isPaused ? "warning" : "primary"}
                            size="small"
                        >
                            {isPaused ? <PlayArrow/> : <Pause/>}
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Clear logs">
                        <IconButton onClick={handleClearLogs} size="small" disabled={logs.length === 0}>
                            <DeleteOutline/>
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Download logs">
                        <IconButton onClick={handleDownload} size="small" disabled={filteredLogs.length === 0}>
                            <Download/>
                        </IconButton>
                    </Tooltip>
                    {errorMessage && (
                        <Button size="small" variant="outlined" onClick={handleManualReconnect}>
                            Retry
                        </Button>
                    )}
                </Box>
            </Box>

            {errorMessage && (
                <Alert severity="error" sx={{mb: 2}}>
                    {errorMessage}
                </Alert>
            )}

            {isLoading && !errorMessage && (
                <Alert severity="info" sx={{mb: 2}}>
                    Loading logs...
                </Alert>
            )}

            <Box sx={{mb: 2, display: "flex", gap: 2, flexWrap: "wrap"}}>
                <TextField
                    size="small"
                    placeholder="Search in logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    slotProps={{
                        input: {
                            startAdornment: <Search sx={{mr: 1, color: "text.secondary"}}/>,
                        },
                    }}
                    sx={{flexGrow: 1, minWidth: "200px"}}
                />
                <FormControl size="small" sx={{minWidth: "120px"}}>
                    <InputLabel>Level</InputLabel>
                    <Select
                        value={levelFilter}
                        label="Level"
                        onChange={(e) => setLevelFilter(e.target.value)}
                    >
                        <MenuItem value="all">All</MenuItem>
                        <MenuItem value="info">Info</MenuItem>
                        <MenuItem value="warn">Warning</MenuItem>
                        <MenuItem value="error">Error</MenuItem>
                        <MenuItem value="debug">Debug</MenuItem>
                    </Select>
                </FormControl>
                <Typography variant="caption" sx={{alignSelf: "center", color: "text.secondary"}}>
                    {filteredLogs.length} / {logs.length} logs
                </Typography>
            </Box>

            <Box
                ref={logsContainerRef}
                onScroll={handleScroll}
                sx={{
                    flexGrow: 1,
                    overflow: "auto",
                    bgcolor: theme.palette.grey[100],
                    p: 2,
                    borderRadius: 1,
                    border: `1px solid ${theme.palette.divider}`,
                    fontFamily: "monospace",
                    fontSize: "0.9rem",
                    height: height,
                    "& .log-line": {
                        py: 0.75,
                        px: 1,
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        "&:hover": {
                            bgcolor: theme.palette.action.hover,
                        },
                        transition: "background-color 0.2s",
                    },
                }}
            >
                {filteredLogs.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" align="center" sx={{pt: 2}}>
                        {logs.length === 0 && !isLoading ? "No logs available" : "No logs match current filters"}
                    </Typography>
                ) : (
                    filteredLogs.map((log, index) => (
                        <Box key={index} className="log-line">
                            <Box sx={{display: "flex", gap: 1.5, alignItems: "flex-start", flexWrap: "wrap"}}>
                                <Typography
                                    component="span"
                                    sx={{color: theme.palette.text.secondary, minWidth: "110px", fontWeight: "medium"}}
                                >
                                    {formatTime(log.timestamp)}
                                </Typography>
                                <Typography
                                    component="span"
                                    sx={{
                                        color: getLevelColor(log.level),
                                        fontWeight: "bold",
                                        minWidth: "70px",
                                    }}
                                >
                                    [{log.level.toUpperCase()}]
                                </Typography>
                                {log.method && (
                                    <Typography
                                        component="span"
                                        sx={{color: theme.palette.info.main, minWidth: "60px", fontWeight: "medium"}}
                                    >
                                        {log.method}
                                    </Typography>
                                )}
                                {log.path && (
                                    <Typography component="span" sx={{color: theme.palette.text.secondary}}>
                                        {log.path}
                                    </Typography>
                                )}
                                <Typography component="span" sx={{
                                    wordBreak: "break-word",
                                    flex: 1,
                                    minWidth: "100%",
                                    whiteSpace: "pre-wrap",
                                    color: theme.palette.text.primary,
                                }}>
                                    {log.message}
                                </Typography>
                            </Box>
                        </Box>
                    ))
                )}
                <div ref={logsEndRef}/>
            </Box>

            {!autoScroll && filteredLogs.length > 0 && (
                <Button
                    size="small"
                    onClick={() => {
                        setAutoScroll(true);
                        logsEndRef.current?.scrollIntoView({behavior: "smooth"});
                    }}
                    sx={{mt: 1, alignSelf: "center"}}
                >
                    Go to bottom
                </Button>
            )}
        </Paper>
    );
};

export default LogsViewer;
