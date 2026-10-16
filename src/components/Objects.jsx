import React, {useEffect, useState, useMemo, useCallback, useRef, useDeferredValue} from "react";
import {useLocation, useNavigate} from "react-router-dom";
import useEventStore from "../hooks/useEventStore.js";
import useFetchDaemonStatus from "../hooks/useFetchDaemonStatus";
import {retainEventReception} from "../eventSourceManager";
import {usePanelSearch} from "../app/panel-search";
import {ObjectDetailPanel} from "./RecordPanels";
import {extractNamespace} from "../utils/objectUtils";
import {useTranslation} from "react-i18next";
import {useObjectBulkActions} from "./useObjectBulkActions";
import CreateObjectDialog from "./CreateObjectDialog";
import EventLogger from "../components/EventLogger";
import {useObjectData} from "../hooks/useObjectData";
import {useNodeData} from "../hooks/useNodeData";
import {Table, HeaderRow, HeaderCell, Row, Cell, EmptyRow} from "../ui/components/Table";
import {NotProvisionedMark as PMark, StoppedMark, RpoBreachedMark} from "../ui/components/StateMarks";
import {StatusMark} from "../ui/components/StatusMark";
import {isQuietDown} from "../ui/components/status";
import {FrozenMark} from "../ui/components/FrozenMark";
import {MenuButton} from "../ui/components/MenuButton";
import {Button} from "../ui/components/Button";
import {Checkbox, Input} from "../ui/components/Field";
import {useMediaQuery} from "../ui/lib/media";
import {KeyCells, NotProvisionedMark, PropertyCells, SideText, StatusMarks, markState} from "./ObjectCells";
import {Pager} from "../ui/components/Pager";
import {usePaging} from "../app/paging";
import {ALL_LIST, OBJECT_LISTS, OBJECTS_TABS, listOfKind} from "../utils/objectLists";
import {ChevronDownIcon, FilterIcon, GearIcon, PlusIcon, SearchIcon} from "../ui/icons";

// The breakpoints of the MUI theme the view used: below md (900px) the filters fold
// behind a button, from lg (1200px) the node columns are shown.
const MOBILE_QUERY = "(max-width:899.95px)";
const WIDE_QUERY = "(min-width:1200px)";

/** The zero timestamp of the API reads as "not set". */
const ZERO_TIME = "0001-01-01T00:00:00Z";
const hasTimestamp = (value) => !!value && value !== ZERO_TIME;

const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);

const parseObjectName = (objectName) => {
    // A namespace configuration, as om3 writes it: "<namespace>/", "/" for the root one.
    if (objectName.endsWith("/")) {
        return {namespace: objectName === "/" ? "root" : objectName.slice(0, -1), kind: "nscfg", name: "namespace"};
    }
    const parts = objectName.split("/");
    if (parts.length === 3) {
        return {namespace: parts[0], kind: parts[1], name: parts[2]};
    } else if (parts.length === 2) {
        return {namespace: "root", kind: parts[0], name: parts[1]};
    }
    return {
        namespace: "root",
        kind: objectName === "cluster" ? "ccfg" : "svc",
        name: parts[0],
    };
};

/** The tab an object is listed in (objectLists). */
const listOf = (objectName) => listOfKind(parseObjectName(objectName).kind);
/** The kind a new object takes by default, from the tab it is created from. */
const LIST_KIND = {services: "svc", volumes: "vol", configs: "cfg", secrets: "sec", users: "usr", [ALL_LIST]: "svc"};
/**
 * The lists of objects held on all the nodes, with no status nor placement: their
 * names and their keys only (how many, how big), the status, orchestrate, topology
 * and node columns telling nothing, and no global state filter.
 */
const NAMES_ONLY_LISTS = ["configs", "secrets", "users"];

const selectObjectStatus = (state) => state.objectStatus;
const selectObjectInstanceStatus = (state) => state.objectInstanceStatus;

