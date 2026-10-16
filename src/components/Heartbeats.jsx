import React, {
    useEffect,
    useState,
    useMemo,
    useCallback,
    useRef,
    useDeferredValue,
    useSyncExternalStore,
} from "react";
import {useLocation, useNavigate} from "react-router-dom";
import {useTranslation} from "react-i18next";

import useEventStore from "../hooks/useEventStore.js";
import {retainEventReception} from "../eventSourceManager.jsx";
import EventLogger from "../components/EventLogger";
import {Table, HeaderRow, HeaderCell, SortHeaderCell, Row, Cell, EmptyRow} from "../ui/components/Table";
import {StatusMark} from "../ui/components/StatusMark";
import {Select} from "../ui/components/Field";
import {Button, IconButton} from "../ui/components/Button";
import {Alert} from "../ui/components/Alert";
import {Dialog} from "../ui/components/Dialog";
import {URL_NODE} from "../config/apiPath.js";
import {getResponseErrorMessage} from "../services/api.jsx";
import {useIsRoot} from "../hooks/useGrants";
import {Pager} from "../ui/components/Pager";
import {HeartbeatMesh} from "./HeartbeatMesh";
import {TabCount} from "../ui/components/Tabs";
import {usePaging} from "../app/paging";
import {ChevronDownIcon, CloseIcon, FilterIcon} from "../ui/icons";

// The breakpoints of the MUI theme the view used: below md (900px) the filters fold
// behind a button, from lg (1200px) they are always shown at first.
const MOBILE_QUERY = "(max-width:899.95px)";
const WIDE_QUERY = "(min-width:1200px)";

/** Whether a media query matches, kept up to date; false where matchMedia is missing. */
const useMediaQuery = (query) => useSyncExternalStore(
    useCallback((onChange) => {
        if (typeof window.matchMedia !== "function") return () => {};
        const list = window.matchMedia(query);
        list.addEventListener("change", onChange);
        return () => list.removeEventListener("change", onChange);
    }, [query]),
    () => typeof window.matchMedia === "function" && window.matchMedia(query).matches,
);

/** A running stream is up, a stopped or failed one down, a warning one warn. */
const STREAM_STATUS = {running: "up", warning: "warn", stopped: "down", failed: "down"};

/** The columns of the table, their titles translated at render. */
const COLUMNS = [
    {labelKey: "heartbeats.columns.running", key: "state"},
    {labelKey: "heartbeats.columns.beating", key: "beating"},
    {labelKey: "heartbeats.columns.id", key: "id"},
    {labelKey: "heartbeats.columns.node", key: "node"},
    {labelKey: "heartbeats.columns.peer", key: "peer"},
    {labelKey: "heartbeats.columns.type", key: "type"},
    {labelKey: "heartbeats.columns.desc", key: "desc"},
    {labelKey: "heartbeats.columns.changedAt", key: "changed_at"},
    {labelKey: "heartbeats.columns.lastBeatingAt", key: "last_beating_at"}
];

const StateMark = React.memo(({state}) => {
    const {t} = useTranslation();
    return <StatusMark state={STREAM_STATUS[state] ?? "unknown"} label={t("heartbeats.marks.state", {state: state || "unknown"})}/>;
}, (prev, next) => prev.state === next.state);

/** A beating peer is up, a stale one down. A single node has no peer to miss: up. */
const BeatingMark = React.memo(({isBeating, isSingleNode}) => {
    const {t} = useTranslation();
    return isSingleNode || isBeating
        ? <StatusMark state="up" label={t(isSingleNode ? "heartbeats.marks.healthySingleNode" : "heartbeats.marks.beating")}/>
        : <StatusMark state="down" label={t("heartbeats.marks.stale")}/>;
}, (prev, next) => prev.isBeating === next.isBeating && prev.isSingleNode === next.isSingleNode);

/**
 * A link of the mesh as a filter: "from>to", its streams the sender's tx and the
 * receiver's rx. A tx of the sender whose peer is not known is kept too: a stopped
 * stream reports no peer, and it is the one a link turning orange or red calls for.
 */
export const linkMatches = (link, row) => {
    const [from, to] = (link || "").split(">");
    if (!from || !to) return true;
    return (row.node === from && row.id.endsWith(".tx") && (row.peer === to || row.peerUnknown === true)) ||
        (row.node === to && row.id.endsWith(".rx") && row.peer === from);
};

