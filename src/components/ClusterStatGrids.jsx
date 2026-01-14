import React, {memo, useMemo} from "react";
import {Chip, Box, Tooltip} from "@mui/material";
import {StatCard} from "./StatCard.jsx";
import {prepareForNavigation} from "../eventSourceManager";

export const GridNodes = memo(({nodeCount, frozenCount, unfrozenCount, onClick}) => (
    <StatCard
        title="Nodes"
        value={nodeCount}
        subtitle={`Frozen: ${frozenCount} | Unfrozen: ${unfrozenCount}`}
        onClick={onClick}
    />
));

export const GridObjects = memo(({objectCount, statusCount, onClick}) => {
    const handleChipClick = useMemo(() => {
        return (status) => {
            prepareForNavigation();
            setTimeout(() => onClick(status), 50);
        };
    }, [onClick]);

    const subtitle = useMemo(() => {
        const chips = [];
        const statuses = ['up', 'warn', 'down', 'unprovisioned'];

        for (const status of statuses) {
            const count = statusCount[status] || 0;
            if (count > 0) {
                chips.push(
                    <StatusChip
                        key={status}
                        status={status}
                        count={count}
                        onClick={() => handleChipClick(status)}
                    />
                );
            }
        }

        return (
            <Box sx={{display: "flex", justifyContent: "center", gap: 1, flexWrap: "wrap"}}>
                {chips}
            </Box>
        );
    }, [statusCount, handleChipClick]);

    const handleCardClick = useMemo(() => {
        return () => {
            prepareForNavigation();
            setTimeout(() => onClick(), 50);
        };
    }, [onClick]);

    return (
        <StatCard
            title="Objects"
            value={objectCount}
            subtitle={subtitle}
            onClick={handleCardClick}
        />
    );
});

const StatusChip = memo(({status, count, onClick}) => {
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
});

export const GridNamespaces = memo(({namespaceCount, namespaceSubtitle, onClick}) => {
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

    const subtitle = useMemo(() => {
        return (
            <Box sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 1,
                pt: 1,
                maxHeight: '400px',
                overflowY: 'auto',
                justifyContent: 'flex-start'
            }}>
                {namespaceSubtitle.map(({namespace, status}) => (
                    <NamespaceChip
                        key={namespace}
                        namespace={namespace}
                        status={status}
                        onClick={onClick}
                    />
                ))}
            </Box>
        );
    }, [namespaceSubtitle, onClick]);

    const handleCardClick = useMemo(() => {
        return () => {
            prepareForNavigation();
            setTimeout(() => onClick('/namespaces'), 50);
        };
    }, [onClick]);

    return (
        <StatCard
            title="Namespaces"
            value={namespaceCount}
            subtitle={subtitle}
            onClick={handleCardClick}
            dynamicHeight
        />
    );
});

const NamespaceChip = memo(({namespace, status, onClick}) => {
    const getStatusColor = (stat) => {
        const colors = {
            up: 'green',
            warn: 'orange',
            down: 'red',
            'n/a': 'grey',
            unprovisioned: 'red'
        };
        return colors[stat] || 'grey';
    };

    const statusElements = useMemo(() => {
        const elements = [];
        const statusTypes = ['up', 'warn', 'down', 'n/a', 'unprovisioned'];

        for (const stat of statusTypes) {
            const count = status[stat] || 0;
            if (count > 0) {
                elements.push(
                    <Tooltip key={stat}
                             title={stat === "unprovisioned" ? "Not Provisioned" : stat.charAt(0).toUpperCase() + stat.slice(1)}>
                        <Box
                            sx={{
                                width: 15.5,
                                height: 15.5,
                                borderRadius: stat === "unprovisioned" ? '3px' : '50%',
                                clipPath: stat === "unprovisioned" ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : undefined,
                                backgroundColor: getStatusColor(stat),
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 7.8,
                                fontWeight: 'bold',
                                border: '1px solid white',
                                cursor: 'pointer',
                                zIndex: 1
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                prepareForNavigation();
                                setTimeout(() => {
                                    onClick(`/objects?namespace=${namespace}&globalState=${stat}`);
                                }, 50);
                            }}
                            aria-label={`${stat} status for namespace ${namespace}: ${count} objects`}
                        >
                            {count}
                        </Box>
                    </Tooltip>
                );
            }
        }
        return elements;
    }, [namespace, status, onClick]);

    const handleChipClick = useMemo(() => {
        return (e) => {
            e.stopPropagation();
            prepareForNavigation();
            setTimeout(() => onClick(`/objects?namespace=${namespace}`), 50);
        };
    }, [namespace, onClick]);

    return (
        <Box key={namespace}
             sx={{
                 position: 'relative',
                 display: 'inline-flex',
                 flexShrink: 0,
                 margin: "4px",
                 alignItems: "center"
             }}
        >
            <Chip
                label={namespace}
                size="small"
                sx={{
                    backgroundColor: 'default',
                    cursor: 'pointer',
                    minWidth: "100px",
                    px: 2,
                    height: 24,
                    pr: 4
                }}
                onClick={handleChipClick}
            />
            <Box sx={{
                position: 'absolute',
                top: -8,
                right: -4,
                display: 'flex',
                gap: 0.5,
                flexWrap: 'wrap'
            }}>
                {statusElements}
            </Box>
        </Box>
    );
});

