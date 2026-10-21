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
import {MenuButton} from "../ui/components/MenuButton";
import {Button, IconButton} from "../ui/components/Button";
import {Dialog} from "../ui/components/Dialog";
import {URL_NODE} from "../config/apiPath.js";
import {getResponseErrorMessage} from "../services/api.jsx";
import {UNTIL_TIMEOUT_MS, trackRefused, trackUntil} from "../app/action-tracker";
import {refusalReason} from "./objectActions";
import {streamOf, streamReached} from "../app/heartbeat-progress";
import {useIsRoot} from "../hooks/useGrants";
import {Pager} from "../ui/components/Pager";
import {AgeTime} from "./AgeTime";
import {HeartbeatMesh} from "./HeartbeatMesh";
import {TabCount} from "../ui/components/Tabs";
import {usePaging} from "../app/paging";
import {BoltIcon, ChevronDownIcon, CloseIcon, FilterIcon, PlayIcon, RefreshIcon, StopIcon} from "../ui/icons";

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
 */
const Routine = ({row}) => {
    const {t} = useTranslation();
    const status = STREAM_STATUS[row.state] ?? "unknown";
    const ink = row.state === "running" ? "text-ink" : INK[status];
    return <span data-state={status} className={`whitespace-nowrap ${ink}`}>{routineWord(row.state, t)}</span>;
};

/**
 * A stream as the actions address it: its node and its name. A stream with several
 * peers has a row each: they are selected together.
 */
const streamKey = (row) => `${row.node}|${row.id}`;

/** The actions on the streams selected, om daemon hb start|stop|restart; stop and restart confirmed. */
const STREAM_ACTIONS = [
    {name: "start", Icon: PlayIcon},
    {name: "stop", Icon: StopIcon, confirm: true},
    {name: "restart", Icon: RefreshIcon, confirm: true},
];
const MENU_ICON = "flex h-4 w-4 items-center justify-center text-ink-muted [&>svg]:h-4! [&>svg]:w-4!";