/** The tint of an action by its risk: stopping a stream cuts a heartbeat, starting one restores it. */
const ACTION_TINT = {stop: "border-state-down text-state-down", start: "border-state-up text-state-up"};

/**
 * Stop a running stream, start one that is not: the daemon thread of the stream on
 * its node (om node daemon hb stop|start). Shown to root only, which they ask for;
 * its border and text in the tint of its risk, red to stop, green to start.
 */
const StreamAction = ({row, onAction}) => {
    const {t} = useTranslation();
    const action = row.state === "running" ? "stop" : "start";
    return (
        <Button size="sm" variant="secondary" className={ACTION_TINT[action]} onClick={() => onAction(row, action)}>
            {t(`heartbeats.actions.${action}`)}
        </Button>
    );
};

const HeartbeatRow = React.memo(({row, isSingleNode, onAction}) => {
    return (
        <Row>
            <Cell><StateMark state={row.state}/></Cell>
            <Cell><BeatingMark isBeating={row.isBeating} isSingleNode={isSingleNode}/></Cell>
            <Cell>{row.id}</Cell>
            <Cell>{row.node}</Cell>
            <Cell>{row.peer}</Cell>
            <Cell>{row.type}</Cell>
            <Cell>{row.desc}</Cell>
            {/* The dates stay on one line: wrapped, they would make the row taller than the others. */}
            <Cell className="whitespace-nowrap">{row.changedAt}</Cell>
            <Cell className="whitespace-nowrap">{row.lastBeatingAt}</Cell>
            {onAction && <Cell><StreamAction row={row} onAction={onAction}/></Cell>}
        </Row>
    );
}, (prev, next) => {
    return (
        prev.row.id === next.row.id &&
        prev.row.node === next.row.node &&
        prev.row.peer === next.row.peer &&
        prev.row.isBeating === next.row.isBeating &&
        prev.row.state === next.row.state &&
        prev.isSingleNode === next.isSingleNode &&
        prev.onAction === next.onAction
    );
});