export const GridHeartbeats = memo(({
                                        heartbeatCount,
                                        beatingCount,
                                        nonBeatingCount,
                                        stateCount,
                                        nodeCount,
                                        onClick
                                    }) => {
    const stateColors = {
        running: 'green',
        stopped: 'orange',
        failed: 'red',
        warning: 'orange',
        unknown: 'grey'
    };

    const isSingleNode = nodeCount === 1;

    const subtitle = useMemo(() => {
        const chips = [];

        if (isSingleNode) {
            chips.push(
                <Chip
                    key="beating"
                    label={`Beating ${heartbeatCount}`}
                    size="small"
                    sx={{
                        backgroundColor: 'green',
                        color: 'white',
                        cursor: 'pointer',
                    }}
                    onClick={() => {
                        prepareForNavigation();
                        setTimeout(() => onClick('beating', null), 50);
                    }}
                    title="Healthy (Single Node)"
                />
            );
        } else {
            if (beatingCount > 0) {
                chips.push(
                    <Chip
                        key="beating"
                        label={`Beating ${beatingCount}`}
                        size="small"
                        sx={{
                            backgroundColor: 'green',
                            color: 'white',
                            cursor: 'pointer',
                        }}
                        onClick={() => {
                            prepareForNavigation();
                            setTimeout(() => onClick('beating', null), 50);
                        }}
                    />
                );
            }

            if (nonBeatingCount > 0) {
                chips.push(
                    <Chip
                        key="stale"
                        label={`Stale ${nonBeatingCount}`}
                        size="small"
                        sx={{
                            backgroundColor: 'red',
                            color: 'white',
                            cursor: 'pointer',
                        }}
                        onClick={() => {
                            prepareForNavigation();
                            setTimeout(() => onClick('stale', null), 50);
                        }}
                    />
                );
            }
        }

        for (const [state, count] of Object.entries(stateCount)) {
            if (count > 0) {
                chips.push(
                    <Chip
                        key={state}
                        label={`${state.charAt(0).toUpperCase() + state.slice(1)} ${count}`}
                        size="small"
                        sx={{
                            backgroundColor: stateColors[state] || 'grey',
                            color: 'white',
                            cursor: 'pointer',
                        }}
                        onClick={() => {
                            prepareForNavigation();
                            setTimeout(() => onClick(null, state), 50);
                        }}
                    />
                );
            }
        }

        return (
            <Box sx={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 1,
                minHeight: "40px"
            }}>
                {chips}
            </Box>
        );
    }, [isSingleNode, heartbeatCount, beatingCount, nonBeatingCount, stateCount, onClick]);

    const handleCardClick = useMemo(() => {
        return () => {
            prepareForNavigation();
            setTimeout(() => onClick(), 50);
        };
    }, [onClick]);

    return (
        <StatCard
            title="Heartbeats"
            value={heartbeatCount}
            subtitle={subtitle}
            onClick={handleCardClick}
        />
    );
});

export const GridPools = memo(({poolCount, onClick}) => {
    const handleClick = useMemo(() => {
        return () => {
            prepareForNavigation();
            setTimeout(() => onClick(), 50);
        };
    }, [onClick]);

    return (
        <StatCard
            title="Pools"
            value={poolCount}
            onClick={handleClick}
        />
    );
});

export const GridNetworks = memo(({networks, onClick}) => {
    const subtitle = useMemo(() => {
        return (
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
        );
    }, [networks]);

    const handleCardClick = useMemo(() => {
        return () => {
            prepareForNavigation();
            setTimeout(() => onClick(), 50);
        };
    }, [onClick]);

    return (
        <StatCard
            title="Networks"
            value={networks.length}
            subtitle={subtitle}
            onClick={handleCardClick}
            dynamicHeight
        />
    );
});
