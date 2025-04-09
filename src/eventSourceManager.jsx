import useEventStore from "./store/useEventStore";

export const createEventSource = (url, token) => {
    if (!token) {
        console.error("❌ Missing token for EventSource!");
        return null;
    }

    const {
        updateNodeStatus,
        updateNodeMonitor,
        updateNodeStats,
        updateObjectStatus,
    } = useEventStore.getState();

    let cachedUrl = "/sse?cache=true&token=" + token;
    const filters = [
        "NodeStatusUpdated",
        "NodeMonitorUpdated",
        "NodeStatsUpdated",
        "ObjectStatusUpdated", // 👈 Nouveau
    ];
    filters.forEach((f) => cachedUrl += `&filter=${f}`);

    const eventSource = new EventSource(cachedUrl);

    eventSource.onopen = () => {
        console.log("✅ SSE connection established!");
    };

    eventSource.onerror = (error) => {
        console.error("🚨 EventSource error:", error);
        eventSource.close();
        setTimeout(() => {
            console.log("🔄 Attempting to reconnect...");
            createEventSource(url, token);
        }, 5000);
    };

    eventSource.addEventListener("NodeStatusUpdated", (event) => {
        const {node, node_status} = JSON.parse(event.data);
        updateNodeStatus(node, node_status);
    });

    eventSource.addEventListener("NodeMonitorUpdated", (event) => {
        const {node, node_monitor} = JSON.parse(event.data);
        updateNodeMonitor(node, node_monitor);
    });

    eventSource.addEventListener("NodeStatsUpdated", (event) => {
        const {node, node_stats} = JSON.parse(event.data);
        updateNodeStats(node, node_stats);
    });

    eventSource.addEventListener("ObjectStatusUpdated", (event) => {
        try {
            const parsed = JSON.parse(event.data);
            const object_name = parsed.path ?? parsed.labels?.path;
            const object_status = parsed.object_status;

            if (!object_name || !object_status) {
                console.warn("⛔ Event is missing object_name or object_status", parsed);
                return;
            }

            console.log("📦 ObjectStatusUpdated:", object_name, object_status);
            updateObjectStatus(object_name, object_status);
        } catch (err) {
            console.error("❌ Failed to handle ObjectStatusUpdated event", err);
        }
    });



    return eventSource;
}

// Function to close the EventSource
export const closeEventSource = (eventSource) => {
    if (eventSource) {
        console.log("🛑 Closing EventSource");
        eventSource.close();
    }
};