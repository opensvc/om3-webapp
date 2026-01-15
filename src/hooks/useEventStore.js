import {create} from "zustand";
import logger from '../utils/logger.js';

// Fonction helper
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

// Shallow comparison optimisée
const shallowEqual = (obj1, obj2) => {
    if (obj1 === obj2) return true;
    if (!obj1 || !obj2) return false;

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    for (let i = 0; i < keys1.length; i++) {
        const key = keys1[i];
        if (obj1[key] !== obj2[key]) return false;
    }

    return true;
};

const useEventStore = create((set, get) => ({
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
            if (!state.objectStatus[objectName] &&
                !state.objectInstanceStatus[objectName] &&
                !state.instanceConfig[objectName]) {
                return state;
            }

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
        set((state) => {
            if (shallowEqual(state.objectStatus, objectStatus)) {
                return state;
            }
            return {objectStatus};
        }),

    setInstanceStatuses: (instanceStatuses) =>
        set((state) => {
            let hasChanges = false;
            const newObjectInstanceStatus = {...state.objectInstanceStatus};

            for (const path in instanceStatuses) {
                if (!instanceStatuses.hasOwnProperty(path)) continue;

                if (!newObjectInstanceStatus[path]) {
                    newObjectInstanceStatus[path] = {};
                    hasChanges = true;
                }

                for (const node in instanceStatuses[path]) {
                    if (!instanceStatuses[path].hasOwnProperty(node)) continue;

                    const newStatus = instanceStatuses[path][node];
                    const existingData = newObjectInstanceStatus[path][node];

                    if (existingData && shallowEqual(existingData, newStatus)) {
                        continue;
                    }

                    hasChanges = true;

                    if (newStatus?.encap) {
                        const existingEncap = existingData?.encap || {};
                        const mergedEncap = {...existingEncap};

                        for (const containerId in newStatus.encap) {
                            if (newStatus.encap.hasOwnProperty(containerId)) {
                                const existingContainer = existingEncap[containerId] || {};
                                const newContainer = newStatus.encap[containerId] || {};
                                mergedEncap[containerId] = {
                                    ...existingContainer,
                                    ...newContainer,
                                    resources: newContainer.resources &&
                                    Object.keys(newContainer.resources).length > 0
                                        ? {...newContainer.resources}
                                        : existingContainer.resources || {},
                                };
                            }
                        }

                        newObjectInstanceStatus[path][node] = {
                            node,
                            path,
                            ...newStatus,
                            encap: mergedEncap,
                        };
                    } else {
                        newObjectInstanceStatus[path][node] = {
                            node,
                            path,
                            ...existingData,
                            ...newStatus,
                        };
                    }
                }
            }

            if (!hasChanges) {
                return state;
            }

            return {objectInstanceStatus: newObjectInstanceStatus};
        }),

    setNodeStatuses: (nodeStatus) =>
        set((state) => {
            if (shallowEqual(state.nodeStatus, nodeStatus)) {
                return state;
            }
            return {nodeStatus};
        }),

    setNodeMonitors: (nodeMonitor) =>
        set((state) => {
            if (shallowEqual(state.nodeMonitor, nodeMonitor)) {
                return state;
            }
            return {nodeMonitor};
        }),

    setNodeStats: (nodeStats) =>
        set((state) => {
            if (shallowEqual(state.nodeStats, nodeStats)) {
                return state;
            }
            return {nodeStats};
        }),

    setHeartbeatStatuses: (heartbeatStatus) =>
        set((state) => {
            if (shallowEqual(state.heartbeatStatus, heartbeatStatus)) {
                return state;
            }
            return {heartbeatStatus};
        }),

    setInstanceMonitors: (instanceMonitor) =>
        set((state) => {
            if (shallowEqual(state.instanceMonitor, instanceMonitor)) {
                return state;
            }
            return {instanceMonitor};
        }),

    setInstanceConfig: (path, node, config) =>
        set((state) => {
            if (state.instanceConfig[path]?.[node] &&
                shallowEqual(state.instanceConfig[path][node], config)) {
                return state;
            }

            const newInstanceConfig = {...state.instanceConfig};
            if (!newInstanceConfig[path]) {
                newInstanceConfig[path] = {};
            }
            newInstanceConfig[path] = {...newInstanceConfig[path], [node]: config};
            return {instanceConfig: newInstanceConfig};
        }),

    setConfigUpdated: (updates) => {
        const existingState = get();
        const existingKeys = new Set(
            existingState.configUpdates.map((u) => `${u.fullName}:${u.node}`)
        );
        const newUpdates = [];

        for (const update of updates) {
            let name, fullName, node;

            if (typeof update === "object" && update !== null) {
                if (update.name && update.node) {
                    name = update.name;
                    node = update.node;
                    const namespace = "root";
                    const kind = name === "cluster" ? "ccfg" : "svc";
                    fullName = `${namespace}/${kind}/${name}`;
                } else if (update.kind === "InstanceConfigUpdated") {
                    name = update.data?.path || "";
                    const namespace = update.data?.labels?.namespace || "root";
                    const kind = name === "cluster" ? "ccfg" : "svc";
                    fullName = `${namespace}/${kind}/${name}`;
                    node = update.data?.node || "";
                } else {
                    continue;
                }
            } else if (typeof update === "string") {
                try {
                    const parsed = JSON.parse(update);
                    if (parsed && parsed.name && parsed.node) {
                        name = parsed.name;
                        const namespace = "root";
                        const kind = name === "cluster" ? "ccfg" : "svc";
                        fullName = `${namespace}/${kind}/${name}`;
                        node = parsed.node;
                    } else {
                        continue;
                    }
                } catch (e) {
                    logger.warn("[useEventStore] Invalid JSON in setConfigUpdated:", update);
                    continue;
                }
            }

            if (name && node && !existingKeys.has(`${fullName}:${node}`)) {
                newUpdates.push({name, fullName, node});
                existingKeys.add(`${fullName}:${node}`);
            }
        }

        if (newUpdates.length > 0) {
            set((state) => ({
                configUpdates: [...state.configUpdates, ...newUpdates]
            }));
        }
    },

    clearConfigUpdate: (objectName) =>
        set((state) => {
            const {name} = parseObjectPath(objectName);
            const filtered = state.configUpdates.filter(
                (u) => u.name !== name && u.fullName !== objectName
            );

            if (filtered.length === state.configUpdates.length) {
                return state;
            }

            return {configUpdates: filtered};
        }),
}));

export default useEventStore;
