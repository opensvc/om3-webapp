import useEventStore from "./hooks/useEventStore.js";

let currentEventSource = null;
const isEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export const createEventSource = (url, token) => {
    if (!token) {
        console.error("❌ Missing token for EventSource!");
        return null;
    }

    if (currentEventSource) {
        currentEventSource.close();
    }

    const {
        setObjectStatuses,
        setInstanceStatuses,
        setNodeStatuses,
        setNodeMonitors,
        setNodeStats,
        setHeartbeatStatuses,
        removeObject,
    } = useEventStore.getState();

    // Buffers for batching SSE updates
    let objectStatusBuffer = {};
    let instanceStatusBuffer = {};
    let nodeStatusBuffer = {};
    let nodeMonitorBuffer = {};
    let nodeStatsBuffer = {};
    let heartbeatStatusBuffer = {};
    let flushTimeout = null;

    const scheduleFlush = () => {
        if (!flushTimeout) {
            flushTimeout = setTimeout(flushBuffers, 250);
        }
    };

    const flushBuffers = () => {
        const store = useEventStore.getState();

        if (Object.keys(objectStatusBuffer).length > 0) {
            const merged = {...store.objectStatus, ...objectStatusBuffer};
            setObjectStatuses(merged);
            objectStatusBuffer = {};
        }

        if (Object.keys(instanceStatusBuffer).length > 0) {
            const mergedInst = {...store.objectInstanceStatus};
            for (const obj of Object.keys(instanceStatusBuffer)) {
                mergedInst[obj] = {
                    ...mergedInst[obj],
                    ...instanceStatusBuffer[obj],
                };
            }
            setInstanceStatuses(mergedInst);
            instanceStatusBuffer = {};
        }

        if (Object.keys(nodeStatusBuffer).length > 0) {
            const merged = {...store.nodeStatus, ...nodeStatusBuffer};
            setNodeStatuses(merged);
            nodeStatusBuffer = {};
        }

        if (Object.keys(nodeMonitorBuffer).length > 0) {
            const merged = {...store.nodeMonitor, ...nodeMonitorBuffer};
            setNodeMonitors(merged);
            nodeMonitorBuffer = {};
        }

        if (Object.keys(nodeStatsBuffer).length > 0) {
            const merged = {...store.nodeStats, ...nodeStatsBuffer};
            setNodeStats(merged);
            nodeStatsBuffer = {};
        }

        if (Object.keys(heartbeatStatusBuffer).length > 0) {
            console.log("buffer:", heartbeatStatusBuffer);
            const merged = {...store.heartbeatStatus, ...heartbeatStatusBuffer};
            setHeartbeatStatuses(merged);
            heartbeatStatusBuffer = {};
        }

        flushTimeout = null;
    };

    let cachedUrl = "/sse?cache=true&token=" + token;
    const filters = [
        "NodeStatusUpdated",
        "NodeMonitorUpdated",
        "NodeStatsUpdated",
        "ObjectStatusUpdated",
        "InstanceStatusUpdated",
        "DaemonHeartbeatUpdated",
        "ObjectDeleted",
    ];
    filters.forEach((f) => cachedUrl += `&filter=${f}`);

    currentEventSource = new EventSource(cachedUrl);

    currentEventSource.onopen = () => {
        console.log("✅ SSE connection established!");
    };

    currentEventSource.onerror = (error) => {
        console.error("🚨 EventSource error:", error);
        currentEventSource.close();
        setTimeout(() => {
            console.log("🔄 Attempting to reconnect...");
            createEventSource(url, token);
        }, 5000);
    };

    currentEventSource.addEventListener("NodeStatusUpdated", (event) => {
        const {node, node_status} = JSON.parse(event.data);
        const current = useEventStore.getState().nodeStatus[node];
        if (!isEqual(current, node_status)) {
            nodeStatusBuffer[node] = node_status;
            scheduleFlush();
        }
    });

    currentEventSource.addEventListener("NodeMonitorUpdated", (event) => {
        const {node, node_monitor} = JSON.parse(event.data);
        const current = useEventStore.getState().nodeMonitor[node];
        if (!isEqual(current, node_monitor)) {
            nodeMonitorBuffer[node] = node_monitor;
            scheduleFlush();
        }
    });

    currentEventSource.addEventListener("NodeStatsUpdated", (event) => {
        const {node, node_stats} = JSON.parse(event.data);
        const current = useEventStore.getState().nodeStats[node];
        if (!isEqual(current, node_stats)) {
            nodeStatsBuffer[node] = node_stats;
            scheduleFlush();
        }
    });

    currentEventSource.addEventListener("ObjectStatusUpdated", (event) => {
        const parsed = JSON.parse(event.data);
        const name = parsed.path || parsed.labels?.path;
        const status = parsed.object_status;
        if (!name || !status) return;

        const current = useEventStore.getState().objectStatus[name];
        if (!isEqual(current, status)) {
            objectStatusBuffer[name] = status;
            scheduleFlush();
        }
    });

    currentEventSource.addEventListener("InstanceStatusUpdated", (event) => {
        const parsed = JSON.parse(event.data);
        const name = parsed.path || parsed.labels?.path;
        const node = parsed.node;
        const instStatus = parsed.instance_status;
        if (!name || !node || !instStatus) return;

        const current = useEventStore.getState().objectInstanceStatus?.[name]?.[node];
        if (!isEqual(current, instStatus)) {
            instanceStatusBuffer[name] = {
                ...(instanceStatusBuffer[name] || {}),
                [node]: instStatus,
            };
            scheduleFlush();
        }
    });

    currentEventSource.addEventListener("DaemonHeartbeatUpdated", (event) => {
        console.log("Received DaemonHeartbeatUpdated:", event.data);
        const parsed = JSON.parse(event.data);
        const node = parsed.node || parsed.labels?.node;
        const status = parsed.heartbeat;
        if (!node || status === undefined) return;


        const current = useEventStore.getState().heartbeatStatus[node];
        if (!isEqual(current, status)) {
            heartbeatStatusBuffer[node] = status;
            scheduleFlush();
        }
    });

    currentEventSource.addEventListener("ObjectDeleted", (event) => {
        console.log("📩 Received ObjectDeleted event:", event.data);
        const parsed = JSON.parse(event.data);
        const name = parsed.path || parsed.labels?.path;
        if (!name) {
            console.warn("⚠️ ObjectDeleted event missing objectName:", parsed);
            return;
        }
        delete objectStatusBuffer[name];
        delete instanceStatusBuffer[name];
        removeObject(name);
        scheduleFlush();
        console.log(`🗑️ Object '${name}' removed`);
    });

    return currentEventSource;
};

export const closeEventSource = () => {
    if (currentEventSource) {
        console.log("🛑 Closing current EventSource");
        currentEventSource.close();
        currentEventSource = null;
    }
};