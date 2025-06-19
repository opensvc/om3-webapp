import React from "react";
import {Grid2, Chip, Box} from "@mui/material";
import {StatCard} from "./StatCard.jsx";

export const GridNodes = ({nodeCount, frozenCount, unfrozenCount, onClick}) => (
    <Grid2 size={{xs: 12, md: 4}}>
        <StatCard
            title="Nodes"
            value={nodeCount}
            subtitle={`Frozen: ${frozenCount} | Unfrozen: ${unfrozenCount}`}
            onClick={onClick}
        />
    </Grid2>
);

export const GridObjects = ({objectCount, statusCount, onClick}) => (
    <Grid2 size={{xs: 12, md: 4}}>
        <StatCard
            title="Objects"
            value={objectCount}
            subtitle={
                <Box sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 1,
                    flexWrap: "wrap",
                    minHeight: "32px"
                }}>
                    <Chip
                        label={`Up ${statusCount.up}`}
                        size="small"
                        sx={{
                            backgroundColor: 'green',
                            color: 'white',
                            cursor: 'pointer',
                            flexShrink: 0
                        }}
                        onClick={() => onClick('up')}
                    />
                    <Chip
                        label={`Warn ${statusCount.warn}`}
                        size="small"
                        sx={{
                            backgroundColor: 'orange',
                            color: 'white',
                            cursor: 'pointer',
                            flexShrink: 0
                        }}
                        onClick={() => onClick('warn')}
                    />
                    <Chip
                        label={`Down ${statusCount.down}`}
                        size="small"
                        sx={{
                            backgroundColor: 'red',
                            color: 'white',
                            cursor: 'pointer',
                            flexShrink: 0
                        }}
                        onClick={() => onClick('down')}
                    />
                </Box>
            }
            onClick={() => onClick()}
        />
    </Grid2>
);

export const GridNamespaces = ({namespaceCount, namespaceSubtitle, onClick}) => {
    const getNamespaceColor = (status) => {
        if (status.down > 0) return 'red';
        if (status.warn > 0) return 'orange';
        if (status.up > 0) return 'green';
        return 'grey';
    };

    return (
        <Grid2 size={{xs: 12, md: 4}}>
            <StatCard
                title="Namespaces"
                value={namespaceCount}
                subtitle={
                    <Box sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "center",
                        alignItems: "flex-start",
                        gap: 1,
                        pt: 1,
                        minHeight: "40px",
                        maxWidth: "100%",
                        overflow: "visible"
                    }}>
                        {namespaceSubtitle.map(({namespace, count, status}) => (
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
            />
        </Grid2>
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
        <Grid2 size={{xs: 12, md: 4}}>
            <StatCard
                title="Heartbeats"
                value={heartbeatCount}
                subtitle={
                    <Box sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "center",
                        alignItems: "flex-start",
                        gap: 1,
                        minHeight: "40px",
                        maxWidth: "100%"
                    }}>
                        {isSingleNode ? (
                            <Chip
                                label={`Beating ${heartbeatCount}`}
                                size="small"
                                sx={{
                                    backgroundColor: 'green',
                                    color: 'white',
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                    margin: "2px"
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
                                            flexShrink: 0,
                                            margin: "2px"
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
                                            flexShrink: 0,
                                            margin: "2px"
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
                                        flexShrink: 0,
                                        margin: "2px"
                                    }}
                                    onClick={() => onClick(null, state)}
                                />
                            )
                        ))}
                    </Box>
                }
                onClick={() => onClick()}
            />
        </Grid2>
    );
};

export const GridPools = ({poolCount, onClick}) => (
    <Grid2 size={{xs: 12, md: 4}}>
        <StatCard
            title="Pools"
            value={poolCount}
            onClick={onClick}
        />
    </Grid2>
);
