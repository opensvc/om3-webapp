import React from "react";
import {Row, Cell} from "../ui/components/Table";
import {Checkbox} from "../ui/components/Field";
import {IconButton} from "../ui/components/Button";
import {MenuButton} from "../ui/components/MenuButton";
import {StatusMark} from "../ui/components/StatusMark";
import {FrozenMark} from "../ui/components/FrozenMark";
import {UsageBar} from "../ui/components/UsageBar";
import {FileIcon, RssIcon, MoreIcon} from "../ui/icons";
import {NODE_ACTIONS} from "../constants/actions";

const ZERO_DATE = "0001-01-01T00:00:00Z";

const formatDate = (dateString) => {
    if (!dateString || dateString === ZERO_DATE) {
        return "-";
    }

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
};

const capitalize = (name) =>
    name
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

/**
 * The node monitor state as a mark: idle is the normal state, a failure is down,
 * anything else is a transition. Without a monitor the state is unknown.
 */
const monitorMark = (monitor) => {
    const state = monitor?.state;
    if (!state) return {state: "unknown", label: "unknown"};
    if (state === "idle") return {state: "up", label: "idle"};
    if (state.includes("fail")) return {state: "down", label: state};
    return {state: "warn", label: state};
};

/** Class names of the per-row menu: its trigger made a square ⋮ button, its menu aligned on the right. */
const ICON = "flex h-4 w-4 items-center justify-center text-ink-muted [&>svg]:h-4! [&>svg]:w-4!";
const DANGER_ICON = "flex h-4 w-4 items-center justify-center text-state-down [&>svg]:h-4! [&>svg]:w-4!";

const NodeRow = ({
                     nodename,
                     stats,
                     status,
                     monitor,
                     isSelected,
                     daemonNodename,
                     onSelect,
                     onAction,
                     onOpenLogs,
                 }) => {
    const isFrozen = !!status?.frozen_at && status.frozen_at !== ZERO_DATE;
    const isDaemonNode = daemonNodename === nodename;
    const filteredMenuItems = NODE_ACTIONS.filter(({name}) => {
        if (name === "freeze" && isFrozen) return false;
        return !(name === "unfreeze" && !isFrozen);
    });
    const mark = monitorMark(monitor);

    const loadState = stats?.load_15m > 4 ? "down" : stats?.load_15m > 2 ? "warn" : "up";
    const memState = stats?.mem_avail < 20 ? "down" : stats?.mem_avail < 50 ? "warn" : "up";
    const bootedValid = status?.booted_at && status.booted_at !== ZERO_DATE;
    const updatedValid = monitor?.updated_at && monitor.updated_at !== ZERO_DATE;

    return (
        <Row aria-label={`Node ${nodename} row`} className={isSelected ? "bg-accent-soft" : undefined}>
            <Cell align="center" className="w-8">
                <Checkbox
                    checked={isSelected}
                    onChange={(e) => onSelect(e, nodename)}
                    aria-label={`Select node ${nodename}`}
                    onClick={(e) => e.stopPropagation()}
                />
            </Cell>
            <Cell className="font-medium whitespace-nowrap">{nodename || "-"}</Cell>
            <Cell className="whitespace-nowrap">
                <span className="flex items-center gap-1.5">
                    <StatusMark state={mark.state} label={mark.label}/>
                    {monitor && monitor.state !== "idle" && <span>{monitor.state}</span>}
                    {isDaemonNode && (
                        <span
                            role="img"
                            title="Connected to this node"
                            aria-label="Connected to this node"
                            className="text-state-up"
                        >
                            <RssIcon className="h-3.5 w-3.5"/>
                        </span>
                    )}
                    <FrozenMark frozen={isFrozen}/>
                </span>
            </Cell>
            <Cell numeric>{stats?.score || "N/A"}</Cell>
            <Cell numeric className="whitespace-nowrap">
                {stats?.load_15m ? (
                    <span className="inline-flex items-center gap-2">
                        <span>{stats.load_15m}</span>
                        <UsageBar showValue={false} value={Math.min(stats.load_15m * 20, 100)} state={loadState} label="Load (15m)"/>
                    </span>
                ) : (
                    "N/A"
                )}
            </Cell>
            <Cell numeric className="whitespace-nowrap">
                {stats?.mem_avail ? (
                    <span className="inline-flex items-center gap-2">
                        <span>{stats.mem_avail}%</span>
                        <UsageBar showValue={false} value={stats.mem_avail} state={memState} label="Mem Avail"/>
                    </span>
                ) : (
                    "N/A"
                )}
            </Cell>
            <Cell numeric>{stats?.swap_avail || "N/A"}%</Cell>
            <Cell className="whitespace-nowrap">{status?.agent || "N/A"}</Cell>
            <Cell className="whitespace-nowrap">
                {bootedValid ? (
                    <span title={new Date(status.booted_at).toLocaleString()}>{formatDate(status.booted_at)}</span>
                ) : (
                    "-"
                )}
            </Cell>
            <Cell className="whitespace-nowrap">
                <span title={updatedValid ? new Date(monitor.updated_at).toLocaleString() : "-"}>
                    {formatDate(monitor?.updated_at)}
                </span>
            </Cell>
            <Cell align="center">
                <MenuButton
                    label={`More actions for node ${nodename}`}
                    icon={<MoreIcon className="h-4 w-4"/>}
                    compact
                    align="end"
                    className="inline-flex align-middle"
                    items={filteredMenuItems.map(({name, icon, color}) => ({
                        key: name,
                        label: capitalize(name),
                        icon: <span aria-hidden="true" className={color === "red" ? DANGER_ICON : ICON}>{icon}</span>,
                        onSelect: () => onAction(nodename, name),
                    }))}
                />
            </Cell>
            <Cell align="center">
                <IconButton size="sm" className="align-middle" label={`View logs for node ${nodename}`} onClick={() => onOpenLogs(nodename)}>
                    <FileIcon className="h-4 w-4"/>
                </IconButton>
            </Cell>
        </Row>
    );
};

export default React.memo(NodeRow);