/** Posts `action` on the stream of a row, to its node; throws the reason the daemon gives on a refusal. */
const postAction = async (row, action) => {
    const name = row.id.replace(/^hb#/, "");
    const response = await fetch(
        `${URL_NODE}/${encodeURIComponent(row.node)}/daemon/hb/name/${encodeURIComponent(name)}/action/${action}`,
        {method: "POST", headers: {Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`}},
    );
    if (!response.ok) {
        throw new Error(refusalReason({status: response.status, detail: await getResponseErrorMessage(response)}));
    }
};

const HeartbeatRow = React.memo(({row, isSingleNode, selected, onSelect}) => {
    const {t} = useTranslation();
    return (
        <Row className={selected ? "bg-accent-soft" : undefined}>
            {onSelect && (
                <Cell className="w-8">
                    <Checkbox
                        checked={selected}
                        onChange={(event) => onSelect(row, event.target.checked)}
                        aria-label={t("heartbeats.actions.selectStream", {id: row.id, node: row.node})}
                    />
                </Cell>
            )}
            <Cell className="whitespace-nowrap">{rowHeartbeat(row)}</Cell>
            <Cell>{row.type}</Cell>
            <Cell>{row.node}</Cell>
            <Cell className="whitespace-nowrap"><DirectionMark side={rowSide(row)}/></Cell>
            <Cell>{row.peer}</Cell>
            <Cell>{row.desc}</Cell>
            <Cell><Routine row={row}/></Cell>
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
        prev.selected === next.selected &&
        prev.onSelect === next.onSelect
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

    // Start, stop or restart the streams selected, root only; stop and restart confirmed first.
    const isRoot = useIsRoot();
    const [selectedStreams, setSelectedStreams] = useState([]);
    const [pendingAction, setPendingAction] = useState(null);
    // The streams of the rows, one each, by their key.
    const streamsByKey = useMemo(() => {
        const byKey = new Map();
        for (const row of streamRows) if (!byKey.has(streamKey(row))) byKey.set(streamKey(row), row);
        return byKey;
    }, [streamRows]);
    // The streams selected still listed: one gone from the status is no longer acted on.
    const selection = useMemo(
        () => selectedStreams.map((key) => streamsByKey.get(key)).filter(Boolean),
        [selectedStreams, streamsByKey],
    );
    const handleSelect = useCallback((row, checked) => {
        const key = streamKey(row);
        setSelectedStreams((keys) => (checked ? [...new Set([...keys, key])] : keys.filter((k) => k !== key)));
    }, []);

    // What comes of each stream, the actions tray says: refused, or followed until the
    // stream is seen in the state asked.
    const runAction = useCallback(async (streams, action) => {
        const label = t(`heartbeats.actions.${action}`);
        const lost = t("actionTray.noNews", {seconds: UNTIL_TIMEOUT_MS / 1000});
        const accepted = await Promise.all(streams.map(async (row) => {
            const info = {action, label, subject: t("heartbeats.actions.target", {id: row.id, node: row.node})};
            const id = `hb#${row.id}`;
            const createdBefore = streamOf(useEventStore.getState(), row.node, id)?.created_at;
            try {
                await postAction(row, action);
            } catch (err) {
                trackRefused({...info, reason: err.message});
                return false;
            }
            trackUntil(info, streamReached({node: row.node, id, action, createdBefore}), {lost});
            return true;
        }));
        // All accepted, the selection is done with; one refused, it stays, to try again.
        if (accepted.every(Boolean)) setSelectedStreams([]);
    }, [t]);
    const handleAction = useCallback((action) => {
        if (selection.length === 0) return;
        if (STREAM_ACTIONS.find((a) => a.name === action)?.confirm) setPendingAction({action, streams: selection});
        else void runAction(selection, action);
    }, [selection, runAction]);

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
                <div id="heartbeats-streams" className="flex flex-col space-y-3">
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

                    {isRoot && (
                        <div className="flex min-h-7 flex-wrap items-center justify-end gap-3">
                            {selection.length > 0 ? (
                                <>
                                    <span className="whitespace-nowrap text-ink-muted">{t("common.selected", {count: selection.length})}</span>
                                    <MenuButton
                                        prominent
                                        icon={<BoltIcon className="h-3.5 w-3.5"/>}
                                        label={t("heartbeats.actions.menu")}
                                        align="end"
                                        items={STREAM_ACTIONS.map(({name, Icon}) => ({
                                            key: name,
                                            label: t(`heartbeats.actions.${name}`),
                                            icon: <span aria-hidden="true" className={MENU_ICON}><Icon/></span>,
                                            // Started, a stream has nothing to start; stopped, nothing to stop.
                                            disabled: (name === "start" && selection.every((row) => row.state === "running"))
                                                || (name === "stop" && selection.every((row) => row.state === "stopped")),
                                            onSelect: () => handleAction(name),
                                        }))}
                                    />
                                    <IconButton label={t("heartbeats.actions.clear")} onClick={() => setSelectedStreams([])}>
                                        <CloseIcon className="h-4 w-4"/>
                                    </IconButton>
                                </>
                            ) : (
                                <span className="text-ink-muted">{t("heartbeats.actions.selectHint")}</span>
                            )}
                        </div>
                    )}

                    <Pager paging={paging}/>

                    <Table sticky>
                        <thead>
                            <HeaderRow>
                                {isRoot && (
                                    <HeaderCell className="w-8">
                                        <Checkbox
                                            checked={visibleRows.length > 0 && visibleRows.every((row) => selectedStreams.includes(streamKey(row)))}
                                            onChange={(event) => {
                                                const keys = visibleRows.map(streamKey);
                                                setSelectedStreams((current) => (event.target.checked
                                                    ? [...new Set([...current, ...keys])]
                                                    : current.filter((key) => !keys.includes(key))));
                                            }}
                                            aria-label={t("heartbeats.actions.selectAll")}
                                        />
                                    </HeaderCell>
                                )}
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
                                    selected={selectedStreams.includes(streamKey(row))}
                                    onSelect={isRoot ? handleSelect : undefined}
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
                open={pendingAction !== null}
                onClose={() => setPendingAction(null)}
                title={pendingAction
                    ? t(`heartbeats.actions.confirm.${pendingAction.action}.title`, {count: pendingAction.streams.length})
                    : ""}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setPendingAction(null)}>{t("common.cancel")}</Button>
                        <Button variant="danger" onClick={() => {
                            const {action, streams} = pendingAction;
                            setPendingAction(null);
                            void runAction(streams, action);
                        }}>
                            {pendingAction && t(`heartbeats.actions.${pendingAction.action}`)}
                        </Button>
                    </>
                }
            >
                {pendingAction && (
                    <div className="space-y-2">
                        <p>{t(`heartbeats.actions.confirm.${pendingAction.action}.text`, {count: pendingAction.streams.length})}</p>
                        <ul className="max-h-48 list-disc overflow-y-auto pl-5 font-mono text-data">
                            {pendingAction.streams.map((row) => (
                                <li key={streamKey(row)}>{t("heartbeats.actions.target", {id: row.id, node: row.node})}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </Dialog>
        </div>
    );
};

export default Heartbeats;
