import React from "react";
import {Chip, Box} from "@mui/material";
import {StatCard} from "./StatCard.jsx";

export const GridNodes = ({nodeCount, frozenCount, unfrozenCount, onClick}) => (
    <StatCard
        title="Nodes"
        value={nodeCount}
        subtitle={`Frozen: ${frozenCount} | Unfrozen: ${unfrozenCount}`}
        onClick={onClick}
    />
);

export const GridObjects = ({objectCount, statusCount, onClick}) => (
    <StatCard
        title="Objects"
        value={objectCount}
        subtitle={
            <Box sx={{display: "flex", justifyContent: "center", gap: 1, flexWrap: "wrap"}}>
                <StatusChip status="up" count={statusCount.up} onClick={() => onClick('up')}/>
                <StatusChip status="warn" count={statusCount.warn} onClick={() => onClick('warn')}/>
                <StatusChip status="down" count={statusCount.down} onClick={() => onClick('down')}/>
            </Box>
        }
        onClick={() => onClick()}
    />
);

const StatusChip = ({status, count, onClick}) => {
    const colors = {
        up: 'green',
        warn: 'orange',
        down: 'red'
    };

    return (
        <Chip
            label={`${status.charAt(0).toUpperCase() + status.slice(1)} ${count}`}
            size="small"
            sx={{
                backgroundColor: colors[status],
                color: 'white',
                cursor: 'pointer',
            }}
            onClick={onClick}
        />
    );
};

export const GridNamespaces = ({namespaceCount, namespaceSubtitle, onClick}) => {
    const getNamespaceColor = (status) => {
        if (status.down > 0) return 'red';
        if (status.warn > 0) return 'orange';
        if (status.up > 0) return 'green';
        return 'grey';
    };

    const sortedNamespaceSubtitle = [...namespaceSubtitle].sort((a, b) =>
        a.namespace.localeCompare(b.namespace)
    );

    return (
        <StatCard
            title="Namespaces"
            value={namespaceCount}
            subtitle={
                <Box sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1,
                    pt: 1,
                    maxHeight: '400px',
                    overflowY: 'auto',
                    justifyContent: 'flex-start'
                }}>
                    {sortedNamespaceSubtitle.map(({namespace, count, status}) => (
                        <Box key={namespace} sx={{
                            position: 'relative',
                            display: 'inline-flex',
                            flexShrink: 0,
                            margin: "2px"
                        }}>
                            <Chip
                                label={namespace}
                                size="small"
                                sx={{
                                    backgroundColor: getNamespaceColor(status),
                                    color: 'white',
                                    cursor: 'pointer',
                                    pr: count > 0 ? 3.5 : 1,
                                    minWidth: "fit-content"
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClick(`/namespaces?namespace=${namespace}`);
                                }}
                            />
                            {count > 0 && (
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        top: -8,
                                        right: -8,
                                        width: 20,
                                        height: 20,
                                        borderRadius: '50%',
                                        backgroundColor: 'red',
                                        color: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 10,
                                        fontWeight: 'bold',
                                        border: '1px solid white',
                                        zIndex: 1
                                    }}
                                >
                                    {count}
                                </Box>
                            )}
                        </Box>
                    ))}
                </Box>
            }
            onClick={() => onClick('/namespaces')}
            dynamicHeight
        />
    );
};

export const GridHeartbeats = ({heartbeatCount, beatingCount, nonBeatingCount, stateCount, nodeCount, onClick}) => {
    const stateColors = {
        running: 'green',
        stopped: 'orange',
        failed: 'red',
        warning: 'orange',
        unknown: 'grey'
    };

    const isSingleNode = nodeCount === 1;

    return (
        <StatCard
            title="Heartbeats"
            value={heartbeatCount}
            subtitle={
                <Box sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    gap: 1,
                    minHeight: "40px"
                }}>
                    {isSingleNode ? (
                        <Chip
                            label={`Beating ${heartbeatCount}`}
                            size="small"
                            sx={{
                                backgroundColor: 'green',
                                color: 'white',
                                cursor: 'pointer',
                            }}
                            onClick={() => onClick('beating', null)}
                            title="Healthy (Single Node)"
                        />
                    ) : (
                        <>
                            {beatingCount > 0 && (
                                <Chip
                                    label={`Beating ${beatingCount}`}
                                    size="small"
                                    sx={{
                                        backgroundColor: 'green',
                                        color: 'white',
                                        cursor: 'pointer',
                                    }}
                                    onClick={() => onClick('beating', null)}
                                />
                            )}
                            {nonBeatingCount > 0 && (
                                <Chip
                                    label={`Stale ${nonBeatingCount}`}
                                    size="small"
                                    sx={{
                                        backgroundColor: 'red',
                                        color: 'white',
                                        cursor: 'pointer',
                                    }}
                                    onClick={() => onClick('stale', null)}
                                />
                            )}
                        </>
                    )}
                    {Object.entries(stateCount).map(([state, count]) => (
                        count > 0 && (
                            <Chip
                                key={state}
                                label={`${state.charAt(0).toUpperCase() + state.slice(1)} ${count}`}
                                size="small"
                                sx={{
                                    backgroundColor: stateColors[state] || 'grey',
                                    color: 'white',
                                    cursor: 'pointer',
                                }}
                                onClick={() => onClick(null, state)}
                            />
                        )
                    ))}
                </Box>
            }
            onClick={() => onClick()}
        />
    );
};

export const GridPools = ({poolCount, onClick}) => (
    <StatCard
        title="Pools"
        value={poolCount}
        onClick={onClick}
    />
);
