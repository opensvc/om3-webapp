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
                <>
                    <Chip
                        label={`Up ${statusCount.up}`}
                        size="small"
                        sx={{backgroundColor: 'green', color: 'white', mr: 1, cursor: 'pointer'}}
                        onClick={() => onClick('up')}
                    />
                    <Chip
                        label={`Warn ${statusCount.warn}`}
                        size="small"
                        sx={{backgroundColor: 'yellow', color: 'black', mr: 1, cursor: 'pointer'}}
                        onClick={() => onClick('warn')}
                    />
                    <Chip
                        label={`Down ${statusCount.down}`}
                        size="small"
                        sx={{backgroundColor: 'red', color: 'white', cursor: 'pointer'}}
                        onClick={() => onClick('down')}
                    />
                </>
            }
            onClick={() => onClick()}
        />
    </Grid2>
);

export const GridNamespaces = ({namespaceCount, namespaceSubtitle, onClick}) => (
    <Grid2 size={{xs: 12, md: 4}}>
        <StatCard
            title="Namespaces"
            value={namespaceCount}
            subtitle={namespaceSubtitle}
            onClick={onClick}
        />
    </Grid2>
);

export const GridHeartbeats = ({heartbeatCount, beatingCount, nonBeatingCount, stateCount, onClick}) => {
    const stateColors = {
        running: 'green',
        stopped: 'orange',
        failed: 'red',
        warning: 'yellow',
        unknown: 'grey'
    };

    return (
        <Grid2 size={{xs: 12, md: 4}}>
            <StatCard
                title="Heartbeats"
                value={heartbeatCount}
                subtitle={
                    <Box>
                        <Box sx={{mb: 1}}>
                            <Chip
                                label={`Beating ${beatingCount || 0}`}
                                size="small"
                                sx={{
                                    backgroundColor: 'green',
                                    color: 'white',
                                    mr: 1,
                                    cursor: 'pointer'
                                }}
                                onClick={() => onClick('beating', null)}
                            />
                            <Chip
                                label={`Non-Beating ${nonBeatingCount || 0}`}
                                size="small"
                                sx={{
                                    backgroundColor: 'red',
                                    color: 'white',
                                    cursor: 'pointer'
                                }}
                                onClick={() => onClick('non-beating', null)}
                            />
                        </Box>
                        <Box>
                            {Object.entries(stateCount).map(([state, count]) => (
                                count > 0 && (
                                    <Chip
                                        key={state}
                                        label={`${state.charAt(0).toUpperCase() + state.slice(1)} ${count}`}
                                        size="small"
                                        sx={{
                                            backgroundColor: stateColors[state] || 'grey',
                                            color: 'white',
                                            mr: 1,
                                            mb: 1,
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => onClick(null, state)}
                                    />
                                )
                            ))}
                        </Box>
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