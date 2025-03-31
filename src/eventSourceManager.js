// Function to create the EventSource
export const createEventSource = (url, token) => {
    if (!token) {
        console.error("❌ Missing token for EventSource!");
        return null;
    }

    console.log("🔗 Connecting to EventSource with token", token);

    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
        console.log("✅ SSE connection established!");
    };

    eventSource.onerror = (error) => {
        console.error("🚨 EventSource error:", error);
        eventSource.close();

        // Reconnect after 5 seconds
        setTimeout(() => {
            console.log("🔄 Attempting EventSource reconnection...");
            createEventSource(url, token);
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