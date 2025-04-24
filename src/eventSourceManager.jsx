import useEventStore from "./hooks/useEventStore.js";

let currentEventSource = null;

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
        updateNodeStatus,
        updateNodeMonitor,
        updateNodeStats,
        updateObjectInstanceStatus,
    } = useEventStore.getState();

    let objectStatusBuffer = {};
    let objectFlushTimeoutID = null;
    const flushObjectBuffer = () => {
        setObjectStatuses(objectStatusBuffer);
        objectFlushTimeoutID = null;
    };

    let instanceStatusBuffer = {};
    let instanceFlushTimeoutID = null;
    const flushInstanceBuffer = () => {
        // TODO: fix with new setInstanceStatuses
        for (const objectName in instanceStatusBuffer) {
            const perNode = instanceStatusBuffer[objectName];
            for (const node in perNode) {
                updateObjectInstanceStatus(objectName, node, perNode[node]);
            }
        }
        instanceStatusBuffer = {};
        instanceFlushTimeoutID = null;
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
        updateNodeStatus(node, node_status);
    });

    currentEventSource.addEventListener("NodeMonitorUpdated", (event) => {
        const {node, node_monitor} = JSON.parse(event.data);
        updateNodeMonitor(node, node_monitor);
    });

    currentEventSource.addEventListener("NodeStatsUpdated", (event) => {
        const {node, node_stats} = JSON.parse(event.data);
        updateNodeStats(node, node_stats);
    });

    currentEventSource.addEventListener("ObjectStatusUpdated", (event) => {
        const parsed = JSON.parse(event.data);
        const object_name = parsed.path || parsed.labels?.path;
        const object_status = parsed.object_status;
        if (!object_name || !object_status) return;

        objectStatusBuffer[object_name] = object_status
        if (!objectFlushTimeoutID) {
            objectFlushTimeoutID = setTimeout(flushObjectBuffer, 250);
        }
    });

    currentEventSource.addEventListener("InstanceStatusUpdated", (event) => {
        const parsed = JSON.parse(event.data);
        const objectName = parsed.path || parsed.labels?.path;
        const node = parsed.node;
        const instanceStatus = parsed.instance_status;
        if (!objectName || !node || !instanceStatus) return;
        instanceStatusBuffer[objectName] = {
            ...(instanceStatusBuffer[objectName] || {}),
            [node]: instanceStatus,
        };
        if (!instanceFlushTimeoutID) {
            instanceFlushTimeoutID = setTimeout(flushInstanceBuffer, 250);
        }
    });

    currentEventSource.addEventListener("DaemonHeartbeatUpdated", (event) => {
        const parsed = JSON.parse(event.data);
        const node = parsed.node || parsed.labels?.node;
        const status = parsed.hb;
        if (!node || !status) return;
        useEventStore.getState().updateHeartbeatStatus(node, status);
    });

    currentEventSource.addEventListener("ObjectDeleted", (event) => {
        console.log("📩 Received ObjectDeleted event:", event.data);
        const parsed = JSON.parse(event.data);
        const objectName = parsed.path || parsed.labels?.path;
        if (!objectName) {
            console.warn("⚠️ ObjectDeleted event missing objectName:", parsed);
            return;
        }

        const {objectInstanceStatus} = useEventStore.getState();
        const newObjectInstanceStatus = {...objectInstanceStatus};
        delete objectStatusBuffer[objectName];
        delete newObjectInstanceStatus[objectName];

        if (!objectFlushTimeoutID) {
            objectFlushTimeoutID = setTimeout(flushObjectBuffer, 205);
        }

        useEventStore.setState({
            objectInstanceStatus: newObjectInstanceStatus,
        });

        console.log(`🗑️ Object '${objectName}' deleted from store`);
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