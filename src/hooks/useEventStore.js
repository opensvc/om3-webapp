import {create} from "zustand";
import logger from '../utils/logger.js';

const statusCache = new Map();
const useEventStore = create(
    (set, get) => ({
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
                objectStatus: objectStatus,
            })),
        setInstanceStatuses: (instanceStatuses) =>
            set((state) => {
                const newObjectInstanceStatus = {...state.objectInstanceStatus};
                for (const path in instanceStatuses) {
                    if (!instanceStatuses.hasOwnProperty(path)) continue;
                    if (!newObjectInstanceStatus[path]) {
                        newObjectInstanceStatus[path] = {};
                    }
                    for (const node in instanceStatuses[path]) {
                        if (!instanceStatuses[path].hasOwnProperty(node)) continue;
                        const newStatus = instanceStatuses[path][node];
                        const existingData = newObjectInstanceStatus[path][node] || {};
                        if (newStatus?.encap) {
                            const mergedEncap = {...existingData.encap};
                            for (const containerId in newStatus.encap) {
                                if (newStatus.encap.hasOwnProperty(containerId)) {
                                    const existingContainer = existingData.encap?.[containerId] || {};
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
                return {objectInstanceStatus: newObjectInstanceStatus};
            }),
        setNodeStatuses: (nodeStatus) =>
            set(() => ({nodeStatus})),
        setNodeMonitors: (nodeMonitor) =>
            set(() => ({nodeMonitor})),
        setNodeStats: (nodeStats) =>
            set(() => ({nodeStats})),
        setHeartbeatStatuses: (heartbeatStatus) =>
            set(() => ({heartbeatStatus})),
        setInstanceMonitors: (instanceMonitor) =>
            set(() => ({instanceMonitor})),
        setInstanceConfig: (path, node, config) =>
            set((state) => {
                const newInstanceConfig = {...state.instanceConfig};
                if (!newInstanceConfig[path]) {
                    newInstanceConfig[path] = {};
                }
                newInstanceConfig[path][node] = config;
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
                return {
                    configUpdates: state.configUpdates.filter(
                        (u) => u.name !== name && u.fullName !== objectName
                    ),
                };
            }),
    })
);

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
