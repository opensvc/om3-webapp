export const createEventSource = (url, token, updateNodes) => {
    if (!token) {
        console.error("❌ Missing token for EventSource!");
        return null;
    }

    // Create the EventSource without directly passing headers (the proxy handles it)
    const eventSource = new EventSource(`/sse?token=${token}`);

    eventSource.onopen = () => {
        console.log("✅ SSE connection established!");
    };

    eventSource.onmessage = (event) => {
        console.log("📩 New SSE event received:", event.data);
    };


    // Listen for another event "NodeStatusUpdated"
    eventSource.addEventListener("NodeStatusUpdated", (event) => {
        console.log("🔄 NodeStatusUpdated event received:", event.data);

        try {
            const nodeData = JSON.parse(event.data);
            const { node, node_status } = nodeData;

            if (node && node_status) {
                updateNodes((prevNodes) => {
                    return prevNodes.map((n) =>
                        n.nodename === node
                            ? {
                                ...n,
                                status: {
                                    ...n.status,
                                    frozen_at: node_status.frozen_at,
                                },
                            }
                            : n
                    );
                });
            }
        } catch (error) {
            console.error("🚨 Error parsing NodeStatusUpdated event:", error);
        }
    });


    // Handle SSE connection errors
    eventSource.onerror = (error) => {
        console.error("🚨 EventSource error:", error);
        eventSource.close();

        // Reconnect after 5 seconds in case of an error
        setTimeout(() => {
            console.log("🔄 Attempting to reconnect to EventSource...");
            createEventSource(url, token); // Retry with the same token
        }, 5000);
    };

    return eventSource;
};

// Function to close the EventSource
export const closeEventSource = (eventSource) => {
    if (eventSource) {
        console.log("🛑 Closing EventSource");
        eventSource.close();
    }
};
