import {create} from "zustand";

const useEventStore = create((set) => ({
    nodeStatus: {},
    nodeMonitor: {},
    nodeStats: {},
    objectStatus: {},
    objectInstanceStatus: {},
    heartbeatStatus: {},

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
        set((state) => {
            return {
                objectStatus: {
                    ...objectStatus,
                }
            };
        }),

    setInstanceStatuses: (instanceStatuses) =>
        set(() => {
            return {
                objectInstanceStatus: {
                    ...instanceStatuses,
                }
            };
        }),

    setNodeStatuses: (nodeStatus) =>
        set(() => ({
            nodeStatus: {...nodeStatus}
        })),

    setNodeMonitors: (nodeMonitor) =>
        set(() => ({
            nodeMonitor: {...nodeMonitor}
        })),

    setNodeStats: (nodeStats) =>
        set(() => ({
            nodeStats: {...nodeStats}
        })),

    setHeartbeatStatuses: (heartbeatStatus) =>
        set(() => ({
            heartbeatStatus: {...heartbeatStatus}
        })),

}));

export default useEventStore;