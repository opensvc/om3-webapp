import { create } from "zustand";

const useEventStore = create((set) => ({
    nodeStatus: {},
    nodeMonitor: {},
    nodeStats: {},

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
}));

export default useEventStore;
