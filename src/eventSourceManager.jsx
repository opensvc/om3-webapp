export const createEventSource = (url, token, onEventToState) => {
    if (!token) {
        console.error("❌ Missing token for EventSource!");
        return null;
    }

    let cachedUrl = "/sse?cache=true"
    for (const eventName in onEventToState) {
        cachedUrl += `&filter=${eventName}`
    }
    console.log("eventSource url", cachedUrl)
    const eventSource = new EventSource(cachedUrl+`&token=${token}`);

    eventSource.onopen = () => {
        console.log("✅ SSE connection established!");
    };

    for (const eventName in onEventToState) {
        if (!onEventToState.hasOwnProperty(eventName)) {
            continue
        }
        console.log("addEventListener for %s", eventName)
        const ev2state = onEventToState[eventName]

        eventSource.addEventListener(eventName, (event) => {
            // console.log("🔄 %s event received:", event.data);
            try {
                const parsedData = JSON.parse(event.data);
                switch (eventName) {
                    case 'NodeStatusUpdated': {
                        const {node, node_status} = parsedData;
                        console.log("🔄 Updating node %s from %s", node, eventName, node_status)
                        ev2state((prev) => {
                            return {
                                ...prev,
                                [node]: node_status
                            }
                        })
                        break
                    }
                    case 'NodeMonitorUpdated': {
                        const {node, node_monitor} = parsedData;
                        console.log("🔄 Updating node %s from %s", node, eventName, node_monitor)
                        ev2state((prev) => {
                            return {
                                ...prev,
                                [node]: node_monitor
                            }
                        })
                        break
                    }
                    case 'NodeStatsUpdated': {
                        const {node, node_stats} = parsedData;
                        console.log("🔄 Updating node %s from %s", node, eventName, node_stats)
                        ev2state((prev) => {
                            return {
                                ...prev,
                                [node]: node_stats
                            }
                        })
                        break
                    }
                }
            } catch (error) {
                console.error("🚨 Error parsing %s event:", eventName, error);
            }
        })
    }
    eventSource.onerror = (error) => {
        console.error("🚨 EventSource error:", error);
        eventSource.close();
        setTimeout(() => {
            console.log("🔄 Attempting to reconnect to EventSource...");
            createEventSource(url, token, onEventToState);
        }, 5000);
    };

    return eventSource;
}

// Function to close the EventSource
export const closeEventSource = (eventSource) => {
    if (eventSource) {
        console.log("🛑 Closing EventSource");
        eventSource.close();
    }
};