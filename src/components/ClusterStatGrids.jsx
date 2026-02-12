import React, {memo, useMemo, useCallback, useState} from "react";
import {Chip, Box, Tooltip, CircularProgress} from "@mui/material";
import StatCard from "./StatCard.jsx";
import {prepareForNavigation} from "../eventSourceManager";

const ClickLoader = memo(({isLoading}) => (
    <Box sx={{display: 'inline-flex', alignItems: 'center', ml: 1}}>
        {isLoading && <CircularProgress size={12}/>}
    </Box>
));

export const GridNodes = memo(({nodeCount, frozenCount, onClick}) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = useCallback(() => {
        setIsLoading(true);
        prepareForNavigation();
        setTimeout(() => {
            onClick();
            setIsLoading(false);
        }, 50);
    }, [onClick]);

    const subtitle = useMemo(() => (
        <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            width: '100%'
        }}>
            <Chip
                label={`Frozen ${frozenCount}`}
                size="small"
                sx={{
                    backgroundColor: 'info.main',
                    color: 'white',
                    cursor: isLoading ? 'default' : 'pointer',
                    opacity: isLoading ? 0.7 : 1,
                }}
                onClick={handleClick}
                disabled={isLoading}
            />
            <ClickLoader isLoading={isLoading}/>
        </Box>
    ), [frozenCount, isLoading, handleClick]);

    return (
        <StatCard
            title="Nodes"
            value={nodeCount}
            subtitle={subtitle}
            onClick={handleClick}
        />
    );
});

export const GridObjects = memo(({objectCount, statusCount, onClick}) => {
    const [loadingStatus, setLoadingStatus] = useState('');

    const handleChipClick = useCallback((status) => {
        setLoadingStatus(status);
        prepareForNavigation();
        setTimeout(() => {
            onClick(status);
            setLoadingStatus('');
        }, 50);
    }, [onClick]);

    const handleCardClick = useCallback(() => {
        setLoadingStatus('all');
        prepareForNavigation();
        setTimeout(() => {
            onClick();
            setLoadingStatus('');
        }, 50);
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
                        isLoading={loadingStatus === status}
                        onClick={() => handleChipClick(status)}
                    />
                );
            }
        }

        return (
            <Box sx={{display: "flex", justifyContent: "center", gap: 1, flexWrap: "wrap"}}>
                {chips}
                {loadingStatus === 'all' && <CircularProgress size={20}/>}
            </Box>
        );
    }, [statusCount, loadingStatus, handleChipClick]);

    return (
        <StatCard
            title="Objects"
            value={objectCount}
            subtitle={subtitle}
            onClick={handleCardClick}
        />
    );
});

const StatusChip = memo(({status, count, isLoading, onClick}) => {
    const colors = {
        up: 'green',
        warn: 'orange',
        down: 'red',
        unprovisioned: 'red'
    };

    const handleClick = useCallback((e) => {
        e.stopPropagation();
        if (!isLoading) {
            onClick();
        }
    }, [onClick, isLoading]);

    return (
        <Box sx={{display: 'inline-flex', alignItems: 'center', gap: 0.5}}>
            <Chip
                label={`${status.charAt(0).toUpperCase() + status.slice(1)} ${count}`}
                size="small"
                sx={{
                    backgroundColor: colors[status] || 'grey',
                    color: 'white',
                    cursor: isLoading ? 'default' : 'pointer',
                    opacity: isLoading ? 0.7 : 1,
                }}
                onClick={handleClick}
                disabled={isLoading}
            />
            {isLoading && <CircularProgress size={12}/>}
        </Box>
    );
});

