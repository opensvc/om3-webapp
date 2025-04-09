import { create } from "zustand";

const useEventStore = create((set) => ({
    nodeStatus: {},
    nodeMonitor: {},
    nodeStats: {},
    objectStatus: {},

    updateNodeStatus: (node, data) =>
        set((state) => ({
            nodeStatus: { ...state.nodeStatus, [node]: data },
        })),

    updateNodeMonitor: (node, data) =>
        set((state) => ({
            nodeMonitor: { ...state.nodeMonitor, [node]: data },
        })),

    updateNodeStats: (node, data) =>
        set((state) => ({
            nodeStats: { ...state.nodeStats, [node]: data },
        })),

    updateObjectStatus: (objectName, newStatus) =>
        set((state) => ({
            objectStatus: {
                ...state.objectStatus,
                [objectName]: {
                    ...(state.objectStatus[objectName] || {}),
                    ...newStatus,
                },
            },
        })),
}));


export default useEventStore;
