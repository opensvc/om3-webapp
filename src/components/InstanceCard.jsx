import React from "react";
import {Checkbox} from "../ui/components/Field";
import {StoppedMark, RpoBreachedMark} from "../ui/components/StateMarks";
import {IconButton} from "../ui/components/Button";
import {MenuButton} from "../ui/components/MenuButton";
import {StatusMark} from "../ui/components/StatusMark";
import {toObjectState} from "../ui/components/status";
import {FrozenMark} from "../ui/components/FrozenMark";
import {AlertTriangleIcon, FileIcon, MoreIcon} from "../ui/icons";
import logger from '../utils/logger.js';

/** Icon of an action in a menu: the action icons are sized to the menu line. */
const ICON = "flex h-4 w-4 items-center justify-center text-ink-muted [&>svg]:h-4! [&>svg]:w-4!";
const DANGER_ICON = "flex h-4 w-4 items-center justify-center text-state-down [&>svg]:h-4! [&>svg]:w-4!";

const capitalize = (name) => name.charAt(0).toUpperCase() + name.slice(1);

/**
 * One instance of the object, on one 30px line: selection, state, node name,
 * stopped, RPO-breached (else frozen) and provisioning marks, monitor state, then its actions menu and its logs.
 * A click on the line (outside its controls) opens the instance view.
 */
const InstanceCard = ({
                          node,
                          nodeData = {},
                          selectedNodes = [],
                          toggleNode = () => logger.warn("toggleNode not provided"),
                          actionInProgress = false,
                          actions = [],
                          onAction = () => logger.warn("onAction not provided"),
                          getNodeState = () => ({
                              avail: "unknown",
                              frozen: "unfrozen",
                              state: null,
                              isStopped: false,
                              isLagging: false,
                          }),
                          instanceName,
                          onOpenLogs = () => logger.warn("onOpenLogs not provided"),
                          onViewInstance,
                      }) => {
    const resolvedInstanceName = instanceName || nodeData?.instanceName || nodeData?.name || node;

    if (!node) {
        logger.error("Node name is required");
        return null;
    }

    const {avail, frozen, state, isStopped, isLagging} = getNodeState(node);
    const isInstanceNotProvisioned = nodeData?.provisioned === false || nodeData?.provisioned === "false";
    const canView = typeof onViewInstance === 'function';
    const isSelected = selectedNodes.includes(node);

    const stoppedAt = nodeData?.stopped_at;

    const handleCardClick = (e) => {
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.no-click')) {
            return;
        }
        if (canView) onViewInstance(node);
    };

    return (
        <div
            role="group"
            aria-label={`Instance on node ${node}`}
            className={`group flex h-[1.875rem] items-center gap-2 px-3 text-data hover:bg-surface-sunken ${
                canView ? "cursor-pointer" : ""
            } ${isSelected ? "bg-accent-soft" : ""}`}
            onClick={handleCardClick}
        >
            <span className="no-click inline-flex" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                    checked={isSelected}
                    onChange={() => toggleNode(node)}
                    aria-label={`Select node ${node}`}
                />
            </span>
            <StatusMark state={toObjectState(avail)} label={avail || "unknown"}/>
            {canView ? (
                <button
                    type="button"
                    onClick={() => onViewInstance(node)}
                    title="View resources"
                    className="truncate font-medium text-ink hover:underline"
                >
                    {node}
                </button>
            ) : (
                <span className="truncate font-medium">{node}</span>
            )}
            {canView && (
                <span aria-hidden="true" className="hidden whitespace-nowrap text-accent italic group-hover:inline">
                    (view resources)
                </span>
            )}
            {isStopped && <StoppedMark stoppedAt={stoppedAt} label={`Instance on node ${node} is stopped`}/>}
            {/* A breached RPO says more than the freeze: it takes its place. */}
            {isLagging ? (
                <RpoBreachedMark label={`Instance on node ${node} is lagging`}/>
            ) : (
                <FrozenMark frozen={frozen === "frozen"}/>
            )}
            {isInstanceNotProvisioned && (
                <span
                    role="img"
                    title="Not Provisioned"
                    aria-label={`Instance on node ${node} is not provisioned`}
                    className="text-state-down"
                >
                    <AlertTriangleIcon className="h-3.5 w-3.5"/>
                </span>
            )}
            {state && <span className="truncate text-ink-muted">{state}</span>}

            <span className="no-click ml-auto flex items-center gap-1">
                <MenuButton
                    label={`Node ${node} actions`}
                    icon={<MoreIcon className="h-4 w-4"/>}
                    compact
                    align="end"
                    disabled={actionInProgress}
                    className="inline-flex"
                    items={actions.map(({name, icon, color}) => ({
                        key: name,
                        label: capitalize(name),
                        icon: (
                            <span aria-hidden="true" className={color === "red" ? DANGER_ICON : ICON}>
                                {icon}
                            </span>
                        ),
                        disabled: actionInProgress,
                        onSelect: () => onAction(node, name),
                    }))}
                />
                <IconButton
                    size="sm"
                    label={`View logs for instance ${resolvedInstanceName || node} on node ${node}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onOpenLogs(node, resolvedInstanceName);
                    }}
                >
                    <FileIcon className="h-4 w-4"/>
                </IconButton>
            </span>
        </div>
    );
};

export default InstanceCard;
