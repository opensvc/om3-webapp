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
import {Table, HeaderRow, HeaderCell, SortHeaderCell, Row, Cell, EmptyRow} from "../ui/components/Table";
import {Checkbox, Select} from "../ui/components/Field";
import {Button, IconButton} from "../ui/components/Button";
import {Alert} from "../ui/components/Alert";
import {Dialog} from "../ui/components/Dialog";
import {URL_NODE} from "../config/apiPath.js";
import {getResponseErrorMessage} from "../services/api.jsx";
import {useIsRoot} from "../hooks/useGrants";
import {Pager} from "../ui/components/Pager";
import {AgeTime} from "./AgeTime";
import {HeartbeatMesh} from "./HeartbeatMesh";
import {HeartbeatSummary} from "./HeartbeatSummary";
import {TabCount, TabList} from "../ui/components/Tabs";
import {tabPanelProps, useTabsId} from "../ui/components/tabs-ids";
import LogsViewer from "./LogsViewer";
import {heartbeatLogs} from "../app/heartbeat-logs";
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
    {labelKey: "heartbeats.columns.heartbeat", key: "id"},
    {labelKey: "heartbeats.columns.type", key: "type"},
    {labelKey: "heartbeats.columns.node", key: "node"},
    {labelKey: "heartbeats.columns.direction", key: "side"},
    {labelKey: "heartbeats.columns.peer", key: "peer"},
    {labelKey: "heartbeats.columns.desc", key: "desc"},
    {labelKey: "heartbeats.columns.routine", key: "state"},
    {labelKey: "heartbeats.columns.beating", key: "beating"},
    {labelKey: "heartbeats.columns.since", key: "changed_at"},
    {labelKey: "heartbeats.columns.lastBeat", key: "last_beating_at"},
];

/** The heartbeat of a row and its side: "hb#1", "rx". */
const rowHeartbeat = (row) => `hb#${row.id.replace(/\.(rx|tx)$/, "")}`;
const rowSide = (row) => /\.(rx|tx)$/.exec(row.id)?.[1] ?? "";

/** The tint of a status as text, as the marks of the objects tint their glyph. */
const INK = {up: "text-state-up", warn: "text-state-warn", down: "text-state-down", unknown: "text-state-unknown"};

/** A status said in a word, in its tint: the table reads by its words, not by glyphs. */
const StatusText = ({status, children}) => (
    <span data-state={status} className={`whitespace-nowrap ${INK[status]}`}>{children}</span>
);

/**
 * The routine of the stream, its daemon thread, in a word: started when it runs,
 * stopped, or the state the daemon says when it is neither.
 */
const routineWord = (state, t) =>
    state === "running" || state === "stopped" ? t(`heartbeats.routine.${state}`) : (state || "unknown");

/**
 * The direction of the stream between the node and the peer columns, in words the
 * row reads by: the node sends to the peer on a tx, receives from it on an rx.
 */
const DirectionMark = ({side}) => {
    const {t} = useTranslation();
    if (side !== "tx" && side !== "rx") return null;
    return t(`heartbeats.direction.${side}`);
};

