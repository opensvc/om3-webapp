import useEventStore from "./store/useEventStore"; // nouveau

export const createEventSource = (url, token) => {
    if (!token) {
        console.error("❌ Missing token for EventSource!");
        return null;
    }

    const {updateNodeStatus, updateNodeMonitor, updateNodeStats} = useEventStore.getState();

    let cachedUrl = "/sse?cache=true&token=" + token;
    const filters = ["NodeStatusUpdated", "NodeMonitorUpdated", "NodeStatsUpdated"];
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

    return eventSource;
}

// Function to close the EventSource
export const closeEventSource = (eventSource) => {
    if (eventSource) {
        console.log("🛑 Closing EventSource");
        eventSource.close();
    }
};