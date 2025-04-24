import { create } from "zustand";

const useEventStore = create((set) => ({
    nodeStatus: {},
    nodeMonitor: {},
    nodeStats: {},
    objectStatus: {},
    objectInstanceStatus: {},
    heartbeatStatus: {},

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

    /**
     * Updates the status of a specified object within the state.
     *
     * @function
     * @param {string} objectName - The name of the object to update the status for.
     * @param {string} newStatus - The new status to assign to the specified object.
     * @returns {void}
     *
     * Note: Clients that use cache with setObjectStatuses should avoid using
     * removeObject and updateObjectStatus
     */
    updateObjectStatus: (objectName, newStatus) =>
        set((state) => ({
            objectStatus: {
                ...state.objectStatus,
                [objectName]: newStatus,
            },
        })),

    updateObjectInstanceStatus: (objectName, node, status) =>
        set((state) => ({
            objectInstanceStatus: {
                ...state.objectInstanceStatus,
                [objectName]: {
                    ...(state.objectInstanceStatus[objectName] || {}),
                    [node]: status,
                },
            },
        })),

    updateHeartbeatStatus: (node, status) =>
        set((state) => ({
            heartbeatStatus: {
                ...state.heartbeatStatus,
                [node]: status,
            },
        })),

    removeObject: (objectName) =>
        set((state) => {
            const newObjectStatus = { ...state.objectStatus };
            const newObjectInstanceStatus = { ...state.objectInstanceStatus };
            delete newObjectStatus[objectName];
            delete newObjectInstanceStatus[objectName];
            return {
                objectStatus: newObjectStatus,
                objectInstanceStatus: newObjectInstanceStatus,
            };
        }),
}));

export default useEventStore;