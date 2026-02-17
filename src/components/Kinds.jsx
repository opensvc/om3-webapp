import React, {useEffect, useState, useMemo, useCallback, useRef, useDeferredValue} from "react";
import {
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    Autocomplete,
    TextField,
    CircularProgress,
} from "@mui/material";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import {green, red, orange, grey} from "@mui/material/colors";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import {useNavigate, useLocation} from "react-router-dom";
import {closeEventSource, startEventReception} from "../eventSourceManager.jsx";
import EventLogger from "../components/EventLogger";
import {useKindData} from "../hooks/useKindData";

const getColorByStatus = (status) => {
    switch (status) {
        case "up":
            return green[500];
        case "down":
            return red[500];
        case "warn":
            return orange[500];
        case "unprovisioned":
            return red[500];
        default:
            return grey[500];
    }
};

const StatusDot = React.memo(({status, count}) => (
    <Box display="flex" justifyContent="center" alignItems="center" gap={1}>
        <FiberManualRecordIcon
            sx={{fontSize: 18, color: getColorByStatus(status)}}
        />
        <Typography variant="body1">{count}</Typography>
    </Box>
), (prev, next) => prev.status === next.status && prev.count === next.count);

const KindTableRow = React.memo(({
                                     kind,
                                     counts,
                                     onKindClick,
                                     onStatusClick
                                 }) => {
    const total = useMemo(() =>
            counts.up + counts.down + counts.warn + counts.unprovisioned,
        [counts]
    );

    const handleRowClick = useCallback(() => {
        onKindClick(kind);
    }, [onKindClick, kind]);

    const handleStatusClick = useCallback((e, status) => {
        e.stopPropagation();
        onStatusClick(kind, status);
    }, [onStatusClick, kind]);

    return (
        <TableRow
            hover
            onClick={handleRowClick}
            sx={{cursor: "pointer"}}
        >
            <TableCell sx={{fontWeight: 500}}>
                {kind}
            </TableCell>
            {["up", "down", "warn", "unprovisioned"].map((status) => (
                <TableCell
                    key={status}
                    align="center"
                    onClick={(e) => handleStatusClick(e, status)}
                    sx={{cursor: "pointer"}}
                >
                    <StatusDot status={status} count={counts[status] || 0}/>
                </TableCell>
            ))}
            <TableCell align="center">
                <Typography variant="body1" fontWeight={600}>
                    {total}
                </Typography>
            </TableCell>
        </TableRow>
    );
}, (prev, next) => {
    return prev.kind === next.kind &&
        prev.counts.up === next.counts.up &&
        prev.counts.down === next.counts.down &&
        prev.counts.warn === next.counts.warn &&
        prev.counts.unprovisioned === next.counts.unprovisioned;
});

const SortableTableCell = React.memo(({
                                          column,
                                          label,
                                          currentSortColumn,
                                          sortDirection,
                                          onSort,
                                          align = "left"
                                      }) => {
        const handleClick = useCallback(() => {
            onSort(column);
        }, [onSort, column]);

        return (
            <TableCell
                align={align}
                onClick={handleClick}
                sx={{cursor: "pointer"}}
            >
                <Box sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: align === "center" ? "center" : "flex-start",
                    gap: 0.5
                }}>
                    <strong>{label}</strong>
                    {currentSortColumn === column && (
                        sortDirection === "asc"
                            ? <KeyboardArrowUpIcon fontSize="small"/>
                            : <KeyboardArrowDownIcon fontSize="small"/>
                    )}
                </Box>
            </TableCell>
        );
    }, (prev, next) =>
        prev.column === next.column &&
        prev.currentSortColumn === next.currentSortColumn &&
        prev.sortDirection === next.sortDirection
);