const Heartbeats = () => {
    const {t} = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const eventStarted = useRef(false);
    const isMobile = useMediaQuery(MOBILE_QUERY);
    const isWideScreen = useMediaQuery(WIDE_QUERY);

    const heartbeatStatus = useEventStore((state) => state.heartbeatStatus);
    const [stoppedStreamsCache, setStoppedStreamsCache] = useState({});
    const [sortColumn, setSortColumn] = useState("node");
    const [sortDirection, setSortDirection] = useState("asc");

    const [showFilters, setShowFilters] = useState(() => isWideScreen ? true : !isMobile);
    // The raw table of the streams, folded by default under the mesh: open when the
    // URL filters it, a link asking for some streams in particular.
    const [showStreams, setShowStreams] = useState(() => {
        const params = new URLSearchParams(location.search);
        return ["status", "node", "state", "id", "link"].some((key) => params.has(key));
    });

    // Read query parameters
    const queryParams = new URLSearchParams(location.search);
    const rawStatus = queryParams.get("status") || "all";
    const rawNode = queryParams.get("node") || "all";
    const rawState = queryParams.get("state") || "all";
    const rawId = queryParams.get("id") || "all";
    const rawLink = queryParams.get("link") || "";
    // A link of the mesh, "from>to": its streams only.
    const [filterLink, setFilterLink] = useState(rawLink);

    const [filterBeating, setFilterBeating] = useState(
        ["all", "beating", "stale"].includes(rawStatus) ? rawStatus : "all"
    );
    const [filterNode, setFilterNode] = useState(rawNode);
    const [filterState, setFilterState] = useState(rawState);
    const [filterId, setFilterId] = useState(() => {
        let cleaned = rawId;
        if (cleaned.startsWith("hb#")) {
            cleaned = cleaned.replace(/^hb#/, "");
        }
        return cleaned.replace(/\.(rx|tx)$/, "");
    });

    const deferredFilterBeating = useDeferredValue(filterBeating);
    const deferredFilterNode = useDeferredValue(filterNode);
    const deferredFilterState = useDeferredValue(filterState);
    const deferredFilterId = useDeferredValue(filterId);
    const deferredSortColumn = useDeferredValue(sortColumn);
    const deferredSortDirection = useDeferredValue(sortDirection);

    const heartbeatEventTypes = useMemo(() => [
        "DaemonHeartbeatUpdated",
        "CONNECTION_OPENED",
        "CONNECTION_ERROR",
        "RECONNECTION_ATTEMPT",
        "MAX_RECONNECTIONS_REACHED",
        "CONNECTION_CLOSED"
    ], []);

    // Update URL when filters change
    useEffect(() => {
        const timer = setTimeout(() => {
            const currentParams = new URLSearchParams(location.search);
            const currentStatus = currentParams.get("status") || "all";
            const currentNode = currentParams.get("node") || "all";
            const currentState = currentParams.get("state") || "all";
            const currentId = currentParams.get("id") || "all";
            const currentLink = currentParams.get("link") || "";

            if (currentStatus === filterBeating &&
                currentNode === filterNode &&
                currentState === filterState &&
                currentId === filterId &&
                currentLink === filterLink) {
                return;
            }

            // The other parameters, the page size and the open panel's, stay as they
            // are; the page goes, the list filtered otherwise starting over from its first.
            const newQueryParams = new URLSearchParams(location.search);
            ["status", "node", "state", "id", "link", "offset"].forEach((key) => newQueryParams.delete(key));
            if (filterBeating !== "all") newQueryParams.set("status", filterBeating);
            if (filterNode !== "all") newQueryParams.set("node", filterNode);
            if (filterState !== "all") newQueryParams.set("state", filterState);
            if (filterId !== "all") newQueryParams.set("id", filterId);
            if (filterLink) newQueryParams.set("link", filterLink);

            const queryString = newQueryParams.toString();
            const newUrl = `${location.pathname}${queryString ? `?${queryString}` : ""}`;

            if (newUrl !== location.pathname + location.search) {
                navigate(newUrl, {replace: true});
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [filterBeating, filterNode, filterState, filterId, filterLink, navigate, location.pathname, location.search]);

    // Initialize filter states from URL
    useEffect(() => {
        let cleanedId = rawId;
        if (cleanedId.startsWith("hb#")) {
            cleanedId = cleanedId.replace(/^hb#/, "");
        }
        const baseId = cleanedId.replace(/\.(rx|tx)$/, "");

        setFilterBeating(["all", "beating", "stale"].includes(rawStatus) ? rawStatus : "all");
        setFilterNode(rawNode);
        setFilterState(rawState);
        setFilterId(baseId);
        setFilterLink(rawLink);
    }, [location.search, rawStatus, rawNode, rawState, rawId, rawLink]);

    // Cache stopped streams with their last known peers
    useEffect(() => {
        setStoppedStreamsCache((prev) => {
            const newCache = {...prev};
            const entries = Object.entries(heartbeatStatus);

            for (let i = 0; i < entries.length; i++) {
                const [node, nodeData] = entries[i];
                const streams = nodeData.streams || [];

                if (!newCache[node]) newCache[node] = {};

                for (let j = 0; j < streams.length; j++) {
                    const stream = streams[j];
                    if (Object.keys(stream.peers || {}).length > 0) {
                        newCache[node][stream.id] = {
                            ...stream,
                            peers: {...stream.peers},
                        };
                    }
                }
            }

            return newCache;
        });
    }, [heartbeatStatus]);

    // Start event reception with heartbeat-specific filters
    useEffect(() => {
        const token = localStorage.getItem("authToken");
        let release = null;
        if (token && !eventStarted.current) {
            release = retainEventReception(token, heartbeatEventTypes);
            eventStarted.current = true;
        }

        return () => {
            release?.();
            eventStarted.current = false;
        };
    }, [heartbeatEventTypes]);

    const nodes = useMemo(() => {
        return [...new Set(Object.keys(heartbeatStatus))].sort();
    }, [heartbeatStatus]);

    const isSingleNode = nodes.length === 1;

    const availableStates = useMemo(() => {
        const states = new Set(["all"]);
        const values = Object.values(heartbeatStatus);

        for (let i = 0; i < values.length; i++) {
            const streams = values[i].streams || [];
            for (let j = 0; j < streams.length; j++) {
                if (streams[j].state) states.add(streams[j].state);
            }
        }

        return Array.from(states).sort();
    }, [heartbeatStatus]);

    const availableIds = useMemo(() => {
        const ids = new Set();
        const values = Object.values(heartbeatStatus);

        for (let i = 0; i < values.length; i++) {
            const streams = values[i].streams || [];
            for (let j = 0; j < streams.length; j++) {
                const stream = streams[j];
                if (stream.id && stream.id !== "all") {
                    const cleanedId = stream.id.replace(/^hb#/, "");
                    const baseId = cleanedId.replace(/\.(rx|tx)$/, "");
                    ids.add(baseId);
                }
            }
        }

        return Array.from(ids).sort();
    }, [heartbeatStatus]);

    const streamRows = useMemo(() => {
        const notAvailable = t("common.notAvailable");
        const rows = [];
        const entries = Object.entries(heartbeatStatus);

        for (let i = 0; i < entries.length; i++) {
            const [node, nodeData] = entries[i];
            const streams = nodeData.streams || [];

            for (let j = 0; j < streams.length; j++) {
                const stream = streams[j];
                const cachedStream = stoppedStreamsCache[node]?.[stream.id] || {};
                const peers = stream.state === "stopped" && Object.keys(stream.peers || {}).length === 0
                    ? cachedStream.peers || {}
                    : stream.peers || {};

                const cleanedId = stream.id.replace(/^hb#/, "");

                if (Object.keys(peers).length === 0 && stream.state === "stopped") {
                    rows.push({
                        id: cleanedId,
                        node: node,
                        peer: notAvailable,
                        // Stopped, it reports no peer: toward any of them, as far as a link is concerned.
                        peerUnknown: true,
                        type: stream.type || notAvailable,
                        desc: notAvailable,
                        isBeating: false,
                        changedAt: notAvailable,
                        lastBeatingAt: notAvailable,
                        state: stream.state,
                    });
                } else {
                    const peerEntries = Object.entries(peers);
                    for (let k = 0; k < peerEntries.length; k++) {
                        const [peerKey, peerData] = peerEntries[k];
                        rows.push({
                            id: cleanedId,
                            node,
                            peer: peerKey || notAvailable,
                            type: stream.type || notAvailable,
                            desc: peerData?.desc || notAvailable,
                            isBeating: peerData?.is_beating || false,
                            changedAt: peerData?.changed_at || notAvailable,
                            lastBeatingAt: peerData?.last_beating_at || notAvailable,
                            state: stream.state || "unknown",
                        });
                    }
                }
            }
        }

        return rows;
    }, [heartbeatStatus, stoppedStreamsCache, t]);

    const sortedRows = useMemo(() => {
        const stateOrder = {running: 4, warning: 3, stopped: 2, failed: 1, unknown: 0};

        return [...streamRows].sort((a, b) => {
            let diff = 0;
            if (deferredSortColumn === "state") {
                diff = stateOrder[a.state] - stateOrder[b.state];
            } else if (deferredSortColumn === "beating") {
                diff = Number(a.isBeating) - Number(b.isBeating);
            } else if (deferredSortColumn === "id") {
                diff = a.id.localeCompare(b.id, undefined, {sensitivity: "base"});
            } else if (deferredSortColumn === "node") {
                diff = a.node.localeCompare(b.node, undefined, {sensitivity: "base"});
            } else if (deferredSortColumn === "peer") {
                diff = a.peer.localeCompare(b.peer, undefined, {sensitivity: "base"});
            } else if (deferredSortColumn === "type") {
                diff = a.type.localeCompare(b.type, undefined, {sensitivity: "base"});
            } else if (deferredSortColumn === "desc") {
                diff = a.desc.localeCompare(b.desc, undefined, {sensitivity: "base"});
            } else if (deferredSortColumn === "changed_at") {
                diff = a.changedAt.localeCompare(b.changedAt, undefined, {sensitivity: "base"});
            } else if (deferredSortColumn === "last_beating_at") {
                diff = a.lastBeatingAt.localeCompare(b.lastBeatingAt, undefined, {sensitivity: "base"});
            }
            return deferredSortDirection === "asc" ? diff : -diff;
        });
    }, [streamRows, deferredSortColumn, deferredSortDirection]);

    const filteredRows = useMemo(() => {
        return sortedRows.filter((row) => {
            const rowBaseId = row.id.replace(/\.(rx|tx)$/, "");
            return (
                (deferredFilterBeating === "all" ||
                    (deferredFilterBeating === "beating" && row.isBeating === true) ||
                    (deferredFilterBeating === "stale" && row.isBeating === false)) &&
                (deferredFilterNode === "all" || row.node === deferredFilterNode) &&
                (deferredFilterState === "all" || row.state === deferredFilterState) &&
                (deferredFilterId === "all" || rowBaseId === deferredFilterId) &&
                linkMatches(filterLink, row)
            );
        });
    }, [sortedRows, deferredFilterBeating, deferredFilterNode, deferredFilterState, deferredFilterId, filterLink]);

    // A line of the mesh clicked: its streams, unfolded, the other filters cleared.
    const handleMeshSelect = useCallback((group) => {
        setFilterBeating("all");
        setFilterNode("all");
        setFilterState("all");
        setFilterId("all");
        setFilterLink(`${group.from}>${group.to}`);
        setShowStreams(true);
    }, []);

    // Stop or start a stream, root only; stopping is confirmed first.
    const isRoot = useIsRoot();
    const [pendingStop, setPendingStop] = useState(null);
    const [actionFeedback, setActionFeedback] = useState(null);
    const runAction = useCallback(async (row, action) => {
        const label = t(`heartbeats.actions.${action}`);
        const name = row.id.replace(/^hb#/, "");
        const target = t("heartbeats.actions.target", {id: row.id, node: row.node});
        try {
            const response = await fetch(
                `${URL_NODE}/${encodeURIComponent(row.node)}/daemon/hb/name/${encodeURIComponent(name)}/action/${action}`,
                {method: "POST", headers: {Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`}},
            );
            if (!response.ok) {
                const message = (await getResponseErrorMessage(response)) || `HTTP ${response.status}`;
                setActionFeedback({tone: "error", message: t("heartbeats.actions.failed", {action: label, target, message})});
                return;
            }
            setActionFeedback({tone: "success", message: t("heartbeats.actions.requested", {action: label, target})});
        } catch (error) {
            setActionFeedback({tone: "error", message: t("heartbeats.actions.failed", {action: label, target, message: error.message})});
        }
    }, [t]);
    const handleAction = useCallback((row, action) => {
        if (action === "stop") setPendingStop(row);
        else void runAction(row, action);
    }, [runAction]);

    // The rows of the page shown, as oc3 pages its lists.
    const paging = usePaging("heartbeats", filteredRows.length);
    const {page: pageOf, setOffset: setPageOffset} = paging;
    const visibleRows = useMemo(() => pageOf(filteredRows), [pageOf, filteredRows]);

    const handleSort = useCallback((column) => {
        setSortColumn(prev => {
            if (prev === column) {
                setSortDirection(dir => dir === "asc" ? "desc" : "asc");
                return column;
            }
            setSortDirection("asc");
            return column;
        });
        // Sorted again, the list starts over: from its first page.
        setPageOffset(0);
    }, [setPageOffset]);

    const toggleShowFilters = useCallback(() => {
        setShowFilters(prev => !prev);
    }, []);

    const handleFilterChange = useCallback((setter) => (event) => {
        setter(event.target.value);
    }, []);

    const filterSelect = (label, value, setter, options) => (
        <label className="flex items-center gap-1 text-ink-muted">
            {label}
            <Select className="h-7" value={value} onChange={handleFilterChange(setter)}>
                <option value="all">{t("common.all")}</option>
                {options.map(([optionValue, optionLabel]) => (
                    <option key={optionValue} value={optionValue}>{optionLabel}</option>
                ))}
            </Select>
        </label>
    );

    return (
        <div className="flex h-full flex-col p-4 space-y-3">
            <HeartbeatMesh heartbeatStatus={heartbeatStatus} onSelect={handleMeshSelect}/>

            <button
                type="button"
                className="flex shrink-0 items-center gap-1.5 self-start font-semibold"
                aria-expanded={showStreams}
                aria-controls="heartbeats-streams"
                onClick={() => setShowStreams((open) => !open)}
            >
                <ChevronDownIcon className={showStreams ? "h-4 w-4" : "h-4 w-4 -rotate-90"}/>
                {t("heartbeats.streams")}
                <TabCount count={filteredRows.length}/>
            </button>

            {showStreams && (
                <div id="heartbeats-streams" className="flex min-h-0 flex-1 flex-col space-y-3">
                    <div className="flex shrink-0 flex-wrap items-center gap-3">
                        {isMobile && (
                            <Button
                                variant="ghost"
                                size="sm"
                                icon={<FilterIcon className="h-4 w-4"/>}
                                onClick={toggleShowFilters}
                                aria-label={showFilters ? t("heartbeats.filters.hide") : t("heartbeats.filters.show")}
                                aria-expanded={showFilters}
                                aria-controls="heartbeats-filters"
                            >
                                <span className="hidden sm:inline">{t("common.filters")}</span>
                                <ChevronDownIcon className={showFilters ? "h-4 w-4 rotate-180" : "h-4 w-4"}/>
                            </Button>
                        )}
                        <div
                            id="heartbeats-filters"
                            hidden={!showFilters}
                            className="flex flex-wrap items-center gap-3"
                        >
                            {filterSelect(t("heartbeats.filters.running"), filterState, setFilterState, availableStates
                                .filter(s => s !== "all")
                                .map(state => [state, state.charAt(0).toUpperCase() + state.slice(1)]))}
                            {filterSelect(t("heartbeats.filters.beating"), filterBeating, setFilterBeating, [
                                ["beating", t("heartbeats.marks.beating")],
                                ["stale", t("heartbeats.marks.stale")],
                            ])}
                            {filterSelect(t("common.node"), filterNode, setFilterNode, nodes.map(node => [node, node]))}
                            {filterSelect(t("heartbeats.filters.id"), filterId, setFilterId, availableIds.map(id => [id, id]))}
                            {filterLink && (
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-raised px-2 text-data"
                                    aria-label={t("heartbeats.filters.clearLink", {link: filterLink.replace(">", " → ")})}
                                    onClick={() => setFilterLink("")}
                                >
                                    {filterLink.replace(">", " → ")}
                                    <CloseIcon className="h-3 w-3"/>
                                </button>
                            )}
                        </div>
                    </div>

                    {actionFeedback && (
                        <Alert
                            tone={actionFeedback.tone}
                            className="shrink-0"
                            action={
                                <IconButton label={t("common.close")} bare onClick={() => setActionFeedback(null)}>
                                    <CloseIcon className="h-4 w-4"/>
                                </IconButton>
                            }
                        >
                            {actionFeedback.message}
                        </Alert>
                    )}

                    <Pager paging={paging}/>

                    <Table sticky className="min-h-0 overflow-auto">
                        <thead>
                            <HeaderRow>
                                {COLUMNS.map(({labelKey, key}) => (
                                    <SortHeaderCell
                                        key={key}
                                        label={t(labelKey)}
                                        active={sortColumn === key}
                                        direction={sortDirection}
                                        onSort={() => handleSort(key)}
                                    />
                                ))}
                                {isRoot && <HeaderCell>{t("heartbeats.actions.label")}</HeaderCell>}
                            </HeaderRow>
                        </thead>
                        <tbody>
                            {visibleRows.map(row => (
                                <HeartbeatRow
                                    key={`${row.node}-${row.id}-${row.peer}`}
                                    row={row}
                                    isSingleNode={isSingleNode}
                                    onAction={isRoot ? handleAction : undefined}
                                />
                            ))}
                            {visibleRows.length === 0 && (
                                <EmptyRow colSpan={COLUMNS.length + (isRoot ? 1 : 0)}>
                                    {t("heartbeats.empty")}
                                </EmptyRow>
                            )}
                        </tbody>
                    </Table>
                </div>
            )}

            <Dialog
                open={pendingStop !== null}
                onClose={() => setPendingStop(null)}
                title={t("heartbeats.actions.confirmTitle")}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setPendingStop(null)}>{t("common.cancel")}</Button>
                        <Button variant="danger" onClick={() => {
                            const row = pendingStop;
                            setPendingStop(null);
                            void runAction(row, "stop");
                        }}>
                            {t("heartbeats.actions.stop")}
                        </Button>
                    </>
                }
            >
                <p>{pendingStop && t("heartbeats.actions.confirmStop", {id: pendingStop.id, node: pendingStop.node})}</p>
            </Dialog>

            <EventLogger eventTypes={heartbeatEventTypes} title={t("heartbeats.eventsLogger")}
                         buttonLabel={t("heartbeats.events")}/>
        </div>
    );
};

export default Heartbeats;
