import {useMemo, useDeferredValue} from 'react';
import useEventStore from './useEventStore';

const extractNamespace = (objectPath) => {
    const firstSlash = objectPath.indexOf('/');
    if (firstSlash === -1) return "root";

    const secondSlash = objectPath.indexOf('/', firstSlash + 1);
    if (secondSlash === -1) return "root";

    return objectPath.slice(0, firstSlash);
};

export const useNodeStats = () => {
    const nodeStatus = useEventStore((state) => state.nodeStatus);
    const deferredNodeStatus = useDeferredValue(nodeStatus);

    return useMemo(() => {
        const nodes = Object.values(deferredNodeStatus);
        if (nodes.length === 0) {
            return {count: 0, frozen: 0, unfrozen: 0};
        }

        let frozen = 0;
        let unfrozen = 0;

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const isFrozen = node?.frozen_at && node?.frozen_at !== "0001-01-01T00:00:00Z";
            if (isFrozen) frozen++;
            else unfrozen++;
        }

        return {count: nodes.length, frozen, unfrozen};
    }, [deferredNodeStatus]);
};

export const useObjectStats = () => {
    const objectStatus = useEventStore((state) => state.objectStatus);
    const deferredObjectStatus = useDeferredValue(objectStatus);

    return useMemo(() => {
        const objectEntries = Object.entries(deferredObjectStatus);
        if (objectEntries.length === 0) {
            return {
                objectCount: 0,
                namespaceCount: 0,
                statusCount: {up: 0, down: 0, warn: 0, "n/a": 0, unprovisioned: 0},
                namespaceSubtitle: []
            };
        }

        const namespaces = new Set();
        const statusCount = {up: 0, down: 0, warn: 0, "n/a": 0, unprovisioned: 0};
        const objectsPerNamespace = {};
        const statusPerNamespace = {};

        for (let i = 0; i < objectEntries.length; i++) {
            const [objectPath, status] = objectEntries[i];
            const ns = extractNamespace(objectPath);

            namespaces.add(ns);
            objectsPerNamespace[ns] = (objectsPerNamespace[ns] || 0) + 1;

            if (!statusPerNamespace[ns]) {
                statusPerNamespace[ns] = {up: 0, down: 0, warn: 0, "n/a": 0, unprovisioned: 0};
            }

            const s = status?.avail?.toLowerCase() || "n/a";
            if (s === "up" || s === "down" || s === "warn" || s === "n/a") {
                statusPerNamespace[ns][s]++;
                statusCount[s]++;
            } else {
                statusPerNamespace[ns]["n/a"]++;
                statusCount["n/a"]++;
            }

            const provisioned = status?.provisioned;
            if (provisioned === "false" || provisioned === false) {
                statusPerNamespace[ns].unprovisioned++;
                statusCount.unprovisioned++;
            }
        }

        const namespaceSubtitle = [];
        for (const ns in objectsPerNamespace) {
            namespaceSubtitle.push({
                namespace: ns,
                count: objectsPerNamespace[ns],
                status: statusPerNamespace[ns]
            });
        }

        namespaceSubtitle.sort((a, b) => a.namespace.localeCompare(b.namespace));

        return {
            objectCount: objectEntries.length,
            namespaceCount: namespaces.size,
            statusCount,
            namespaceSubtitle
        };
    }, [deferredObjectStatus]);
};

export const useHeartbeatStats = () => {
    const heartbeatStatus = useEventStore((state) => state.heartbeatStatus);
    const deferredHeartbeatStatus = useDeferredValue(heartbeatStatus);

    return useMemo(() => {
        const heartbeatValues = Object.values(deferredHeartbeatStatus);
        if (heartbeatValues.length === 0) {
            return {
                count: 0,
                beating: 0,
                stale: 0,
                stateCount: {running: 0, stopped: 0, failed: 0, warning: 0, unknown: 0}
            };
        }

        const heartbeatIds = new Set();
        let beating = 0;
        let stale = 0;
        const stateCount = {running: 0, stopped: 0, failed: 0, warning: 0, unknown: 0};

        for (let i = 0; i < heartbeatValues.length; i++) {
            const node = heartbeatValues[i];
            const streams = node.streams || [];

            for (let j = 0; j < streams.length; j++) {
                const stream = streams[j];
                const baseId = stream.id?.split('.')[0];
                if (baseId) heartbeatIds.add(baseId);

                const peer = Object.values(stream.peers || {})[0];
                if (peer?.is_beating) {
                    beating++;
                } else {
                    stale++;
                }

                const state = stream.state || 'unknown';
                if (stateCount.hasOwnProperty(state)) {
                    stateCount[state]++;
                } else {
                    stateCount.unknown++;
                }
            }
        }

        return {
            count: heartbeatIds.size,
            beating,
            stale,
            stateCount
        };
    }, [deferredHeartbeatStatus]);
};