const Kinds = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const isMounted = useRef(true);
    const tableContainerRef = useRef(null);

    const queryParams = new URLSearchParams(location.search);
    const urlKind = queryParams.get("kind");

    const [sortColumn, setSortColumn] = useState("kind");
    const [sortDirection, setSortDirection] = useState("asc");
    const [selectedKind, setSelectedKind] = useState(urlKind || "all");
    const [visibleCount, setVisibleCount] = useState(50);
    const [loading, setLoading] = useState(false);

    const {statusByKind, kinds} = useKindData();

    const deferredSelectedKind = useDeferredValue(selectedKind);
    const deferredSortColumn = useDeferredValue(sortColumn);
    const deferredSortDirection = useDeferredValue(sortDirection);

    const kindEventTypes = useMemo(() => [
        'ObjectStatusUpdated',
        'InstanceStatusUpdated',
        'ObjectDeleted',
        'InstanceConfigUpdated'
    ], []);

    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (token) {
            startEventReception(token, kindEventTypes);
        }
        return () => {
            closeEventSource();
        };
    }, [kindEventTypes]);

    useEffect(() => {
        setSelectedKind(urlKind || "all");
    }, [urlKind]);

    const sortedKinds = useMemo(() => {
        const entries = Object.entries(statusByKind);

        const filtered = deferredSelectedKind === "all"
            ? entries
            : entries.filter(([kind]) => kind === deferredSelectedKind);

        return filtered.sort((a, b) => {
            const [kindA, countsA] = a;
            const [kindB, countsB] = b;
            let diff = 0;

            if (deferredSortColumn === "kind") {
                diff = kindA.localeCompare(kindB);
            } else if (deferredSortColumn === "up") {
                diff = countsA.up - countsB.up;
            } else if (deferredSortColumn === "down") {
                diff = countsA.down - countsB.down;
            } else if (deferredSortColumn === "warn") {
                diff = countsA.warn - countsB.warn;
            } else if (deferredSortColumn === "unprovisioned") {
                diff = countsA.unprovisioned - countsB.unprovisioned;
            } else if (deferredSortColumn === "total") {
                const totalA = countsA.up + countsA.down + countsA.warn + countsA.unprovisioned;
                const totalB = countsB.up + countsB.down + countsB.warn + countsB.unprovisioned;
                diff = totalA - totalB;
            }

            return deferredSortDirection === "asc" ? diff : -diff;
        });
    }, [statusByKind, deferredSelectedKind, deferredSortColumn, deferredSortDirection]);

    const visibleKinds = useMemo(() =>
            sortedKinds.slice(0, visibleCount),
        [sortedKinds, visibleCount]
    );

    const handleSort = useCallback((column) => {
        setSortColumn(prev => {
            if (prev === column) {
                setSortDirection(dir => dir === "asc" ? "desc" : "asc");
                return column;
            }
            setSortDirection("asc");
            return column;
        });
        setVisibleCount(50);
    }, []);

    const handleKindChange = useCallback((e, val) => {
        const newKind = val || "all";
        setSelectedKind(newKind);
        setVisibleCount(50);

        if (newKind === "all") {
            navigate("/kinds");
        } else {
            navigate(`/kinds?kind=${newKind}`);
        }
    }, [navigate]);

    const handleKindClick = useCallback((kind) => {
        navigate(`/objects?kind=${kind}`);
    }, [navigate]);

    const handleStatusClick = useCallback((kind, status) => {
        const url = `/objects?kind=${kind}&globalState=${status === 'unprovisioned' ? 'unprovisioned' : status}`;
        navigate(url);
    }, [navigate]);

    const handleScroll = useCallback(() => {
        if (loading) return;

        const container = tableContainerRef.current;
        if (!container) return;

        const {scrollTop, scrollHeight, clientHeight} = container;
        const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

        if (scrollPercentage > 0.8 && visibleCount < sortedKinds.length) {
            setLoading(true);
            setTimeout(() => {
                setVisibleCount(prev => Math.min(prev + 50, sortedKinds.length));
                setLoading(false);
            }, 100);
        }
    }, [loading, visibleCount, sortedKinds.length]);

    useEffect(() => {
        const container = tableContainerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
            return () => container.removeEventListener('scroll', handleScroll);
        }
    }, [handleScroll]);

    useEffect(() => {
        setVisibleCount(50);
    }, [sortedKinds]);

    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    const renderTextField = useCallback((params) => (
        <TextField {...params} label="Filter by kind"/>
    ), []);

    return (
        <Box
            sx={{
                bgcolor: "background.default",
                display: "flex",
                justifyContent: "center",
                p: 0,
                position: 'relative',
                minHeight: '100vh',
                width: '100vw',
                margin: 0,
            }}
        >
            <Box
                sx={{
                    width: "100%",
                    bgcolor: "background.paper",
                    border: "2px solid",
                    borderColor: "divider",
                    borderRadius: 0,
                    boxShadow: 3,
                    p: 3,
                    m: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    height: '100vh'
                }}
            >
                {/* Kind Filter */}
                <Box sx={{mb: 3, flexShrink: 0}}>
                    <Autocomplete
                        sx={{width: 300}}
                        options={["all", ...kinds]}
                        value={selectedKind}
                        onChange={handleKindChange}
                        renderInput={renderTextField}
                    />
                </Box>

                <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 2,
                    flexShrink: 0
                }}>
                    <Typography variant="body2" color="textSecondary">
                        Showing {visibleKinds.length} of {sortedKinds.length} kinds
                    </Typography>
                </Box>

                <TableContainer
                    ref={tableContainerRef}
                    sx={{
                        flex: 1,
                        minHeight: 0,
                        overflow: "auto",
                        boxShadow: "none",
                        border: "none"
                    }}
                >
                    <Table>
                        <TableHead sx={{position: "sticky", top: 0, zIndex: 20, backgroundColor: "background.paper"}}>
                            <TableRow>
                                <SortableTableCell
                                    column="kind"
                                    label="Kind"
                                    currentSortColumn={sortColumn}
                                    sortDirection={sortDirection}
                                    onSort={handleSort}
                                />
                                <SortableTableCell
                                    column="up"
                                    label="Up"
                                    currentSortColumn={sortColumn}
                                    sortDirection={sortDirection}
                                    onSort={handleSort}
                                    align="center"
                                />
                                <SortableTableCell
                                    column="down"
                                    label="Down"
                                    currentSortColumn={sortColumn}
                                    sortDirection={sortDirection}
                                    onSort={handleSort}
                                    align="center"
                                />
                                <SortableTableCell
                                    column="warn"
                                    label="Warn"
                                    currentSortColumn={sortColumn}
                                    sortDirection={sortDirection}
                                    onSort={handleSort}
                                    align="center"
                                />
                                <SortableTableCell
                                    column="unprovisioned"
                                    label="Unprovisioned"
                                    currentSortColumn={sortColumn}
                                    sortDirection={sortDirection}
                                    onSort={handleSort}
                                    align="center"
                                />
                                <SortableTableCell
                                    column="total"
                                    label="Total"
                                    currentSortColumn={sortColumn}
                                    sortDirection={sortDirection}
                                    onSort={handleSort}
                                    align="center"
                                />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {visibleKinds.length > 0 ? (
                                visibleKinds.map(([kind, counts]) => (
                                    <KindTableRow
                                        key={kind}
                                        kind={kind}
                                        counts={counts}
                                        onKindClick={handleKindClick}
                                        onStatusClick={handleStatusClick}
                                    />
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} align="center">
                                        <Typography data-testid="no-kinds-message">
                                            {selectedKind !== "all"
                                                ? "No kinds match the selected filter"
                                                : "No kinds available"}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    {loading && (
                        <Box sx={{display: 'flex', justifyContent: 'center', padding: 2}}>
                            <CircularProgress size={24}/>
                        </Box>
                    )}
                </TableContainer>

                {/*<EventLogger eventTypes={kindEventTypes} title="Kinds Events Logger" buttonLabel="Kind Events"/>*/}
            </Box>
        </Box>
    );
};

export default Kinds;
