import React, {useEffect, useState, useMemo, useCallback, useRef, useDeferredValue} from "react";
import {useNavigate, useLocation} from "react-router-dom";
import {closeEventSource, startEventReception} from "../eventSourceManager.jsx";
import EventLogger from "../components/EventLogger";
import {useKindData} from "../hooks/useKindData";
import {Table, HeaderRow, SortHeaderCell, Row, Cell, EmptyRow} from "../ui/components/Table";
import {StatusCount} from "../ui/components/StatusCount";
import {Select} from "../ui/components/Field";
import {Spinner} from "../ui/components/Spinner";

const STATUSES = ["up", "down", "warn", "unprovisioned"];

const STATUS_COLUMNS = [
    {column: "up", label: "Up"},
    {column: "down", label: "Down"},
    {column: "warn", label: "Warn"},
    {column: "unprovisioned", label: "Unprovisioned"},
];

const MARK_STATE = {up: "up", down: "down", warn: "warn", unprovisioned: "down"};

const areStatusDotPropsEqual = (prev, next) =>
    prev.status === next.status && prev.count === next.count && prev.kind === next.kind;

/** A status mark and its count; the count opens the objects of the kind in that state. */
const KindStatusCount = React.memo(({status, count, kind, onClick}) => (
    <StatusCount
        state={MARK_STATE[status]}
        markLabel={status === "unprovisioned" ? "unprovisioned" : undefined}
        count={count}
        label={`Show the ${count} ${status} object${count === 1 ? "" : "s"} of ${kind}`}
        onClick={() => onClick(status)}
    />
), (prev, next) => areStatusDotPropsEqual(prev, next) && prev.onClick === next.onClick);

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

    const handleStatusClick = useCallback((status) => {
        onStatusClick(kind, status);
    }, [onStatusClick, kind]);

    return (
        <Row onActivate={handleRowClick}>
            <Cell className="font-medium">{kind}</Cell>
            {STATUSES.map((status) => (
                <Cell key={status} numeric>
                    <KindStatusCount
                        status={status}
                        count={counts[status] || 0}
                        kind={kind}
                        onClick={handleStatusClick}
                    />
                </Cell>
            ))}
            <Cell numeric className="font-semibold tabular-nums">{total}</Cell>
        </Row>
    );
}, (prev, next) => {
    return prev.kind === next.kind &&
        prev.counts.up === next.counts.up &&
        prev.counts.down === next.counts.down &&
        prev.counts.warn === next.counts.warn &&
        prev.counts.unprovisioned === next.counts.unprovisioned;
});

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

    const handleKindChange = useCallback((e) => {
        const newKind = e.target.value || "all";
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
        const url = `/objects?kind=${kind}&globalState=${status}`;
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

    // The filter may come from the URL with a kind not in the list: keep it selectable.
    const kindOptions = useMemo(() => {
        const options = ["all", ...kinds];
        if (!options.includes(selectedKind)) options.push(selectedKind);
        return options;
    }, [kinds, selectedKind]);

    return (
        <div className="flex h-full flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1 text-ink-muted">
                    Filter by kind
                    <Select className="h-7" value={selectedKind} onChange={handleKindChange}>
                        {kindOptions.map((kind) => (
                            <option key={kind} value={kind}>{kind}</option>
                        ))}
                    </Select>
                </label>
            </div>

            <Table
                ref={tableContainerRef}
                sticky
                data-testid="table-container"
                className="min-h-0 flex-1 overflow-auto"
            >
                <thead>
                    <HeaderRow>
                        <SortHeaderCell
                            label="Kind"
                            active={sortColumn === "kind"}
                            direction={sortDirection}
                            onSort={() => handleSort("kind")}
                        />
                        {STATUS_COLUMNS.map(({column, label}) => (
                            <SortHeaderCell
                                key={column}
                                label={label}
                                active={sortColumn === column}
                                direction={sortDirection}
                                onSort={() => handleSort(column)}
                                align="right"
                            />
                        ))}
                        <SortHeaderCell
                            label="Total"
                            active={sortColumn === "total"}
                            direction={sortDirection}
                            onSort={() => handleSort("total")}
                            align="right"
                        />
                    </HeaderRow>
                </thead>
                <tbody>
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
                        <EmptyRow colSpan={6}>
                            <span data-testid="no-kinds-message">
                                {selectedKind !== "all"
                                    ? "No kinds match the selected filter"
                                    : "No kinds available"}
                            </span>
                        </EmptyRow>
                    )}
                </tbody>
            </Table>
            {loading && (
                <div className="flex justify-center">
                    <Spinner label="Loading more kinds"/>
                </div>
            )}

            <EventLogger
                eventTypes={kindEventTypes}
                title="Kinds Events Logger"
                buttonLabel="Kind Events"
            />
        </div>
    );
};

export default Kinds;
