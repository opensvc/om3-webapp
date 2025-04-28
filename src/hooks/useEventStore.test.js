import useEventStore from './useEventStore';
import {act} from 'react';

describe('useEventStore', () => {
    it('should initialize with default state', () => {
        const state = useEventStore.getState();
        expect(state.nodeStatus).toEqual({});
        expect(state.nodeMonitor).toEqual({});
        expect(state.nodeStats).toEqual({});
        expect(state.objectStatus).toEqual({});
        expect(state.objectInstanceStatus).toEqual({});
        expect(state.heartbeatStatus).toEqual({});
    });

    it('should set node status correctly using setNodeStatuses', () => {
        const {setNodeStatuses} = useEventStore.getState();

        act(() => {
            setNodeStatuses({node1: {status: 'up'}});
        });

        const state = useEventStore.getState();
        expect(state.nodeStatus).toEqual({node1: {status: 'up'}});
    });

    it('should set node monitors correctly using setNodeMonitors', () => {
        const {setNodeMonitors} = useEventStore.getState();

        act(() => {
            setNodeMonitors({node1: {monitor: 'active'}});
        });

        const state = useEventStore.getState();
        expect(state.nodeMonitor).toEqual({node1: {monitor: 'active'}});
    });

    it('should set node stats correctly using setNodeStats', () => {
        const {setNodeStats} = useEventStore.getState();

        act(() => {
            setNodeStats({node1: {cpu: 80, memory: 75}});
        });

        const state = useEventStore.getState();
        expect(state.nodeStats).toEqual({node1: {cpu: 80, memory: 75}});
    });

    it('should set object statuses correctly using setObjectStatuses', () => {
        const {setObjectStatuses} = useEventStore.getState();

        act(() => {
            setObjectStatuses({object1: {status: 'active'}});
        });

        const state = useEventStore.getState();
        expect(state.objectStatus).toEqual({object1: {status: 'active'}});
    });

    it('should set instance statuses correctly using setInstanceStatuses', () => {
        const {setInstanceStatuses} = useEventStore.getState();

        act(() => {
            setInstanceStatuses({object1: {node1: {status: 'active'}}});
        });

        const state = useEventStore.getState();
        expect(state.objectInstanceStatus).toEqual({object1: {node1: {status: 'active'}}});
    });

    it('should set heartbeat statuses correctly using setHeartbeatStatuses', () => {
        const {setHeartbeatStatuses} = useEventStore.getState();

        act(() => {
            setHeartbeatStatuses({node1: {heartbeat: 'alive'}});
        });

        const state = useEventStore.getState();
        expect(state.heartbeatStatus).toEqual({node1: {heartbeat: 'alive'}});
    });

    it('should remove object correctly using removeObject', () => {
        const {setObjectStatuses, removeObject} = useEventStore.getState();

        // Set initial state
        act(() => {
            setObjectStatuses({object1: {status: 'active'}, object2: {status: 'inactive'}});
        });

        // Check the initial state
        let state = useEventStore.getState();
        expect(state.objectStatus).toEqual({
            object1: {status: 'active'},
            object2: {status: 'inactive'}
        });

        // Apply the removeObject action
        act(() => {
            removeObject('object1');
        });

        // Check the state after removing the object
        state = useEventStore.getState();
        expect(state.objectStatus).toEqual({object2: {status: 'inactive'}});
    });

    it('should not affect other properties when removing an object', () => {
        const {setObjectStatuses, setNodeStatuses, removeObject} = useEventStore.getState();

        // Set initial state for multiple properties
        act(() => {
            setObjectStatuses({object1: {status: 'active'}});
            setNodeStatuses({node1: {status: 'up'}});
        });

        // Check the initial state
        let state = useEventStore.getState();
        expect(state.objectStatus).toEqual({object1: {status: 'active'}});
        expect(state.nodeStatus).toEqual({node1: {status: 'up'}});

        // Apply removeObject
        act(() => {
            removeObject('object1');
        });

        // Check that only the data related to `objectStatus` has been changed
        state = useEventStore.getState();
        expect(state.objectStatus).toEqual({});
        expect(state.nodeStatus).toEqual({node1: {status: 'up'}});
    });
});