const NodeStatus = React.memo(({objectName, node}) => {
    const nodeData = useNodeData(objectName, node);
    // Stopped and RPO breached come straight from the instance status: one string each.
    const stoppedAt = useEventStore((s) => s.objectInstanceStatus?.[objectName]?.[node]?.stopped_at);
    const rpoBreachedAt = useEventStore((s) => s.objectInstanceStatus?.[objectName]?.[node]?.rpo_breached_at);
    const objectAvail = useEventStore((s) => s.objectStatus?.[objectName]?.avail);
    const hasData = Boolean(nodeData?.avail);
    if (!hasData) return null;
    const isNodeNotProvisioned = nodeData.provisioned === "false" || nodeData.provisioned === false;
    const isStopped = hasTimestamp(stoppedAt);
    const isLagging = hasTimestamp(rpoBreachedAt);

    return (
        <span className="inline-flex items-center gap-1.5" data-node={node}>
            <StatusMark state={markState(nodeData.avail)} label={nodeData.avail} muted={isQuietDown(nodeData.avail, objectAvail)}/>
            {isStopped && <StoppedMark stoppedAt={stoppedAt}/>}
            {/* A breached RPO takes the place of the frozen mark, as in the other views. */}
            {isLagging ? <RpoBreachedMark/> : <FrozenMark frozen={nodeData.frozen === "frozen"}/>}
            {isNodeNotProvisioned && <NotProvisionedMark/>}
            {nodeData.state && <SideText>{nodeData.state}</SideText>}
        </span>
    );
}, (prev, next) => prev.objectName === next.objectName && prev.node === next.node);

/**
 * The columns of the object properties, read from its status: how the daemon
 * orchestrates it and how its instances are laid out. Objects without instances
 * to place (cfg, sec, usr) have no orchestrate nor topology.
 */
export const PROPERTY_COLUMNS = [
    {key: "orchestrate", labelKey: "objects.columns.orchestrate", value: (status) => status?.orchestrate},
    {key: "topology", labelKey: "objects.columns.topology", value: (status) => status?.topology},
];

const stopPropagation = (e) => e.stopPropagation();

/**
 * The line opening the objects of a namespace in the list: its name across the
 * row, and a checkbox selecting all its objects the filters keep, on every page;
 * mixed when some of them only are selected. No object itself: it opens nothing.
 */
const NamespaceRow = ({namespace, colSpan, selectedCount, total, onToggle}) => {
    const {t} = useTranslation();
    const box = useRef(null);
    const all = total > 0 && selectedCount === total;
    const some = selectedCount > 0 && !all;
    useEffect(() => {
        if (box.current) box.current.indeterminate = some;
    }, [some]);
    return (
        <tr data-namespace-row={namespace} className="h-[1.875rem] border-b border-line bg-surface-sunken">
            <td className="w-8 px-2 py-1">
                <Checkbox
                    ref={box}
                    checked={all}
                    onChange={(e) => onToggle(namespace, e.target.checked)}
                    aria-label={t("objects.selectNamespace", {namespace})}
                />
            </td>
            <th scope="rowgroup" colSpan={colSpan} className="px-2 py-1 text-left font-semibold text-ink">
                {namespace}
            </th>
        </tr>
    );
};

const TableRowComponent = React.memo(({
                                          objectName,
                                          isSelected,
                                          isOpen = false,
                                          onSelectObject,
                                          onObjectClick,
                                          allNodes,
                                          isWideScreen,
                                          namesOnly = false,
                                      }) => {
    const {t} = useTranslation();
    const objectData = useObjectData(objectName);
    const isDegraded = useEventStore((s) => s.objectStatus?.[objectName]?.overall === "warn");
    const handleCheckboxChange = useCallback((e) => {
        onSelectObject(e, objectName);
    }, [onSelectObject, objectName]);
    const handleRowClick = useCallback(() => {
        onObjectClick(objectName);
    }, [onObjectClick, objectName]);

    return (
        <Row onActivate={handleRowClick} selected={isOpen} className={isSelected ? "bg-accent-soft" : undefined}>
            <Cell className="w-8">
                <Checkbox
                    checked={isSelected}
                    onChange={handleCheckboxChange}
                    onClick={stopPropagation}
                    aria-label={t("objects.selectObject", {name: objectName})}
                />
            </Cell>
            <Cell className="text-data font-medium whitespace-nowrap">{objectName}</Cell>
            {namesOnly && <KeyCells objectName={objectName}/>}
            {!namesOnly && <PropertyCells objectName={objectName}/>}
            {!namesOnly && (
                <Cell className="whitespace-nowrap">
                    <StatusMarks
                        avail={objectData.avail}
                        isDegraded={isDegraded}
                        isNotProvisioned={objectData.isNotProvisioned}
                        frozen={objectData.frozen}
                        globalExpect={objectData.globalExpect}
                    />
                </Cell>
            )}
            {/* A line before the instances: the columns past it are per node. */}
            {!namesOnly && isWideScreen &&
                allNodes.map((node, i) => (
                    <Cell key={node} className={i === 0 ? "whitespace-nowrap border-l border-line" : "whitespace-nowrap"}>
                        <NodeStatus objectName={objectName} node={node}/>
                    </Cell>
                ))}
        </Row>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.objectName === nextProps.objectName &&
        prevProps.isSelected === nextProps.isSelected &&
        prevProps.isOpen === nextProps.isOpen &&
        prevProps.isWideScreen === nextProps.isWideScreen &&
        prevProps.namesOnly === nextProps.namesOnly &&
        prevProps.allNodes.length === nextProps.allNodes.length &&
        prevProps.allNodes.every((node, i) => node === nextProps.allNodes[i])
    );
});

