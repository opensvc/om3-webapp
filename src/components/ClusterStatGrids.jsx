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

export const GridObjects = ({objectCount, statusCount, onClick}) => {
    console.log("GridObjects rendering with statusCount:", statusCount);
    return (
        <StatCard
            title="Objects"
            value={objectCount}
            subtitle={
                <Box sx={{display: "flex", justifyContent: "center", gap: 1, flexWrap: "wrap"}}>
                    {['up', 'warn', 'down', 'unprovisioned'].map((status) => (
                        (statusCount[status] || 0) > 0 && (
                            <StatusChip
                                key={status}
                                status={status}
                                count={statusCount[status] || 0}
                                onClick={() => onClick(status)}
                            />
                        )
                    ))}
                </Box>
            }
            onClick={() => onClick()}
        />
    );
};

const StatusChip = ({status, count, onClick}) => {
    const colors = {
        up: 'green',
        warn: 'orange',
        down: 'red',
        unprovisioned: 'red'
    };

    return (
        <Chip
            label={`${status.charAt(0).toUpperCase() + status.slice(1)} ${count}`}
            size="small"
            sx={{
                backgroundColor: colors[status] || 'grey',
                color: 'white',
                cursor: 'pointer',
            }}
            onClick={onClick}
        />
    );
};

export const GridNamespaces = ({namespaceCount, namespaceSubtitle, onClick}) => {
    const getStatusColor = (status) => {
        const colors = {
            up: 'green',
            warn: 'orange',
            down: 'red',
            'n/a': 'grey',
            unprovisioned: 'red'
        };
        return colors[status] || 'grey';
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
                    {sortedNamespaceSubtitle.map(({namespace, status}) => (
                        <Box key={namespace} sx={{
                            position: 'relative',
                            display: 'inline-flex',
                            flexShrink: 0,
                            margin: "4px"
                        }}>
                            <Chip
                                label={namespace}
                                size="small"
                                sx={{
                                    backgroundColor: 'default',
                                    cursor: 'pointer',
                                    minWidth: "fit-content",
                                    px: 1.5
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClick(`/objects?namespace=${namespace}`);
                                }}
                            />
                            <Box sx={{
                                position: 'absolute',
                                top: -10,
                                right: -12,
                                display: 'flex',
                                gap: 0.5,
                                flexWrap: 'wrap'
                            }}>
                                {['up', 'warn', 'down', 'n/a', 'unprovisioned'].map((stat) => (
                                    (status[stat] || 0) > 0 && (
                                        <Box
                                            key={stat}
                                            sx={{
                                                width: 16,
                                                height: 16,
                                                borderRadius: '50%',
                                                backgroundColor: getStatusColor(stat),
                                                color: 'white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 8,
                                                fontWeight: 'bold',
                                                border: '1px solid white',
                                                cursor: 'pointer',
                                                zIndex: 1
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onClick(`/objects?namespace=${namespace}&globalState=${stat}`);
                                            }}
                                        >
                                            {status[stat]}
                                        </Box>
                                    )
                                ))}
                            </Box>
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

export const GridNetworks = ({networks, onClick}) => (
    <StatCard
        title="Networks"
        value={networks.length}
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
                {networks.map((network) => {
                    const usagePercentage = network.size
                        ? ((network.used / network.size) * 100).toFixed(1)
                        : 0;
                    const isLowStorage = network.size ? ((network.free / network.size) * 100) < 10 : false;
                    return (
                        <Box key={network.name} sx={{
                            position: 'relative',
                            display: 'inline-flex',
                            flexShrink: 0,
                            margin: "4px"
                        }}>
                            <Chip
                                label={`${network.name} (${usagePercentage}% used)`}
                                size="small"
                                sx={{
                                    backgroundColor: isLowStorage ? 'red' : 'default',
                                    color: isLowStorage ? 'white' : 'inherit',
                                    cursor: 'pointer',
                                    minWidth: "fit-content",
                                    px: 1.5
                                }}
                            />
                        </Box>
                    );
                })}
            </Box>
        }
        onClick={() => onClick()}
        dynamicHeight
    />
);
