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
    Clear,
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
    const isPausedRef = useRef(isPaused);
    const logsRef = useRef(logs);
    const isConnectedRef = useRef(isConnected);
    const isLoadingRef = useRef(isLoading);
    const UPDATE_INTERVAL = 2000;

    useEffect(() => {
        isPausedRef.current = isPaused;
    }, [isPaused]);

    useEffect(() => {
        logsRef.current = logs;
    }, [logs]);

    const buildLogUrl = useCallback(() => {
        if (type === "instance" && instanceName) {
            return `${URL_NODE}/${nodename}/instance/path/${namespace}/${kind}/${instanceName}/log`;
        }
        return `${URL_NODE}/${nodename}/log`;
    }, [type, nodename, namespace, kind, instanceName]);

    const buildTitle = useCallback(() => {
        if (type === "instance" && instanceName) {
            return `Instance Logs - ${instanceName} on ${nodename}`;
        }
        return `Logs - ${nodename}`;
    }, [type, nodename, instanceName]);

    const buildDownloadFilename = useCallback(() => {
        if (type === "instance" && instanceName) {
            return `${nodename}-${instanceName}-logs-${new Date().toISOString()}.txt`;
        }
        return `${nodename}-logs-${new Date().toISOString()}.txt`;
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
        if (logBufferRef.current.length === 0 || isPausedRef.current) return;

        setLogs((prev) => {
            const newLogs = [...prev, ...logBufferRef.current].slice(-maxLogs);

            if (prev.length === newLogs.length &&
                prev.length > 0 &&
                prev[prev.length - 1].__REALTIME_TIMESTAMP === newLogs[newLogs.length - 1].__REALTIME_TIMESTAMP) {
                logBufferRef.current = [];
                return prev;
            }

            logBufferRef.current = [];
            return newLogs;
        });
    }, [maxLogs]);

    const fetchLogs = useCallback(async (signal) => {
        if (isUnmountedRef.current || !nodename) return;

        if (type === "instance" && !instanceName) {
            setErrorMessage("Instance name is required for instance logs");
            return;
        }

        const token = localStorage.getItem("authToken");
        if (!token) {
            setErrorMessage("Authentication token not found");
            return;
        }

        try {
            const url = buildLogUrl();
            console.log("Fetching logs from:", url);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Accept': 'text/event-stream',
                },
                signal,
            });

            if (!response.ok) {
                console.error(`HTTP error! status: ${response.status}`);
                setErrorMessage(`HTTP error! status: ${response.status}`);
                if (isConnectedRef.current !== false) {
                    setIsConnected(false);
                }
                return;
            }

            if (isConnectedRef.current !== true) {
                setIsConnected(true);
            }
            setErrorMessage("");
            if (isLoadingRef.current !== false) {
                setIsLoading(false);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const {value, done} = await reader.read();

                if (done) {
                    console.log("Stream completed");
                    break;
                }

                if (signal.aborted) {
                    reader.releaseLock();
                    return;
                }

                buffer += decoder.decode(value, {stream: true});
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ') && !isPausedRef.current) {
                        try {
                            const jsonStr = line.slice(6).trim();
                            if (jsonStr) {
                                const logData = JSON.parse(jsonStr);
                                const parsedLog = parseLogMessage(logData);
                                if (parsedLog.message.includes(`GET /api/node/name/${nodename}/log`)) {
                                    continue;
                                }
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
            if (isConnectedRef.current !== false) {
                setIsConnected(false);
            }

            if (error.message.includes('401')) {
                setErrorMessage("Authentication failed. Please refresh your token.");
            } else if (error.message.includes('404')) {
                if (type === "instance") {
                    setErrorMessage(`Instance logs endpoint not found for ${instanceName} on node ${nodename}`);
                } else {
                    setErrorMessage(`Logs endpoint not found for node ${nodename}`);
                }
            } else {
                setErrorMessage(`Failed to fetch logs: ${error.message}`);
            }
        } finally {
            if (isLoadingRef.current !== false) {
                setIsLoading(false);
            }
            if (!signal.aborted && !isUnmountedRef.current && !isPausedRef.current) {
                setTimeout(startStreaming, UPDATE_INTERVAL);
            }
        }
    }, [nodename, type, instanceName, maxLogs, buildLogUrl, parseLogMessage, updateLogs]);

    const startStreaming = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setIsLoading(true);
        setErrorMessage("");
        const controller = new AbortController();
        abortControllerRef.current = controller;
        fetchLogs(controller.signal);
    }, [fetchLogs]);

    useEffect(() => {
        if (isPausedRef.current) {
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
    }, [updateLogs]);

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

        if (type === "instance" && !instanceName) {
            setErrorMessage("Instance name is required for instance logs");
            return;
        }

        isUnmountedRef.current = false;
        if (!isPausedRef.current) {
            startStreaming();
        }

        return () => {
            isUnmountedRef.current = true;
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [nodename, type, instanceName, startStreaming]);

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
        return timestamp.toLocaleTimeString("fr-FR", {
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
            }}
        >
            {/* Header */}
            <Box sx={{mb: 2, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap"}}>
                <Typography variant="h6" sx={{flexGrow: 1}}>
                    {buildTitle()}
                    <Chip
                        label={isConnected ? "Connected" : "Disconnected"}
                        color={isConnected ? "success" : "error"}
                        size="small"
                        sx={{ml: 2}}
                    />
                    {isLoading && (
                        <CircularProgress size={16} sx={{ml: 1}}/>
                    )}
                </Typography>

                {/* Controls */}
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
                            <Clear/>
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

            {/* Status messages */}
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

            {/* Filters */}
            <Box sx={{mb: 2, display: "flex", gap: 2, flexWrap: "wrap"}}>
                <TextField
                    size="small"
                    placeholder="Search logs..."
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

            {/* Logs Container */}
            <Box
                ref={logsContainerRef}
                onScroll={handleScroll}
                sx={{
                    flexGrow: 1,
                    overflow: "auto",
                    bgcolor: "background.default",
                    p: 2,
                    borderRadius: 1,
                    fontFamily: "monospace",
                    fontSize: "0.85rem",
                    height: height,
                    "& .log-line": {
                        py: 0.5,
                        borderBottom: "1px solid",
                        borderColor: "divider",
                        "&:hover": {
                            bgcolor: "action.hover",
                        },
                    },
                }}
            >
                {filteredLogs.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" align="center">
                        {logs.length === 0 && !isLoading ? "No logs available" : "No logs match the current filters"}
                    </Typography>
                ) : (
                    filteredLogs.map((log, index) => (
                        <Box key={index} className="log-line">
                            <Box sx={{display: "flex", gap: 1, alignItems: "flex-start", flexWrap: "wrap"}}>
                                <Typography
                                    component="span"
                                    sx={{color: "text.secondary", minWidth: "100px"}}
                                >
                                    {formatTime(log.timestamp)}
                                </Typography>
                                <Typography
                                    component="span"
                                    sx={{
                                        color: getLevelColor(log.level),
                                        fontWeight: "bold",
                                        minWidth: "60px",
                                    }}
                                >
                                    [{log.level.toUpperCase()}]
                                </Typography>
                                {log.method && (
                                    <Typography
                                        component="span"
                                        sx={{color: "info.main", minWidth: "50px"}}
                                    >
                                        {log.method}
                                    </Typography>
                                )}
                                {log.path && (
                                    <Typography component="span" sx={{color: "text.secondary"}}>
                                        {log.path}
                                    </Typography>
                                )}
                                <Typography component="span" sx={{
                                    wordBreak: "break-word",
                                    flex: 1,
                                    minWidth: "100%",
                                    whiteSpace: "pre-wrap"
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
                    sx={{mt: 1}}
                >
                    Scroll to bottom
                </Button>
            )}
        </Paper>
    );
};

export default LogsViewer;
