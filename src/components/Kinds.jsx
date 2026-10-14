import React, {useEffect, useState, useMemo, useCallback, useRef, useDeferredValue} from "react";
import {useNavigate, useLocation} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {retainEventReception} from "../eventSourceManager.jsx";
import EventLogger from "../components/EventLogger";
import {useKindData} from "../hooks/useKindData";
import {Table, HeaderRow, SortHeaderCell, Row, Cell, EmptyRow} from "../ui/components/Table";
import {StatusCount} from "../ui/components/StatusCount";
import {Select} from "../ui/components/Field";
import {Spinner} from "../ui/components/Spinner";
import {objectsUrl} from "../utils/objectLists";

/**
 * The states an object of a kind is in, each object in one of them: a cfg, a
 * sec or a usr has no status, n/a. Unprovisioned is said apart: an object
 * unprovisioned is counted in its state too.
 */
const STATES = ["up", "down", "warn", "n/a"];
const STATUSES = [...STATES, "unprovisioned"];

const STATUS_COLUMNS = [
    {column: "up", labelKey: "kinds.columns.up"},
    {column: "down", labelKey: "kinds.columns.down"},
    {column: "warn", labelKey: "kinds.columns.warn"},
    {column: "n/a", labelKey: "kinds.columns.na"},
    {column: "unprovisioned", labelKey: "kinds.columns.unprovisioned"},
];

const MARK_STATE = {up: "up", down: "down", warn: "warn", "n/a": "na", unprovisioned: "down"};

/** How many objects of the kind: each once, in its state. */
const totalOf = (counts) => STATES.reduce((sum, state) => sum + (counts[state] || 0), 0);

const areStatusDotPropsEqual = (prev, next) =>
    prev.status === next.status && prev.count === next.count && prev.kind === next.kind;

/** A status mark and its count; the count opens the objects of the kind in that state. */
const KindStatusCount = React.memo(({status, count, kind, onClick}) => {
    const {t} = useTranslation();
    return (
        <StatusCount
            state={MARK_STATE[status]}
            markLabel={status === "unprovisioned" ? "unprovisioned" : undefined}
            count={count}
            label={t("kinds.showObjects", {count, status, kind})}
            onClick={() => onClick(status)}
        />
    );
}, (prev, next) => areStatusDotPropsEqual(prev, next) && prev.onClick === next.onClick);

const KindTableRow = React.memo(({
                                     kind,
                                     counts,
                                     onKindClick,
                                     onStatusClick
                                 }) => {
    const total = useMemo(() => totalOf(counts), [counts]);

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
        prev.counts["n/a"] === next.counts["n/a"] &&
        prev.counts.unprovisioned === next.counts.unprovisioned;
});

/** The objects by kind. `embedded` in a tab of the Objects page, which pads it. */
const Kinds = ({embedded = false}) => {
    const {t} = useTranslation();
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
        const release = token ? retainEventReception(token, kindEventTypes) : null;
        return () => {
            release?.();
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
            } else if (deferredSortColumn === "n/a") {
                diff = countsA["n/a"] - countsB["n/a"];
            } else if (deferredSortColumn === "unprovisioned") {
                diff = countsA.unprovisioned - countsB.unprovisioned;
            } else if (deferredSortColumn === "total") {
                diff = totalOf(countsA) - totalOf(countsB);
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
            navigate("/objects?list=kinds");
        } else {
            navigate(`/objects?list=kinds&kind=${encodeURIComponent(newKind)}`);
        }
    }, [navigate]);

    const handleKindClick = useCallback((kind) => {
        // On the tab the objects of the kind are listed in.
        navigate(objectsUrl({kind}));
    }, [navigate]);

    const handleStatusClick = useCallback((kind, status) => {
        navigate(objectsUrl({kind, globalState: status}));
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
        <div className={embedded ? "flex h-full flex-col gap-3" : "flex h-full flex-col gap-3 p-4"}>
            <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1 text-ink-muted">
                    {t("kinds.filterBy")}
                    <Select className="h-7" value={selectedKind} onChange={handleKindChange}>
                        {kindOptions.map((kind) => (
                            <option key={kind} value={kind}>{kind === "all" ? t("kinds.allOption") : kind}</option>
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
                            label={t("kinds.columns.kind")}
                            active={sortColumn === "kind"}
                            direction={sortDirection}
                            onSort={() => handleSort("kind")}
                        />
                        {STATUS_COLUMNS.map(({column, labelKey}) => (
                            <SortHeaderCell
                                key={column}
                                label={t(labelKey)}
                                active={sortColumn === column}
                                direction={sortDirection}
                                onSort={() => handleSort(column)}
                            />
                        ))}
                        <SortHeaderCell
                            label={t("kinds.columns.total")}
                            active={sortColumn === "total"}
                            direction={sortDirection}
                            onSort={() => handleSort("total")}
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
                        <EmptyRow colSpan={STATUS_COLUMNS.length + 2}>
                            <span data-testid="no-kinds-message">
                                {selectedKind !== "all"
                                    ? t("kinds.emptyFiltered")
                                    : t("kinds.empty")}
                            </span>
                        </EmptyRow>
                    )}
                </tbody>
            </Table>
            {loading && (
                <div className="flex justify-center">
                    <Spinner label={t("kinds.loadingMore")}/>
                </div>
            )}

            <EventLogger
                eventTypes={kindEventTypes}
                title={t("kinds.eventsLogger")}
                buttonLabel={t("kinds.events")}
            />
        </div>
    );
};

export default Kinds;
