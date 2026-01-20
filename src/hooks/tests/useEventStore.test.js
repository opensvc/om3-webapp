import useEventStore from '../useEventStore.js';
import {act} from '@testing-library/react';

// Mock logger
jest.mock('../../utils/logger.js', () => ({
    warn: jest.fn(),
}));

import logger from '../../utils/logger.js';

describe('useEventStore', () => {
    // Reset state before each test to avoid interference
    beforeEach(() => {
        act(() => {
            useEventStore.setState({
                nodeStatus: {},
                nodeMonitor: {},
                nodeStats: {},
                objectStatus: {},
                objectInstanceStatus: {},
                heartbeatStatus: {},
                instanceMonitor: {},
                instanceConfig: {},
                configUpdates: [],
            });
        });
        jest.clearAllMocks();
    });

    test('should initialize with default state', () => {
        const state = useEventStore.getState();
        expect(state.nodeStatus).toEqual({});
        expect(state.nodeMonitor).toEqual({});
        expect(state.nodeStats).toEqual({});
        expect(state.objectStatus).toEqual({});
        expect(state.objectInstanceStatus).toEqual({});
        expect(state.heartbeatStatus).toEqual({});
        expect(state.instanceMonitor).toEqual({});
        expect(state.instanceConfig).toEqual({});
        expect(state.configUpdates).toEqual([]);
    });

    // Test setNodeStatuses
    test('should set node status correctly using setNodeStatuses', () => {
        const {setNodeStatuses} = useEventStore.getState();

        act(() => {
            setNodeStatuses({node1: {status: 'up'}});
        });

        const state = useEventStore.getState();
        expect(state.nodeStatus).toEqual({node1: {status: 'up'}});
    });

    test('should not update node statuses if shallow equal', () => {
        const {setNodeStatuses} = useEventStore.getState();
        const sameData = {node1: {status: 'up'}};

        act(() => {
            setNodeStatuses(sameData);
        });

        const firstState = useEventStore.getState();

        act(() => {
            setNodeStatuses({...sameData}); // Different reference, same content
        });

        const secondState = useEventStore.getState();
        expect(secondState.nodeStatus).toEqual(firstState.nodeStatus);
    });

    // Test setNodeMonitors
    test('should set node monitors correctly using setNodeMonitors', () => {
        const {setNodeMonitors} = useEventStore.getState();

        act(() => {
            setNodeMonitors({node1: {monitor: 'active'}});
        });

        const state = useEventStore.getState();
        expect(state.nodeMonitor).toEqual({node1: {monitor: 'active'}});
    });

    test('should not update node monitors if shallow equal', () => {
        const {setNodeMonitors} = useEventStore.getState();
        const sameData = {node1: {monitor: 'active'}};

        act(() => {
            setNodeMonitors(sameData);
        });

        act(() => {
            setNodeMonitors(sameData);
        });

        const state = useEventStore.getState();
        expect(state.nodeMonitor).toBe(sameData);
    });

    // Test setNodeStats
    test('should set node stats correctly using setNodeStats', () => {
        const {setNodeStats} = useEventStore.getState();

        act(() => {
            setNodeStats({node1: {cpu: 80, memory: 75}});
        });

        const state = useEventStore.getState();
        expect(state.nodeStats).toEqual({node1: {cpu: 80, memory: 75}});
    });

    test('should not update node stats if shallow equal', () => {
        const {setNodeStats} = useEventStore.getState();
        const sameData = {node1: {cpu: 80, memory: 75}};

        act(() => {
            setNodeStats(sameData);
        });

        act(() => {
            setNodeStats({node1: {cpu: 80, memory: 75}});
        });

        const state = useEventStore.getState();
        expect(state.nodeStats).toEqual(sameData);
    });

    // Test setObjectStatuses
    test('should set object statuses correctly using setObjectStatuses', () => {
        const {setObjectStatuses} = useEventStore.getState();

        act(() => {
            setObjectStatuses({object1: {status: 'active'}});
        });

        const state = useEventStore.getState();
        expect(state.objectStatus).toEqual({object1: {status: 'active'}});
    });

    test('should not update object statuses if shallow equal', () => {
        const {setObjectStatuses} = useEventStore.getState();
        const sameData = {object1: {status: 'active'}};

        act(() => {
            setObjectStatuses(sameData);
        });

        const firstState = useEventStore.getState();

        act(() => {
            setObjectStatuses(sameData);
        });

        const secondState = useEventStore.getState();
        expect(secondState.objectStatus).toBe(firstState.objectStatus);
    });

    // Test setInstanceStatuses
    test('should set instance statuses correctly using setInstanceStatuses', () => {
        const {setInstanceStatuses} = useEventStore.getState();

        act(() => {
            setInstanceStatuses({object1: {node1: {status: 'active'}}});
        });

        const state = useEventStore.getState();
        expect(state.objectInstanceStatus).toEqual({
            object1: {
                node1: {
                    node: 'node1',
                    path: 'object1',
                    status: 'active',
                }
            }
        });
    });

    test('should not update instance statuses if shallow equal', () => {
        const {setInstanceStatuses} = useEventStore.getState();
        const sameData = {object1: {node1: {status: 'active'}}};

        act(() => {
            setInstanceStatuses(sameData);
        });

        const firstState = useEventStore.getState();

        act(() => {
            setInstanceStatuses(sameData);
        });

        const secondState = useEventStore.getState();
        expect(secondState.objectInstanceStatus)
            .toEqual(firstState.objectInstanceStatus);
    });

    test('should handle empty instance statuses object', () => {
        const {setInstanceStatuses} = useEventStore.getState();

        act(() => {
            setInstanceStatuses({});
        });

        const state = useEventStore.getState();
        expect(state.objectInstanceStatus).toEqual({});
    });

    test('should handle instance statuses with no properties', () => {
        const {setInstanceStatuses} = useEventStore.getState();

        act(() => {
            setInstanceStatuses({object1: {}});
        });

        const state = useEventStore.getState();
        expect(state.objectInstanceStatus).toEqual({object1: {}});
    });

    test('should preserve existing encapsulated resources in setInstanceStatuses', () => {
        const {setInstanceStatuses} = useEventStore.getState();

        act(() => {
            setInstanceStatuses({
                object1: {
                    node1: {
                        status: 'active',
                        encap: {
                            container1: {
                                resources: {cpu: 100, memory: 200}
                            }
                        }
                    }
                }
            });
        });

        act(() => {
            setInstanceStatuses({
                object1: {
                    node1: {
                        status: 'updated',
                        encap: {
                            container1: {
                                resources: {}
                            }
                        }
                    }
                }
            });
        });

        const state = useEventStore.getState();
        expect(state.objectInstanceStatus.object1.node1.encap.container1.resources).toEqual(
            {cpu: 100, memory: 200}
        );
    });

    test('should handle undefined encap property', () => {
        const {setInstanceStatuses} = useEventStore.getState();

        act(() => {
            setInstanceStatuses({
                object1: {
                    node1: {
                        status: 'active',
                        encap: undefined
                    }
                }
            });
        });

        const state = useEventStore.getState();
        expect(state.objectInstanceStatus.object1.node1.encap).toBeUndefined();
    });

    // Test setHeartbeatStatuses
    test('should set heartbeat statuses correctly using setHeartbeatStatuses', () => {
        const {setHeartbeatStatuses} = useEventStore.getState();

        act(() => {
            setHeartbeatStatuses({node1: {heartbeat: 'alive'}});
        });

        const state = useEventStore.getState();
        expect(state.heartbeatStatus).toEqual({node1: {heartbeat: 'alive'}});
    });

    // Test setInstanceMonitors
    test('should set instance monitors correctly using setInstanceMonitors', () => {
        const {setInstanceMonitors} = useEventStore.getState();

        act(() => {
            setInstanceMonitors({object1: {monitor: 'running'}});
        });

        const state = useEventStore.getState();
        expect(state.instanceMonitor).toEqual({object1: {monitor: 'running'}});
    });

    // Test setInstanceConfig
    test('should set instance config correctly using setInstanceConfig', () => {
        const {setInstanceConfig} = useEventStore.getState();

        act(() => {
            setInstanceConfig('object1', 'node1', {setting: 'value'});
        });

        const state = useEventStore.getState();
        expect(state.instanceConfig).toEqual({
            object1: {
                node1: {setting: 'value'}
            }
        });
    });

    test('should not update instance config if shallow equal', () => {
        const {setInstanceConfig} = useEventStore.getState();
        const config = {setting: 'value'};

        act(() => {
            setInstanceConfig('object1', 'node1', config);
        });

        const firstState = useEventStore.getState();

        act(() => {
            setInstanceConfig('object1', 'node1', config);
        });

        const secondState = useEventStore.getState();
        expect(secondState.instanceConfig).toBe(firstState.instanceConfig);
    });

    // Test removeObject
    test('should remove object correctly using removeObject', () => {
        const {setObjectStatuses, removeObject} = useEventStore.getState();

        act(() => {
            setObjectStatuses({object1: {status: 'active'}, object2: {status: 'inactive'}});
        });

        act(() => {
            removeObject('object1');
        });

        const state = useEventStore.getState();
        expect(state.objectStatus).toEqual({object2: {status: 'inactive'}});
    });

    test('should handle removeObject when object does not exist in any state', () => {
        const {removeObject} = useEventStore.getState();
        const initialState = {...useEventStore.getState()};

        act(() => {
            removeObject('nonExistentObject');
        });

        const finalState = useEventStore.getState();
        expect(finalState).toEqual(initialState);
    });

    // Test setConfigUpdated
    test('should handle direct format updates in setConfigUpdated', () => {
        const {setConfigUpdated} = useEventStore.getState();

        const updates = [
            {name: 'service1', node: 'node1'},
            {name: 'cluster', node: 'node2'},
        ];

        act(() => {
            setConfigUpdated(updates);
        });

        const state = useEventStore.getState();
        expect(state.configUpdates).toEqual([
            {name: 'service1', fullName: 'root/svc/service1', node: 'node1'},
            {name: 'cluster', fullName: 'root/ccfg/cluster', node: 'node2'},
        ]);
    });

    test('should handle invalid JSON in setConfigUpdated', () => {
        const {setConfigUpdated} = useEventStore.getState();

        const updates = [
            'invalid-json-string',
            {name: 'service1', node: 'node1'}
        ];

        act(() => {
            setConfigUpdated(updates);
        });

        expect(logger.warn).toHaveBeenCalledWith(
            '[useEventStore] Invalid JSON in setConfigUpdated:',
            'invalid-json-string'
        );
    });

    test('should handle valid JSON string updates in setConfigUpdated', () => {
        const {setConfigUpdated} = useEventStore.getState();

        const updates = [
            '{"name":"service3","node":"node3"}',
            '{"name":"cluster","node":"node4"}'
        ];

        act(() => {
            setConfigUpdated(updates);
        });

        const state = useEventStore.getState();
        expect(state.configUpdates).toHaveLength(2);
    });

    test('should handle null updates in setConfigUpdated', () => {
        const {setConfigUpdated} = useEventStore.getState();

        act(() => {
            setConfigUpdated([null]);
        });

        const state = useEventStore.getState();
        expect(state.configUpdates).toEqual([]);
    });

    test('should handle undefined updates in setConfigUpdated', () => {
        const {setConfigUpdated} = useEventStore.getState();

        act(() => {
            setConfigUpdated([undefined]);
        });

        const state = useEventStore.getState();
        expect(state.configUpdates).toEqual([]);
    });

    test('should handle SSE format without required data field', () => {
        const {setConfigUpdated} = useEventStore.getState();

        const updates = [
            {
                kind: 'InstanceConfigUpdated',
            },
        ];

        act(() => {
            setConfigUpdated(updates);
        });

        const state = useEventStore.getState();
        expect(state.configUpdates).toEqual([]);
    });

    // Test clearConfigUpdate
    test('should clear config updates correctly', () => {
        const {setConfigUpdated, clearConfigUpdate} = useEventStore.getState();

        act(() => {
            setConfigUpdated([
                {name: 'service1', node: 'node1'},
                {name: 'service2', node: 'node2'},
                {name: 'cluster', node: 'node4'},
            ]);
        });

        expect(useEventStore.getState().configUpdates).toHaveLength(3);

        act(() => {
            clearConfigUpdate('service1');
        });

        expect(useEventStore.getState().configUpdates).toHaveLength(2);
    });

    test('should not clear config updates with invalid objectName', () => {
        const {setConfigUpdated, clearConfigUpdate} = useEventStore.getState();

        act(() => {
            setConfigUpdated([{name: 'service1', node: 'node1'}]);
        });

        act(() => {
            clearConfigUpdate(null);
        });

        expect(useEventStore.getState().configUpdates).toHaveLength(1);
    });

    // Test shallowEqual edge cases
    describe('shallowEqual edge cases', () => {
        test('should handle null and undefined', () => {
            const {setNodeStatuses} = useEventStore.getState();

            act(() => {
                setNodeStatuses(null);
            });

            expect(useEventStore.getState().nodeStatus).toBeNull();

            act(() => {
                setNodeStatuses(undefined);
            });

            expect(useEventStore.getState().nodeStatus).toBeUndefined();
        });

        test('should handle empty objects', () => {
            const {setNodeStatuses} = useEventStore.getState();

            act(() => {
                setNodeStatuses({});
            });

            const firstState = useEventStore.getState();

            act(() => {
                setNodeStatuses({});
            });

            const secondState = useEventStore.getState();
            expect(secondState.nodeStatus).toEqual(firstState.nodeStatus);
        });
    });

    // Test parseObjectPath edge cases
    describe('parseObjectPath edge cases', () => {
        test('should handle empty string', () => {
            const {clearConfigUpdate} = useEventStore.getState();

            act(() => {
                clearConfigUpdate('');
            });

            // Should not throw
            expect(true).toBe(true);
        });

        test('should handle non-string inputs', () => {
            const {clearConfigUpdate} = useEventStore.getState();

            act(() => {
                clearConfigUpdate(123);
            });

            act(() => {
                clearConfigUpdate({});
            });

            act(() => {
                clearConfigUpdate([]);
            });

            // Should not throw
            expect(true).toBe(true);
        });
    });
});
