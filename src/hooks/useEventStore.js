import {create} from "zustand";

const useEventStore = create((set) => ({
    nodeStatus: {},
    nodeMonitor: {},
    nodeStats: {},
    objectStatus: {},
    objectInstanceStatus: {},
    heartbeatStatus: {},
    instanceMonitor: {},
    instanceConfig: {},
    configUpdates: [],
    removeObject: (objectName) =>
        set((state) => {
            const newObjectStatus = {...state.objectStatus};
            const newObjectInstanceStatus = {...state.objectInstanceStatus};
            const newInstanceConfig = {...state.instanceConfig};
            delete newObjectStatus[objectName];
            delete newObjectInstanceStatus[objectName];
            delete newInstanceConfig[objectName];
            return {
                objectStatus: newObjectStatus,
                objectInstanceStatus: newObjectInstanceStatus,
                instanceConfig: newInstanceConfig,
            };
        }),

    setObjectStatuses: (objectStatus) =>
        set(() => ({
            objectStatus: {...objectStatus},
        })),

    setInstanceStatuses: (instanceStatuses) =>
        set((state) => {
            console.log("[useEventStore] setInstanceStatuses received:", instanceStatuses);
            const newObjectInstanceStatus = {...state.objectInstanceStatus};

            Object.keys(instanceStatuses).forEach((path) => {
                if (!newObjectInstanceStatus[path]) {
                    newObjectInstanceStatus[path] = {};
                }

                Object.keys(instanceStatuses[path]).forEach((node) => {
                    const newStatus = instanceStatuses[path][node];
                    console.log(`[useEventStore] Processing node ${node} for path ${path}:`, newStatus);

                    // Merge data, preserving encap.resources if the new data has no valid resources
                    const existingData = newObjectInstanceStatus[path][node] || {};
                    const hasValidEncapResources =
                        newStatus?.encap &&
                        Object.values(newStatus.encap).some(
                            (container) => container.resources && Object.keys(container.resources).length > 0
                        );
                    const existingHasValidEncapResources =
                        existingData?.encap &&
                        Object.values(existingData.encap).some(
                            (container) => container.resources && Object.keys(container.resources).length > 0
                        );

                    // Preserve existing encapsulated resources if the new ones are empty
                    const mergedEncap = newStatus?.encap
                        ? Object.keys(newStatus.encap).reduce((acc, containerId) => {
                            const existingContainer = existingData.encap?.[containerId] || {};
                            const newContainer = newStatus.encap[containerId] || {};
                            acc[containerId] = {
                                ...existingContainer,
                                ...newContainer,
                                resources: newContainer.resources && Object.keys(newContainer.resources).length > 0
                                    ? {...newContainer.resources}
                                    : existingContainer.resources || {},
                            };
                            return acc;
                        }, {})
                        : existingData.encap || {};

                    newObjectInstanceStatus[path][node] = {
                        node,
                        path,
                        ...newStatus,
                        encap: mergedEncap,
                    };

                    console.log(`[useEventStore] Updated node ${node} for path ${path}:`, newObjectInstanceStatus[path][node]);
                });
            });

            console.log("[useEventStore] Final objectInstanceStatus:", newObjectInstanceStatus);
            return {objectInstanceStatus: newObjectInstanceStatus};
        }),

    setNodeStatuses: (nodeStatus) =>
        set(() => ({
            nodeStatus: {...nodeStatus},
        })),

    setNodeMonitors: (nodeMonitor) =>
        set(() => ({
            nodeMonitor: {...nodeMonitor},
        })),

    setNodeStats: (nodeStats) =>
        set(() => ({
            nodeStats: {...nodeStats},
        })),

    setHeartbeatStatuses: (heartbeatStatus) =>
        set(() => ({
            heartbeatStatus: {...heartbeatStatus},
        })),

    setInstanceMonitors: (instanceMonitor) =>
        set(() => ({
            instanceMonitor: {...instanceMonitor},
        })),

    setInstanceConfig: (path, node, config) =>
        set((state) => {
            console.log("[useEventStore] setInstanceConfig called with:", {path, node, config});
            const newInstanceConfig = {...state.instanceConfig};
            if (!newInstanceConfig[path]) {
                newInstanceConfig[path] = {};
            }
            newInstanceConfig[path][node] = {...config};
            console.log("[useEventStore] Updated instanceConfig:", newInstanceConfig);
            return {instanceConfig: newInstanceConfig};
        }),

    setConfigUpdated: (updates) => {
        const normalizedUpdates = updates.map((update) => {
            // Handle direct object format {name, node}
            if (typeof update === 'object' && update !== null && update.name && update.node) {
                const namespace = "root";
                const kind = update.name === "cluster" ? "ccfg" : "svc";
                const fullName = `${namespace}/${kind}/${update.name}`;
                return {name: update.name, fullName, node: update.node};
            }
            // Handle stringified JSON format
            if (typeof update === 'string') {
                try {
                    const parsed = JSON.parse(update);
                    if (parsed.name && parsed.node) {
                        const namespace = "root";
                        const kind = parsed.name === "cluster" ? "ccfg" : "svc";
                        const fullName = `${namespace}/${kind}/${parsed.name}`;
                        return {name: parsed.name, fullName, node: parsed.node};
                    }
                } catch (e) {
                    console.warn("[useEventStore] Invalid JSON in setConfigUpdated:", update);
                    return null;
                }
            }
            // Handle SSE format with kind: "InstanceConfigUpdated"
            if (typeof update === 'object' && update.kind === "InstanceConfigUpdated") {
                const name = update.data?.path || "";
                const namespace = update.data?.labels?.namespace || "root";
                const kind = name === "cluster" ? "ccfg" : "svc";
                const fullName = `${namespace}/${kind}/${name}`;
                const node = update.data?.node || "";
                return {name, fullName, node};
            }
            return null;
        }).filter(update => update !== null);

        set((state) => {
            const existingKeys = new Set(
                state.configUpdates.map((u) => `${u.fullName}:${u.node}`)
            );
            const newUpdates = normalizedUpdates.filter(
                (u) => !existingKeys.has(`${u.fullName}:${u.node}`)
            );
            return {
                configUpdates: [...state.configUpdates, ...newUpdates],
            };
        });
    },

    clearConfigUpdate: (objectName) => set((state) => {
        const {name} = parseObjectPath(objectName);
        console.log(`🦗 [Store] Clearing config update for objectName=${objectName}, name=${name}`);
        return {
            configUpdates: state.configUpdates.filter(
                (u) => u.name !== name && u.fullName !== objectName
            ),
        };
    }),
}));

const parseObjectPath = (objName) => {
    if (!objName || typeof objName !== "string") {
        return {namespace: "root", kind: "svc", name: ""};
    }
    const parts = objName.split("/");
    const name = parts.length === 3 ? parts[2] : parts[0];
    const kind = name === "cluster" ? "ccfg" : parts.length === 3 ? parts[1] : "svc";
    const namespace = parts.length === 3 ? parts[0] : "root";
    return {namespace, kind, name};
};

export default useEventStore;
