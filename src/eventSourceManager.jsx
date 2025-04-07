export const createEventSource = (url, token, updateNodes) => {
    if (!token) {
        console.error("❌ Missing token for EventSource!");
        return null;
    }

    const eventSource = new EventSource(`/sse?token=${token}`);

    eventSource.onopen = () => {
        console.log("✅ SSE connection established!");
    };

    eventSource.addEventListener("NodeStatusUpdated", (event) => {
        console.log("🔄 NodeStatusUpdated event received:", event.data);

        try {
            const nodeData = JSON.parse(event.data);
            const { node, node_status } = nodeData;

            if (node && node_status) {
                console.log("🔄 Updating Node Status:", node, node_status);
                updateNodes((prevNodes) => {
                    const existingNode = prevNodes.find(n => n.node === node);
                    if (existingNode) {
                        return prevNodes.map((n) =>
                            n.node === node
                                ? {
                                    ...n,
                                    node_status: {
                                        ...n.node_status,
                                        frozen_at: node_status.frozen_at,
                                    },
                                }
                                : n
                        );
                    } else {
                        return [...prevNodes, { node, node_status }];
                    }
                });
            }
        } catch (error) {
            console.error("🚨 Error parsing NodeStatusUpdated event:", error);
        }
    });

    eventSource.addEventListener("NodeMonitorUpdated", (event) => {
        console.log("🧭 NodeMonitorUpdated event received:", event.data);

        try {
            const data = JSON.parse(event.data);
            const { node, node_monitor } = data;

            if (node && node_monitor) {
                console.log("🧭 Updating Node Monitor:", node, node_monitor);
                updateNodes((prevNodes) => {
                    const existingNode = prevNodes.find((n) => n.node === node);
                    let updatedNodes;
                    if (existingNode) {
                        updatedNodes = prevNodes.map((n) =>
                            n.node === node
                                ? {
                                    ...n,
                                    monitor: {
                                        ...n.monitor,
                                        ...node_monitor,
                                    },
                                }
                                : n
                        );
                    } else {
                        updatedNodes = [
                            ...prevNodes,
                            {
                                node,
                                monitor: node_monitor,
                                node_status: {},
                            },
                        ];
                    }
                    return updatedNodes;
                });
            }
        } catch (error) {
            console.error("🚨 Error parsing NodeMonitorUpdated event:", error);
        }
    });

    eventSource.addEventListener("InstanceMonitorUpdated", (event) => {
        console.log("📦 InstanceMonitorUpdated event received:", event.data);

        try {
            const data = JSON.parse(event.data);
            const { instance_monitor, labels, node } = data;

            if (instance_monitor && labels && node) {
                console.log("📦 Updating Instance Monitor:", instance_monitor, labels, node);
                updateNodes((prevNodes) => {
                    const existingNode = prevNodes.find((n) => n.node === node);
                    let updatedNodes;
                    if (existingNode) {
                        updatedNodes = prevNodes.map((n) =>
                            n.node === node
                                ? {
                                    ...n,
                                    instance_monitor: {
                                        ...n.instance_monitor,
                                        ...instance_monitor,
                                    },
                                    labels: { ...n.labels, ...labels },
                                }
                                : n
                        );
                    } else {
                        updatedNodes = [
                            ...prevNodes,
                            {
                                node,
                                instance_monitor,
                                labels,
                            },
                        ];
                    }
                    return updatedNodes;
                });
            }
        } catch (error) {
            console.error("🚨 Error parsing InstanceMonitorUpdated event:", error);
        }
    });


    eventSource.onerror = (error) => {
        console.error("🚨 EventSource error:", error);
        eventSource.close();
        setTimeout(() => {
            console.log("🔄 Attempting to reconnect to EventSource...");
            createEventSource(url, token, updateNodes);
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
