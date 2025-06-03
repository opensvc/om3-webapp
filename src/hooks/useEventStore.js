import {create} from "zustand";

const useEventStore = create((set) => ({
    nodeStatus: {},
    nodeMonitor: {},
    nodeStats: {},
    objectStatus: {},
    objectInstanceStatus: {},
    heartbeatStatus: {},
    instanceMonitor: {},
    configUpdates: [],
    removeObject: (objectName) =>
        set((state) => {
            const newObjectStatus = {...state.objectStatus};
            const newObjectInstanceStatus = {...state.objectInstanceStatus};
            delete newObjectStatus[objectName];
            delete newObjectInstanceStatus[objectName];
            return {
                objectStatus: newObjectStatus,
                objectInstanceStatus: newObjectInstanceStatus,
            };
        }),

    setObjectStatuses: (objectStatus) =>
        set(() => ({
            objectStatus: {...objectStatus},
        })),

    setInstanceStatuses: (instanceStatuses) =>
        set(() => ({
            objectInstanceStatus: {...instanceStatuses},
        })),

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

    setConfigUpdated: (updates) => {
        console.log("🔄 [Store] Received config updates:", JSON.stringify(updates, null, 2));
        const normalizedUpdates = updates.map((update) => {
            // Handle direct format {name, node}
            if (update.name && update.node) {
                const namespace = "root";
                const kind = update.name === "cluster" ? "ccfg" : "svc";
                const fullName = `${namespace}/${kind}/${update.name}`;
                return {name: update.name, fullName, node: update.node};
            }
            // Handle SSE format with kind: "InstanceConfigUpdated"
            if (update.kind === "InstanceConfigUpdated") {
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