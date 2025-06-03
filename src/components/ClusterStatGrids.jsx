import React from "react";
import {Grid2, Chip} from "@mui/material";
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
                        onClick={() => {
                            console.log('[ClusterStatGrids] Clicked Up chip');
                            onClick('up');
                        }}
                    />
                    <Chip
                        label={`Warn ${statusCount.warn}`}
                        size="small"
                        sx={{backgroundColor: 'yellow', color: 'black', mr: 1, cursor: 'pointer'}}
                        onClick={() => {
                            console.log('[ClusterStatGrids] Clicked Warn chip');
                            onClick('warn');
                        }}
                    />
                    <Chip
                        label={`Down ${statusCount.down}`}
                        size="small"
                        sx={{backgroundColor: 'red', color: 'white', cursor: 'pointer'}}
                        onClick={() => {
                            console.log('[ClusterStatGrids] Clicked Down chip');
                            onClick('down');
                        }}
                    />
                </>
            }
            onClick={() => {
                console.log('[ClusterStatGrids] Clicked Objects card');
                onClick();
            }}
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

export const GridHeartbeats = ({heartbeatCount, beatingCount, nonBeatingCount, onClick}) => (
    <Grid2 size={{xs: 12, md: 4}}>
        <StatCard
            title="Heartbeats"
            value={heartbeatCount}
            subtitle={`Beating: ${beatingCount} | Non-Beating: ${nonBeatingCount}`}
            onClick={onClick}
        />
    </Grid2>
);

export const GridPools = ({poolCount, onClick}) => (
    <Grid2 size={{xs: 12, md: 4}}>
        <StatCard
            title="Pools"
            value={poolCount}
            onClick={onClick}
        />
    </Grid2>
);