export const GridNamespaces = memo(({namespaceCount, namespaceSubtitle, onClick}) => {
    const [loadingNamespace, setLoadingNamespace] = useState('');
    const [isCardLoading, setIsCardLoading] = useState(false);

    const handleCardClick = useCallback(() => {
        setIsCardLoading(true);
        prepareForNavigation();
        setTimeout(() => {
            onClick('/namespaces');
            setIsCardLoading(false);
        }, 50);
    }, [onClick]);

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
                        isLoading={loadingNamespace === namespace}
                        onClick={onClick}
                        onLoadingChange={setLoadingNamespace}
                    />
                ))}
            </Box>
        );
    }, [namespaceSubtitle, loadingNamespace, onClick]);

    return (
        <StatCard
            title="Namespaces"
            value={namespaceCount}
            subtitle={subtitle}
            onClick={handleCardClick}
            dynamicHeight
            isLoading={isCardLoading}
        />
    );
});

const NamespaceChip = memo(({namespace, status, isLoading, onClick, onLoadingChange}) => {
    const getStatusColor = useCallback((stat) => {
        const colors = {
            up: 'green',
            warn: 'orange',
            down: 'red',
            'n/a': 'grey',
            unprovisioned: 'red'
        };
        return colors[stat] || 'grey';
    }, []);

    const handleStatClick = useCallback((stat, e) => {
        e.stopPropagation();
        onLoadingChange(namespace);
        prepareForNavigation();
        setTimeout(() => {
            onClick(`/objects?namespace=${namespace}&globalState=${stat}`);
            onLoadingChange('');
        }, 50);
    }, [namespace, onClick, onLoadingChange]);

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
                                zIndex: 1,
                                opacity: isLoading ? 0.5 : 1
                            }}
                            onClick={(e) => !isLoading && handleStatClick(stat, e)}
                            aria-label={`${stat} status for namespace ${namespace}: ${count} objects`}
                        >
                            {count}
                        </Box>
                    </Tooltip>
                );
            }
        }
        return elements;
    }, [namespace, status, isLoading, handleStatClick, getStatusColor]);

    const handleChipClick = useCallback((e) => {
        e.stopPropagation();
        if (isLoading) return;
        onLoadingChange(namespace);
        prepareForNavigation();
        setTimeout(() => {
            onClick(`/objects?namespace=${namespace}`);
            onLoadingChange('');
        }, 50);
    }, [namespace, isLoading, onClick, onLoadingChange]);

    return (
        <Box
            sx={{
                position: 'relative',
                display: 'inline-flex',
                flexShrink: 0,
                margin: "4px",
                alignItems: "center",
                opacity: isLoading ? 0.7 : 1
            }}
        >
            <Chip
                label={namespace}
                size="small"
                sx={{
                    backgroundColor: 'default',
                    cursor: isLoading ? 'default' : 'pointer',
                    minWidth: "100px",
                    px: 2,
                    height: 24,
                    pr: 4
                }}
                onClick={handleChipClick}
                disabled={isLoading}
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
            {isLoading && (
                <Box sx={{position: 'absolute', top: -5, right: -5}}>
                    <CircularProgress size={16}/>
                </Box>
            )}
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
    const [isLoading, setIsLoading] = useState(false);
    const [loadingState, setLoadingState] = useState('');

    const stateColors = {
        running: 'green',
        stopped: 'orange',
        failed: 'red',
        warning: 'orange',
        unknown: 'grey'
    };

    const isSingleNode = nodeCount === 1;

    const handleCardClick = useCallback(() => {
        setIsLoading(true);
        prepareForNavigation();
        setTimeout(() => {
            onClick();
            setIsLoading(false);
        }, 50);
    }, [onClick]);

    const handleStatusClick = useCallback((status, state) => {
        setLoadingState(status || state);
        prepareForNavigation();
        setTimeout(() => {
            onClick(status, state);
            setLoadingState('');
        }, 50);
    }, [onClick]);

    const subtitle = useMemo(() => {
        const chips = [];

        if (isSingleNode) {
            chips.push(
                <Box key="beating" sx={{display: 'inline-flex', alignItems: 'center', gap: 0.5}}>
                    <Chip
                        label={`Beating ${heartbeatCount}`}
                        size="small"
                        sx={{
                            backgroundColor: 'green',
                            color: 'white',
                            cursor: loadingState === 'beating' ? 'default' : 'pointer',
                            opacity: loadingState === 'beating' ? 0.7 : 1
                        }}
                        onClick={() => loadingState !== 'beating' && handleStatusClick('beating', null)}
                        title="Healthy (Single Node)"
                        disabled={loadingState === 'beating'}
                    />
                    {loadingState === 'beating' && <CircularProgress size={12}/>}
                </Box>
            );
        } else {
            if (beatingCount > 0) {
                chips.push(
                    <Box key="beating" sx={{display: 'inline-flex', alignItems: 'center', gap: 0.5}}>
                        <Chip
                            label={`Beating ${beatingCount}`}
                            size="small"
                            sx={{
                                backgroundColor: 'green',
                                color: 'white',
                                cursor: loadingState === 'beating' ? 'default' : 'pointer',
                                opacity: loadingState === 'beating' ? 0.7 : 1
                            }}
                            onClick={() => loadingState !== 'beating' && handleStatusClick('beating', null)}
                            disabled={loadingState === 'beating'}
                        />
                        {loadingState === 'beating' && <CircularProgress size={12}/>}
                    </Box>
                );
            }

            if (nonBeatingCount > 0) {
                chips.push(
                    <Box key="stale" sx={{display: 'inline-flex', alignItems: 'center', gap: 0.5}}>
                        <Chip
                            label={`Stale ${nonBeatingCount}`}
                            size="small"
                            sx={{
                                backgroundColor: 'red',
                                color: 'white',
                                cursor: loadingState === 'stale' ? 'default' : 'pointer',
                                opacity: loadingState === 'stale' ? 0.7 : 1
                            }}
                            onClick={() => loadingState !== 'stale' && handleStatusClick('stale', null)}
                            disabled={loadingState === 'stale'}
                        />
                        {loadingState === 'stale' && <CircularProgress size={12}/>}
                    </Box>
                );
            }
        }

        for (const [state, count] of Object.entries(stateCount)) {
            if (count > 0) {
                chips.push(
                    <Box key={state} sx={{display: 'inline-flex', alignItems: 'center', gap: 0.5}}>
                        <Chip
                            label={`${state.charAt(0).toUpperCase() + state.slice(1)} ${count}`}
                            size="small"
                            sx={{
                                backgroundColor: stateColors[state] || 'grey',
                                color: 'white',
                                cursor: loadingState === state ? 'default' : 'pointer',
                                opacity: loadingState === state ? 0.7 : 1
                            }}
                            onClick={() => loadingState !== state && handleStatusClick(null, state)}
                            disabled={loadingState === state}
                        />
                        {loadingState === state && <CircularProgress size={12}/>}
                    </Box>
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
    }, [isSingleNode, heartbeatCount, beatingCount, nonBeatingCount, stateCount, loadingState, handleStatusClick, stateColors]);

    return (
        <StatCard
            title="Heartbeats"
            value={heartbeatCount}
            subtitle={subtitle}
            onClick={handleCardClick}
            isLoading={isLoading && !loadingState}
        />
    );
});

export const GridPools = memo(({poolCount, onClick}) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = useCallback(() => {
        setIsLoading(true);
        prepareForNavigation();
        setTimeout(() => {
            onClick();
            setIsLoading(false);
        }, 50);
    }, [onClick]);

    return (
        <StatCard
            title="Pools"
            value={poolCount}
            onClick={handleClick}
            isLoading={isLoading}
        />
    );
});

export const GridNetworks = memo(({networks, onClick}) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleCardClick = useCallback(() => {
        setIsLoading(true);
        prepareForNavigation();
        setTimeout(() => {
            onClick();
            setIsLoading(false);
        }, 50);
    }, [onClick]);

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

    return (
        <StatCard
            title="Networks"
            value={networks.length}
            subtitle={subtitle}
            onClick={handleCardClick}
            dynamicHeight
            isLoading={isLoading}
        />
    );
});