/**
 * A multi-valued filter of the toolbar: a popover of checkboxes, as oc3 does for its
 * column picker. The summary tells the filter and what it keeps; a click outside or
 * Escape closes the popover.
 */
const FilterPopover = ({label, options, selected, onToggle}) => {
    const {t} = useTranslation();
    const ref = useRef(null);

    useEffect(() => {
        const onPointerDown = (event) => {
            const details = ref.current;
            if (details?.open && !details.contains(event.target)) details.open = false;
        };
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, []);

    const onKeyDown = (event) => {
        const details = ref.current;
        if (event.key !== "Escape" || !details?.open) return;
        event.preventDefault();
        event.stopPropagation();
        details.open = false;
        details.querySelector("summary")?.focus();
    };

    const labelOf = (value) => options.find((option) => option.value === value)?.text ?? value;
    const summary = selected.length === 0 ? t("common.all") : selected.map(labelOf).join(", ");

    return (
        <details ref={ref} className="relative" onKeyDown={onKeyDown}>
            <summary
                className="flex h-7 cursor-pointer list-none items-center gap-1 rounded-(--radius-control) border border-line bg-surface px-2 whitespace-nowrap text-ink-muted hover:border-line-strong [&::-webkit-details-marker]:hidden">
                {label}
                <span className="max-w-40 truncate text-ink">{summary}</span>
                <ChevronDownIcon className="h-3.5 w-3.5"/>
            </summary>
            <div
                role="group"
                aria-label={label}
                className="absolute top-full left-0 z-30 mt-1 flex max-h-72 min-w-44 flex-col gap-1 overflow-auto rounded-(--radius-panel) border border-line bg-surface-raised p-2 shadow-lg"
            >
                {options.length === 0 && <span className="text-ink-muted">{t("common.none")}</span>}
                {options.map((option) => (
                    <Checkbox
                        key={option.value}
                        checked={selected.includes(option.value)}
                        onChange={() => onToggle(option.value)}
                        label={
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                {option.mark && <span aria-hidden="true" className="inline-flex">{option.mark}</span>}
                                {option.text}
                            </span>
                        }
                    />
                ))}
            </div>
        </details>
    );
};

/** The values on offer, plus those chosen (from the URL) that the data does not hold. */
const withSelected = (values, selected) => [...values, ...selected.filter((value) => !values.includes(value))];

/**
 * A filter is worth showing with a choice to make: two values or more. With one,
 * every object of the tab has it; shown anyway while it holds a value no object of
 * the tab has, for that filter not to act unseen.
 */
const hasChoice = (values, selected) => values.length > 1 || selected.some((value) => !values.includes(value));

const GLOBAL_STATE_MARKS = {
    up: <StatusMark state="up"/>,
    down: <StatusMark state="down"/>,
    warn: <StatusMark state="warn"/>,
    "n/a": <StatusMark state="na"/>,
    unprovisioned: <PMark decorative/>,
};

const Objects = () => {
    const {t} = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    // The object whose panel is open, and its tab, in the URL as the filters are.
    const panel = usePanelSearch();
    const {select: selectObject} = panel;
    const isMounted = useRef(true);
    const queryParams = new URLSearchParams(location.search);
    const globalStates = useMemo(() => ["up", "down", "warn", "n/a", "unprovisioned"], []);

    // Parse multiple values from URL
    const parseMultipleValues = (param) => {
        const value = queryParams.get(param);
        if (!value || value === "all") return [];
        return value.split(',').filter(Boolean);
    };

    const rawGlobalStates = parseMultipleValues("globalState");
    const rawNamespaces = parseMultipleValues("namespace");
    const rawKinds = parseMultipleValues("kind");
    const rawSearchQuery = queryParams.get("name") || "";
    const list = OBJECTS_TABS.includes(queryParams.get("list")) ? queryParams.get("list") : OBJECT_LISTS[0];
    const namesOnly = NAMES_ONLY_LISTS.includes(list);
    // Their objects have no status: no global state to filter on. One the URL holds,
    // from another tab, is kept for it but filters nothing here.
    const hasGlobalState = !namesOnly;
    // A tab of a kind lists that kind: the kind filter is All's only. One the URL
    // holds, from All, is kept for it but filters nothing here.
    const hasKindFilter = list === ALL_LIST;

    const {daemon} = useFetchDaemonStatus();
    const objectStatus = useEventStore(selectObjectStatus);
    const objectInstanceStatus = useEventStore(selectObjectInstanceStatus);
    const [selectedObjects, setSelectedObjects] = useState([]);
    // The actions on the selection: the Actions menu, its dialog, and the feedback strip.
    const clearSelection = useCallback(() => setSelectedObjects([]), []);
    const {items: bulkActions, feedback, dialog: actionDialog, notify} = useObjectBulkActions({selectedObjects, onDone: clearSelection});
    const [selectedNamespaces, setSelectedNamespaces] = useState(rawNamespaces);
    const [selectedKinds, setSelectedKinds] = useState(rawKinds);
    const [selectedGlobalStates, setSelectedGlobalStates] = useState(rawGlobalStates);
    const [createOpen, setCreateOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState(rawSearchQuery);
    const isWideScreen = useMediaQuery(WIDE_QUERY);
    const isMobile = useMediaQuery(MOBILE_QUERY);
    const objectEventTypes = useMemo(() => [
        "ObjectStatusUpdated",
        "InstanceStatusUpdated",
        "ObjectDeleted",
        "InstanceMonitorUpdated",
        "CONNECTION_OPENED",
        "CONNECTION_ERROR",
        "RECONNECTION_ATTEMPT",
        "MAX_RECONNECTIONS_REACHED",
        "CONNECTION_CLOSED"
    ], []);

    const [showFilters, setShowFilters] = useState(() => isWideScreen ? true : !isMobile);

    const deferredSearchQuery = useDeferredValue(searchQuery);
    const deferredSelectedGlobalStates = useDeferredValue(selectedGlobalStates);
    const deferredSelectedNamespaces = useDeferredValue(selectedNamespaces);
    const deferredSelectedKinds = useDeferredValue(selectedKinds);


    const filtersId = React.useId();

    const objects = useMemo(
        () => (Object.keys(objectStatus).length ? objectStatus : daemon?.cluster?.object || {}),
        [objectStatus, daemon]
    );

    const allObjectNames = useMemo(
        () => Object.keys(objects).filter((key) => key && typeof objects[key] === "object"),
        [objects]
    );

    // The objects of the list shown, the one the menu opened.
    const listObjectNames = useMemo(
        () => (list === ALL_LIST ? allObjectNames : allObjectNames.filter((name) => listOf(name) === list)),
        [allObjectNames, list]
    );

    const {namespaces, kinds} = useMemo(() => {
        const nsSet = new Set();
        const kindSet = new Set();

        for (let i = 0; i < listObjectNames.length; i++) {
            const name = listObjectNames[i];
            nsSet.add(extractNamespace(name));
            kindSet.add(parseObjectName(name).kind);
        }

        return {
            namespaces: Array.from(nsSet).sort(),
            kinds: Array.from(kindSet).sort()
        };
    }, [listObjectNames]);

    // A new object may go in any namespace known, whatever the tab.
    const allNamespaces = useMemo(
        () => [...new Set(allObjectNames.map(extractNamespace))].sort(),
        [allObjectNames]
    );

    const allNodes = useMemo(() => {
        const nodeSet = new Set();
        const objNames = Object.keys(objectInstanceStatus);

        for (let i = 0; i < objNames.length; i++) {
            const nodes = Object.keys(objectInstanceStatus[objNames[i]] || {});
            for (let j = 0; j < nodes.length; j++) {
                nodeSet.add(nodes[j]);
            }
        }

        return Array.from(nodeSet).sort();
    }, [objectInstanceStatus]);

    const filteredObjectNames = useMemo(() => {
        const result = [];
        const searchLower = deferredSearchQuery.toLowerCase();
        const hasSearch = searchLower.length > 0;

        for (let i = 0; i < listObjectNames.length; i++) {
            const name = listObjectNames[i];

            if (hasSearch && !name.toLowerCase().includes(searchLower)) {
                continue;
            }

            // Check namespace filter (multiple selection)
            if (deferredSelectedNamespaces.length > 0 && !deferredSelectedNamespaces.includes(extractNamespace(name))) {
                continue;
            }

            // Check kind filter (multiple selection), on All only
            if (hasKindFilter && deferredSelectedKinds.length > 0 && !deferredSelectedKinds.includes(parseObjectName(name).kind)) {
                continue;
            }

            // Check global state filter (multiple selection), on the lists that have one
            if (hasGlobalState && deferredSelectedGlobalStates.length > 0) {
                const status = objects[name];
                if (!status) continue;

                const rawAvail = status.avail;
                const validStatuses = ["up", "down", "warn"];
                const avail = validStatuses.includes(rawAvail) ? rawAvail : "n/a";
                const provisioned = status.provisioned;

                let matchesAnyGlobalState = false;
                for (let j = 0; j < deferredSelectedGlobalStates.length; j++) {
                    const selectedState = deferredSelectedGlobalStates[j];
                    if (selectedState === "unprovisioned") {
                        if (provisioned === "false" || provisioned === false) {
                            matchesAnyGlobalState = true;
                            break;
                        }
                    } else if (avail === selectedState) {
                        matchesAnyGlobalState = true;
                        break;
                    }
                }

                if (!matchesAnyGlobalState) continue;
            }

            result.push(name);
        }

        return result;
    }, [listObjectNames, hasGlobalState, deferredSelectedGlobalStates, deferredSelectedNamespaces,
        deferredSelectedKinds, hasKindFilter, deferredSearchQuery, objects]);

    // Always in the order of their paths, namespace by namespace: a line opens each
    // namespace (NamespaceRow). The root namespace's short paths ("cluster",
    // "svc/x") are kept together under it, in the order of the namespaces.
    const sortedObjectNames = useMemo(() => [...filteredObjectNames].sort((a, b) =>
        extractNamespace(a).localeCompare(extractNamespace(b)) || a.localeCompare(b)
    ), [filteredObjectNames]);

    // The objects of each namespace the filters keep: what its line selects.
    const namespaceObjects = useMemo(() => {
        const byNamespace = new Map();
        for (const name of sortedObjectNames) {
            const ns = extractNamespace(name);
            if (!byNamespace.has(ns)) byNamespace.set(ns, []);
            byNamespace.get(ns).push(name);
        }
        return byNamespace;
    }, [sortedObjectNames]);

    // The rows of the page shown, as oc3 pages its lists.
    const paging = usePaging("objects", sortedObjectNames.length);
    const {page: pageOf} = paging;
    const visibleObjectNames = useMemo(() => pageOf(sortedObjectNames), [pageOf, sortedObjectNames]);

    const handleSelectObject = useCallback((event, objectName) => {
        setSelectedObjects((prev) =>
            event.target.checked ? [...prev, objectName] : prev.filter((obj) => obj !== objectName)
        );
    }, []);

    // A row is not rendered again for a new handler (TableRowComponent): one handler,
    // reading the latest URL, or a row opened after a filter changed would bring the
    // URL of before back, the filter dropped.
    const objectClickRef = useRef({objectInstanceStatus, selectObject, openPeek: panel.openPeek});
    objectClickRef.current = {objectInstanceStatus, selectObject, openPeek: panel.openPeek};
    const handleObjectClick = useCallback((objectName) => {
        const {objectInstanceStatus: instances, selectObject: select, openPeek} = objectClickRef.current;
        // A namespace configuration is edited in the panel of its namespace.
        const {kind, namespace} = parseObjectName(objectName);
        if (kind === "nscfg") openPeek({kind: "namespace", id: namespace}, "config");
        else if (instances[objectName]) select(objectName);
    }, []);

    const handleSelectNamespace = useCallback((namespace, checked) => {
        const members = namespaceObjects.get(namespace) ?? [];
        setSelectedObjects((prev) => (checked
            ? [...new Set([...prev, ...members])]
            : prev.filter((name) => !members.includes(name))));
    }, [namespaceObjects]);

    const handleSearchChange = useCallback((e) => {
        setSearchQuery(e.target.value);
    }, []);

    const toggleShowFilters = useCallback(() => {
        setShowFilters(prev => !prev);
    }, []);

    const handleGlobalStateChange = useCallback((state) => {
        setSelectedGlobalStates(prev => {
            if (prev.includes(state)) {
                return prev.filter(s => s !== state);
            } else {
                return [...prev, state];
            }
        });
    }, []);

    const handleNamespaceChange = useCallback((namespace) => {
        setSelectedNamespaces(prev => {
            if (prev.includes(namespace)) {
                return prev.filter(ns => ns !== namespace);
            } else {
                return [...prev, namespace];
            }
        });
    }, []);

    const handleKindChange = useCallback((kind) => {
        setSelectedKinds(prev => {
            if (prev.includes(kind)) {
                return prev.filter(k => k !== kind);
            } else {
                return [...prev, kind];
            }
        });
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (!isMounted.current) return;
            const currentParams = new URLSearchParams(location.search);
            const currentGlobalStates = parseMultipleValues("globalState");
            const currentNamespaces = parseMultipleValues("namespace");
            const currentKinds = parseMultipleValues("kind");
            const currentName = currentParams.get("name") || "";

            const arraysEqual = (a, b) => {
                if (a.length !== b.length) return false;
                const sortedA = [...a].sort();
                const sortedB = [...b].sort();
                return sortedA.every((val, idx) => val === sortedB[idx]);
            };

            if (arraysEqual(currentGlobalStates, selectedGlobalStates) &&
                arraysEqual(currentNamespaces, selectedNamespaces) &&
                arraysEqual(currentKinds, selectedKinds) &&
                currentName === searchQuery) {
                return;
            }

            // The other parameters, the open panel's, stay as they are; the page goes,
            // the list filtered otherwise starting over from its first one.
            const newQueryParams = new URLSearchParams(location.search);
            ["globalState", "namespace", "kind", "name", "offset"].forEach((key) => newQueryParams.delete(key));
            if (selectedGlobalStates.length > 0) newQueryParams.set("globalState", selectedGlobalStates.join(','));
            if (selectedNamespaces.length > 0) newQueryParams.set("namespace", selectedNamespaces.join(','));
            if (selectedKinds.length > 0) newQueryParams.set("kind", selectedKinds.join(','));
            if (searchQuery.trim()) newQueryParams.set("name", searchQuery.trim());

            const queryString = newQueryParams.toString();
            const newUrl = `${location.pathname}${queryString ? `?${queryString}` : ""}`;
            if (newUrl !== location.pathname + location.search) {
                navigate(newUrl, {replace: true});
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [selectedGlobalStates, selectedNamespaces, selectedKinds, searchQuery, navigate, location.pathname, location.search]);

    useEffect(() => {
        setSelectedGlobalStates(rawGlobalStates);
        setSelectedNamespaces(rawNamespaces);
        setSelectedKinds(rawKinds);
        setSearchQuery(rawSearchQuery);
    }, [location.search]);

    const eventStarted = useRef(false);
    useEffect(() => {
        const token = localStorage.getItem("authToken");
        let release = null;
        if (token && !eventStarted.current) {
            release = retainEventReception(token, [
                "ObjectStatusUpdated",
                "InstanceStatusUpdated",
                "ObjectDeleted",
                "InstanceMonitorUpdated",
            ]);
            eventStarted.current = true;
        }
        return () => {
            release?.();
            eventStarted.current = false;
        };
    }, []);

    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    // Another list, from the menu: the selection was the other list's. Its filters
    // follow its address, read again above.
    useEffect(() => {
        setSelectedObjects([]);
    }, [list]);

    // Created, the object opens in its panel, over the tab it is listed in.
    const handleCreated = useCallback((path, provisioning) => {
        setCreateOpen(false);
        notify(
            provisioning === "requested"
                ? t("createObject.feedback.createdProvisioning", {path})
                : provisioning === "failed"
                    ? t("createObject.feedback.createdProvisionFailed", {path})
                    : t("createObject.feedback.created", {path}),
            provisioning === "failed" ? "warning" : "success",
        );
        // All lists it too: kept.
        const next = list === ALL_LIST ? ALL_LIST : listOf(path);
        const params = new URLSearchParams(location.search);
        if (next !== list) {
            setSelectedObjects([]);
            setSelectedKinds([]);
            params.delete("kind");
        }
        if (next === OBJECT_LISTS[0]) params.delete("list");
        else params.set("list", next);
        ["tab", "peek", "peektab"].forEach((key) => params.delete(key));
        params.set("sel", path);
        navigate(`${location.pathname}?${params.toString()}`);
    }, [list, location.pathname, location.search, navigate, notify, t]);

    const handleSelectAll = useCallback((e) => {
        setSelectedObjects(e.target.checked ? filteredObjectNames : []);
    }, [filteredObjectNames]);

    const globalStateOptions = useMemo(
        () => withSelected(globalStates, selectedGlobalStates).map((state) => ({
            value: state,
            // The availabilities are daemon values, shown as such; unprovisioned is a word of the view.
            text: state === "unprovisioned" ? t("objects.filters.unprovisioned") : capitalize(state),
            mark: GLOBAL_STATE_MARKS[state],
        })),
        [globalStates, selectedGlobalStates, t]
    );
    const namespaceOptions = useMemo(
        () => withSelected(namespaces, selectedNamespaces).map((namespace) => ({value: namespace, text: namespace})),
        [namespaces, selectedNamespaces]
    );
    const kindOptions = useMemo(
        () => withSelected(kinds, selectedKinds).map((kind) => ({value: kind, text: kind})),
        [kinds, selectedKinds]
    );

    const columnCount = namesOnly ? 4 : 3 + PROPERTY_COLUMNS.length + (isWideScreen ? allNodes.length : 0);

    return (
        <div className="flex h-full flex-col gap-3 p-4">
            <div className="flex shrink-0 flex-wrap items-center gap-3">
                {isMobile && (
                    <Button
                        variant="ghost"
                        size="sm"
                        icon={<FilterIcon className="h-4 w-4"/>}
                        onClick={toggleShowFilters}
                        aria-label={showFilters ? t("objects.filters.hide") : t("objects.filters.show")}
                        aria-expanded={showFilters}
                        aria-controls={filtersId}
                    >
                        <span className="hidden sm:inline">{t("common.filters")}</span>
                        <ChevronDownIcon className={showFilters ? "h-4 w-4 rotate-180" : "h-4 w-4"}/>
                    </Button>
                )}
                {(!isMobile || showFilters) && (
                    <div id={filtersId} className="flex flex-wrap items-center gap-3">
                        {hasGlobalState && (
                            <FilterPopover
                                label={t("objects.filters.globalState")}
                                options={globalStateOptions}
                                selected={selectedGlobalStates}
                                onToggle={handleGlobalStateChange}
                            />
                        )}
                        {hasChoice(namespaces, selectedNamespaces) && (
                            <FilterPopover
                                label={t("objects.filters.namespace")}
                                options={namespaceOptions}
                                selected={selectedNamespaces}
                                onToggle={handleNamespaceChange}
                            />
                        )}
                        {hasKindFilter && hasChoice(kinds, selectedKinds) && (
                            <FilterPopover
                                label={t("objects.filters.kind")}
                                options={kindOptions}
                                selected={selectedKinds}
                                onToggle={handleKindChange}
                            />
                        )}
                        <label className="flex items-center gap-1 text-ink-muted">
                            {t("common.name")}
                            <span className="relative flex items-center">
                                <SearchIcon className="pointer-events-none absolute left-2 h-3.5 w-3.5"/>
                                <Input
                                    type="search"
                                    className="h-7 w-48 pl-7"
                                    value={searchQuery}
                                    onChange={handleSearchChange}
                                />
                            </span>
                        </label>
                    </div>
                )}
                <div className="ml-auto flex items-center gap-3">
                    <Button size="sm" icon={<PlusIcon className="h-4 w-4"/>} onClick={() => setCreateOpen(true)}>
                        {t("createObject.open")}
                    </Button>
                    {/* Nothing selected, nothing to act on: how to select, in the place of the actions. */}
                    {selectedObjects.length > 0 ? (
                        <>
                            <span className="whitespace-nowrap text-ink-muted">{t("common.selected", {count: selectedObjects.length})}</span>
                            <MenuButton
                                // The actions, as in oc3: a pill tinted with the accent, the gear of the actions.
                                prominent
                                icon={<GearIcon className="h-3.5 w-3.5"/>}
                                label={t("objects.actionsMenu")}
                                align="end"
                                items={bulkActions}
                            />
                        </>
                    ) : (
                        <span className="whitespace-nowrap text-ink-muted">{t("objects.selectHint")}</span>
                    )}
                </div>
            </div>

            {feedback}

            <Pager paging={paging}/>

            <Table
                sticky
                aria-label={t("objects.tableLabel")}
                className="min-h-0 flex-1"
            >
                <thead>
                    <HeaderRow>
                        <HeaderCell className="w-8">
                            <Checkbox
                                checked={selectedObjects.length === filteredObjectNames.length && filteredObjectNames.length > 0}
                                onChange={handleSelectAll}
                                aria-label={t("objects.selectAll")}
                            />
                        </HeaderCell>
                        {/* Fixed titles: the list is always in the order of the paths. */}
                        <HeaderCell>{t("objects.columns.object")}</HeaderCell>
                        {namesOnly && (
                            <>
                                <HeaderCell className="text-right">{t("objects.columns.keys")}</HeaderCell>
                                <HeaderCell className="text-right" title={t("objects.columns.keysSizeHint")}>{t("objects.columns.keysSize")}</HeaderCell>
                            </>
                        )}
                        {!namesOnly && PROPERTY_COLUMNS.map(({key, labelKey}) => (
                            <HeaderCell key={key}>{t(labelKey)}</HeaderCell>
                        ))}
                        {!namesOnly && <HeaderCell>{t("common.status")}</HeaderCell>}
                        {!namesOnly && isWideScreen && allNodes.map((node, i) => (
                            <HeaderCell key={node} className={i === 0 ? "border-l border-line" : undefined}>{node}</HeaderCell>
                        ))}
                    </HeaderRow>
                </thead>
                <tbody>
                    {visibleObjectNames.map((objectName, i) => {
                        const ns = extractNamespace(objectName);
                        // A line opens each namespace, and the page, which may start inside one.
                        const opens = i === 0 || extractNamespace(visibleObjectNames[i - 1]) !== ns;
                        const members = namespaceObjects.get(ns) ?? [];
                        return (
                            <React.Fragment key={objectName}>
                                {opens && (
                                    <NamespaceRow
                                        namespace={ns}
                                        colSpan={columnCount - 1}
                                        total={members.length}
                                        selectedCount={members.filter((name) => selectedObjects.includes(name)).length}
                                        onToggle={handleSelectNamespace}
                                    />
                                )}
                                <TableRowComponent
                                    objectName={objectName}
                                    isSelected={selectedObjects.includes(objectName)}
                                    isOpen={panel.sel === objectName}
                                    onSelectObject={handleSelectObject}
                                    onObjectClick={handleObjectClick}
                                    allNodes={allNodes}
                                    isWideScreen={isWideScreen}
                                    namesOnly={namesOnly}
                                />
                            </React.Fragment>
                        );
                    })}
                    {visibleObjectNames.length === 0 && (
                        <EmptyRow colSpan={columnCount}>
                            {t("objects.empty")}
                        </EmptyRow>
                    )}
                </tbody>
            </Table>

            {actionDialog}
            <CreateObjectDialog
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                defaultKind={LIST_KIND[list]}
                defaultNamespace={selectedNamespaces.length === 1 ? selectedNamespaces[0] : "root"}
                namespaces={allNamespaces}
                paths={allObjectNames}
                onCreated={handleCreated}
            />
            <EventLogger eventTypes={objectEventTypes} title={t("objects.events.title")}
                         buttonLabel={t("objects.events.button")}/>

            <ObjectDetailPanel
                path={panel.sel}
                tab={panel.tab}
                onTabChange={panel.setTab}
                onClose={() => selectObject(undefined)}
            />
        </div>
    );
};

export default Objects;