/** A beating peer is up, a stale one down. A single node has no peer to miss: up. */
const BeatingMark = React.memo(({isBeating, isSingleNode}) => {
    const {t} = useTranslation();
    return isSingleNode || isBeating
        ? <StatusText status="up">{t(isSingleNode ? "heartbeats.marks.healthySingleNode" : "heartbeats.marks.beating")}</StatusText>
        : <StatusText status="down">{t("heartbeats.marks.stale")}</StatusText>;
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

/**
 * The routine of the stream, its daemon thread, in a word. Started is the normal
 * state, said in the ink of the text; stopped, failed or warning in their tint.
 * For root the word is the button of the action it calls for: stop a started one,
 * start one that is not (om node daemon hb stop|start), the stop confirmed first.
 */
const Routine = ({row, onAction}) => {
    const {t} = useTranslation();
    const status = STREAM_STATUS[row.state] ?? "unknown";
    const ink = row.state === "running" ? "text-ink" : INK[status];
    const word = routineWord(row.state, t);
    if (!onAction) {
        return <span data-state={status} className={`whitespace-nowrap ${ink}`}>{word}</span>;
    }
    const action = row.state === "running" ? "stop" : "start";
    const label = t(`heartbeats.actions.${action}`);
    return (
        <button
            type="button"
            data-state={status}
            title={label}
            aria-label={`${word}, ${label}`}
            onClick={() => onAction(row, action)}
            className={`whitespace-nowrap rounded-(--radius-control) underline decoration-dotted underline-offset-4 hover:decoration-solid focus-visible:outline-2 focus-visible:outline-(--focus-ring) ${ink}`}
        >
            {word}
        </button>
    );
};

const HeartbeatRow = React.memo(({row, isSingleNode, onAction}) => {
    return (
        <Row>
            <Cell className="whitespace-nowrap">{rowHeartbeat(row)}</Cell>
            <Cell>{row.type}</Cell>
            <Cell>{row.node}</Cell>
            <Cell className="whitespace-nowrap"><DirectionMark side={rowSide(row)}/></Cell>
            <Cell>{row.peer}</Cell>
            <Cell>{row.desc}</Cell>
            <Cell><Routine row={row} onAction={onAction}/></Cell>
            <Cell><BeatingMark isBeating={row.isBeating} isSingleNode={isSingleNode}/></Cell>
            {/* The dates stay on one line: wrapped, they would make the row taller than the others. */}
            <Cell className="whitespace-nowrap"><AgeTime value={row.changedAt}/></Cell>
            <Cell className="whitespace-nowrap"><AgeTime value={row.lastBeatingAt}/></Cell>
        </Row>
    );
}, (prev, next) => {
    return (
        prev.row.id === next.row.id &&
        prev.row.node === next.row.node &&
        prev.row.peer === next.row.peer &&
        prev.row.isBeating === next.row.isBeating &&
        prev.row.state === next.row.state &&
        prev.row.type === next.row.type &&
        prev.row.desc === next.row.desc &&
        prev.row.changedAt === next.row.changedAt &&
        prev.row.lastBeatingAt === next.row.lastBeatingAt &&
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

    // Read query parameters
    const queryParams = new URLSearchParams(location.search);
    const rawStatus = queryParams.get("status") || "all";
    const rawNode = queryParams.get("node") || "all";
    const rawState = queryParams.get("state") || "all";
    const rawId = queryParams.get("id") || "all";
    const rawLink = queryParams.get("link") || "";
    const rawType = queryParams.get("type") || "all";
    const rawSide = queryParams.get("side") || "";
    // A side of a node, "tx:n1": the streams of n1 sending, the logs of their side.
    const [filterSide, setFilterSide] = useState(rawSide);
    // The tab shown: the streams, or the logs of the heartbeats.
    const view = queryParams.get("view") === "logs" ? "logs" : "data";
    const tabsId = useTabsId();
    // In the logs, the changes of the peers beating only.
    const [changesOnly, setChangesOnly] = useState(false);
    // A driver, "unicast": the streams of its heartbeats only.
    const [filterType, setFilterType] = useState(rawType);
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
            const currentType = currentParams.get("type") || "all";
            const currentSide = currentParams.get("side") || "";

            if (currentStatus === filterBeating &&
                currentNode === filterNode &&
                currentState === filterState &&
                currentId === filterId &&
                currentLink === filterLink &&
                currentType === filterType &&
                currentSide === filterSide) {
                return;
            }

            // The other parameters, the page size and the open panel's, stay as they
            // are; the page goes, the list filtered otherwise starting over from its first.
            const newQueryParams = new URLSearchParams(location.search);
            ["status", "node", "state", "id", "link", "type", "side", "offset"].forEach((key) => newQueryParams.delete(key));
            if (filterBeating !== "all") newQueryParams.set("status", filterBeating);
            if (filterNode !== "all") newQueryParams.set("node", filterNode);
            if (filterState !== "all") newQueryParams.set("state", filterState);
            if (filterId !== "all") newQueryParams.set("id", filterId);
            if (filterLink) newQueryParams.set("link", filterLink);
            if (filterType !== "all") newQueryParams.set("type", filterType);
            if (filterSide) newQueryParams.set("side", filterSide);

            const queryString = newQueryParams.toString();
            const newUrl = `${location.pathname}${queryString ? `?${queryString}` : ""}`;

            if (newUrl !== location.pathname + location.search) {
                navigate(newUrl, {replace: true});
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [filterBeating, filterNode, filterState, filterId, filterLink, filterType, filterSide, navigate, location.pathname, location.search]);

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
        setFilterType(rawType);
        setFilterSide(rawSide);
    }, [location.search, rawStatus, rawNode, rawState, rawId, rawLink, rawType, rawSide]);

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
                        changedAt: "",
                        lastBeatingAt: "",
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
                            changedAt: peerData?.changed_at || "",
                            lastBeatingAt: peerData?.last_beating_at || "",
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
            } else if (deferredSortColumn === "side") {
                diff = rowSide(a).localeCompare(rowSide(b));
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

    const [sideDir, sideNode] = filterSide.split(/:(.*)/);
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
                (filterType === "all" || row.type === filterType) &&
                (!sideNode || (row.node === sideNode && row.id.endsWith(`.${sideDir}`))) &&
                linkMatches(filterLink, row)
            );
        });
    }, [sortedRows, deferredFilterBeating, deferredFilterNode, deferredFilterState, deferredFilterId, filterLink, filterType, sideDir, sideNode]);

    // The drivers of the streams, for their filter.
    const availableTypes = useMemo(() => [...new Set(streamRows.map((row) => row.type))]
        .filter((type) => type && type !== t("common.notAvailable"))
        .sort(), [streamRows, t]);

    // The filters of the streams alone, cleared by a selection: its streams all shown.
    const clearDataFilters = useCallback(() => {
        setFilterBeating("all");
        setFilterNode("all");
        setFilterState("all");
        setFilterType("all");
    }, []);

    // A line of the mesh clicked: where the beats go, in place of a side of a node,
    // the heartbeat selected kept.
    const handleMeshSelect = useCallback((group) => {
        clearDataFilters();
        setFilterSide("");
        setFilterLink(`${group.from}>${group.to}`);
    }, [clearDataFilters]);

    // A heartbeat or a side of a node of the summary clicked: selected besides the other,
    // a side in place of a link of the mesh; clicked again, unselected.
    const handleSummarySelect = useCallback(({kind, value}) => {
        clearDataFilters();
        if (kind === "hb") {
            const id = value.replace(/^hb#/, "");
            setFilterId(filterId === id ? "all" : id);
            return;
        }
        const side = `${value.dir}:${value.node}`;
        setFilterLink("");
        setFilterSide(filterSide === side ? "" : side);
    }, [clearDataFilters, filterId, filterSide]);

    // The tab in the URL, the first one not named.
    const setView = useCallback((key) => {
        const params = new URLSearchParams(location.search);
        if (key === "logs") params.set("view", "logs");
        else params.delete("view");
        const query = params.toString();
        navigate(`${location.pathname}${query ? `?${query}` : ""}`, {replace: true});
    }, [location.pathname, location.search, navigate]);

    // The selection of the mesh and the summary, both tabs following it: the streams
    // filtered, the logs of a heartbeat, of a side of a node, of the nodes of a link.
    const [linkFrom, linkTo] = filterLink.split(">");
    const selection = useMemo(() => ({
        hb: filterId === "all" ? null : `hb#${filterId}`,
        side: sideNode && (sideDir === "tx" || sideDir === "rx") ? {node: sideNode, dir: sideDir} : null,
        link: linkFrom && linkTo ? {from: linkFrom, to: linkTo} : null,
    }), [filterId, sideDir, sideNode, linkFrom, linkTo]);
    const logQuery = useMemo(
        () => heartbeatLogs(heartbeatStatus, selection, changesOnly),
        [heartbeatStatus, selection, changesOnly],
    );
    const chips = [
        selection.hb && {key: "hb", label: selection.hb, clear: () => setFilterId("all")},
        selection.side && {
            key: "side",
            label: `${selection.side.node} ${t(`heartbeats.summary.side.${selection.side.dir}`)}`,
            clear: () => setFilterSide(""),
        },
        selection.link && {key: "link", label: `${linkFrom} → ${linkTo}`, clear: () => setFilterLink("")},
    ].filter(Boolean);

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
        // The page grows with its table, all its rows shown, the page scrolling
        // rather than the table in a box under the mesh.
        <div className="flex flex-col p-4 space-y-3">
            {/* The mesh as wide as its ring, the heartbeats in the rest, both as high:
                under each other in a narrow window. */}
            <div className="grid items-stretch gap-3 lg:grid-cols-[max-content_minmax(0,1fr)]">
                <HeartbeatMesh heartbeatStatus={heartbeatStatus} onSelect={handleMeshSelect}/>
                <HeartbeatSummary
                    heartbeatStatus={heartbeatStatus}
                    selected={selection}
                    onSelect={handleSummarySelect}
                />
            </div>

            {/* What the mesh and the summary selected, both tabs following it; a chip removed, the selection widened. */}
            {chips.length > 0 && (
                <div role="group" aria-label={t("heartbeats.selection.label")} className="flex flex-wrap items-center gap-2 text-data" data-selection="">
                    <span className="text-ink-muted">{t("heartbeats.selection.label")}</span>
                    {chips.map((chip) => (
                        <button
                            key={chip.key}
                            type="button"
                            className="inline-flex items-center gap-1 rounded-full border border-accent bg-accent-soft px-2"
                            aria-label={t("heartbeats.selection.clear", {name: chip.label})}
                            onClick={chip.clear}
                        >
                            {chip.label}
                            <CloseIcon className="h-3 w-3"/>
                        </button>
                    ))}
                </div>
            )}

            {/* The streams, the raw data of the page, and the logs of the heartbeats. */}
            <TabList
                tabs={[
                    {key: "data", label: t("heartbeats.tabs.data"), badge: <TabCount count={filteredRows.length}/>},
                    {key: "logs", label: t("heartbeats.tabs.logs")},
                ]}
                active={view}
                onChange={setView}
                label={t("heartbeats.tabs.label")}
                idPrefix={tabsId}
            />

            {view === "logs" && (
                <div {...tabPanelProps(tabsId, "logs")} className="flex h-[calc(100dvh-10rem)] flex-col gap-2">
                    <Checkbox
                        label={t("heartbeats.logs.changes")}
                        checked={changesOnly}
                        onChange={(event) => setChangesOnly(event.target.checked)}
                    />
                    <div className="min-h-0 flex-1">
                        <LogsViewer
                            key={`${logQuery.nodes.join(",")}/${logQuery.filters.join(",")}`}
                            nodenames={logQuery.nodes}
                            type="node"
                            height="100%"
                            filters={logQuery.filters}
                        />
                    </div>
                </div>
            )}

            {view === "data" && (
                <div id="heartbeats-streams" {...tabPanelProps(tabsId, "data")} className="flex flex-col space-y-3">
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
                            {filterSelect(t("heartbeats.filters.routine"), filterState, setFilterState, availableStates
                                .filter(s => s !== "all")
                                .map(state => [state, routineWord(state, t)]))}
                            {filterSelect(t("heartbeats.filters.beating"), filterBeating, setFilterBeating, [
                                ["beating", t("heartbeats.marks.beating")],
                                ["stale", t("heartbeats.marks.stale")],
                            ])}
                            {filterSelect(t("common.node"), filterNode, setFilterNode, nodes.map(node => [node, node]))}
                            {filterSelect(t("heartbeats.filters.id"), filterId, setFilterId, availableIds.map(id => [id, id]))}
                            {filterSelect(t("heartbeats.filters.driver"), filterType, setFilterType, availableTypes.map(type => [type, type]))}
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

                    <Table sticky>
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
                                <EmptyRow colSpan={COLUMNS.length}>
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
        </div>
    );
};

export default Heartbeats;
