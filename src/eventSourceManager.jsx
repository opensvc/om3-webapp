import useEventStore from "./store/useEventStore";

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
        updateNodeStatus,
        updateNodeMonitor,
        updateNodeStats,
        updateObjectStatus,
        updateObjectInstanceStatus
    } = useEventStore.getState();

    let objectStatusBuffer = {};
    let objectFlushTimeout = null;
    const flushObjectBuffer = () => {
        for (const objectName in objectStatusBuffer) {
            updateObjectStatus(objectName, objectStatusBuffer[objectName]);
        }
        objectStatusBuffer = {};
        objectFlushTimeout = null;
    };

    let instanceStatusBuffer = {};
    let instanceFlushTimeout = null;
    const flushInstanceBuffer = () => {
        for (const objectName in instanceStatusBuffer) {
            const perNode = instanceStatusBuffer[objectName];
            for (const node in perNode) {
                updateObjectInstanceStatus(objectName, node, perNode[node]);
            }
        }
        instanceStatusBuffer = {};
        instanceFlushTimeout = null;
    };

    let cachedUrl = "/sse?cache=true&token=" + token;
    const filters = [
        "NodeStatusUpdated",
        "NodeMonitorUpdated",
        "NodeStatsUpdated",
        "ObjectStatusUpdated",
        "InstanceStatusUpdated",
    ];
    filters.forEach((f) => cachedUrl += `&filter=${f}`);

    currentEventSource = new EventSource(cachedUrl); // ✅ stocké globalement

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
        objectStatusBuffer[object_name] = {
            ...(objectStatusBuffer[object_name] || {}),
            ...object_status,
        };
        if (!objectFlushTimeout) {
            objectFlushTimeout = setTimeout(flushObjectBuffer, 100);
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
        if (!instanceFlushTimeout) {
            instanceFlushTimeout = setTimeout(flushInstanceBuffer, 100);
        }
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