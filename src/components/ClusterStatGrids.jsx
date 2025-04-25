import React from "react";
import {Grid2} from "@mui/material";
import {StatCard} from "./StatCard.jsx";

export const GridNodes = ({ nodeCount, frozenCount, unfrozenCount, onClick }) => (
    <Grid2 size={{ xs: 12, md: 4 }}>
        <StatCard
            title="Nodes"
            value={nodeCount}
            subtitle={`Frozen: ${frozenCount} | Unfrozen: ${unfrozenCount}`}
            onClick={onClick}
        />
    </Grid2>
);

export const GridObjects = ({ objectCount, statusCount, onClick }) => (
    <Grid2 size={{ xs: 12, md: 4 }}>
        <StatCard
            title="Objects"
            value={objectCount}
            subtitle={`🟢 ${statusCount.up} | 🟡 ${statusCount.warn} | 🔴 ${statusCount.down}`}
            onClick={onClick}
        />
    </Grid2>
);

export const GridNamespaces = ({ namespaceCount, namespaceSubtitle, onClick }) => (
    <Grid2 size={{ xs: 12, md: 4 }}>
        <StatCard
            title="Namespaces"
            value={namespaceCount}
            subtitle={namespaceSubtitle}
            onClick={onClick}
        />
    </Grid2>
);

export const GridHeartbeats = ({ heartbeatCount, onClick }) => (
    <Grid2 size={{ xs: 12, md: 4 }}>
        <StatCard
            title="Heartbeats"
            value={heartbeatCount}
            onClick={onClick}
        />
    </Grid2>
);

export const GridPools = ({ poolCount, onClick }) => (
    <Grid2 size={{ xs: 12, md: 4 }}>
        <StatCard
            title="Pools"
            value={poolCount}
            onClick={onClick}
        />
    </Grid2>
);
