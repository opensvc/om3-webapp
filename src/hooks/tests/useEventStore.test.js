import useEventStore from '../useEventStore.js';
import {act} from 'react';

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useParams: jest.fn(),
}));

// Mock @mui/material
jest.mock('@mui/material', () => ({
    ...jest.requireActual('@mui/material'),
    Typography: ({children, ...props}) => <span {...props}>{children}</span>,
    Box: ({children, ...props}) => <div {...props}>{children}</div>,
    CircularProgress: () => <div role="progressbar">Loading...</div>,
}));

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

    test('should set node status correctly using setNodeStatuses', () => {
        const {setNodeStatuses} = useEventStore.getState();

        act(() => {
            setNodeStatuses({node1: {status: 'up'}});
        });

        const state = useEventStore.getState();
        expect(state.nodeStatus).toEqual({node1: {status: 'up'}});
    });

    test('should set node monitors correctly using setNodeMonitors', () => {
        const {setNodeMonitors} = useEventStore.getState();

        act(() => {
            setNodeMonitors({node1: {monitor: 'active'}});
        });

        const state = useEventStore.getState();
        expect(state.nodeMonitor).toEqual({node1: {monitor: 'active'}});
    });

    test('should set node stats correctly using setNodeStats', () => {
        const {setNodeStats} = useEventStore.getState();

        act(() => {
            setNodeStats({node1: {cpu: 80, memory: 75}});
        });

        const state = useEventStore.getState();
        expect(state.nodeStats).toEqual({node1: {cpu: 80, memory: 75}});
    });

    test('should set object statuses correctly using setObjectStatuses', () => {
        const {setObjectStatuses} = useEventStore.getState();

        act(() => {
            setObjectStatuses({object1: {status: 'active'}});
        });

        const state = useEventStore.getState();
        expect(state.objectStatus).toEqual({object1: {status: 'active'}});
    });

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

    test('should preserve existing encapsulated resources in setInstanceStatuses', () => {
        const {setInstanceStatuses} = useEventStore.getState();

        // Set initial state with valid encapsulated resources
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

        // Update with empty resources
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
        expect(state.objectInstanceStatus).toEqual({
            object1: {
                node1: {
                    status: 'updated',
                    node: 'node1',
                    path: 'object1',
                    encap: {
                        container1: {
                            resources: {cpu: 100, memory: 200} // Preserved
                        }
                    }
                }
            }
        });
    });

    test('should merge new encapsulated resources in setInstanceStatuses', () => {
        const {setInstanceStatuses} = useEventStore.getState();

        // Set initial state with some resources
        act(() => {
            setInstanceStatuses({
                object1: {
                    node1: {
                        status: 'active',
                        encap: {
                            container1: {
                                resources: {cpu: 100}
                            }
                        }
                    }
                }
            });
        });

        // Update with new valid resources
        act(() => {
            setInstanceStatuses({
                object1: {
                    node1: {
                        status: 'updated',
                        encap: {
                            container1: {
                                resources: {memory: 200}
                            }
                        }
                    }
                }
            });
        });

        const state = useEventStore.getState();
        expect(state.objectInstanceStatus).toEqual({
            object1: {
                node1: {
                    status: 'updated',
                    node: 'node1',
                    path: 'object1',
                    encap: {
                        container1: {
                            resources: {memory: 200} // Updated
                        }
                    }
                }
            }
        });
    });

    test('should preserve encapsulated resources when encap not provided in setInstanceStatuses', () => {
        const {setInstanceStatuses} = useEventStore.getState();

        // Set initial state with encapsulated resources
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

        // Update without encap
        act(() => {
            setInstanceStatuses({
                object1: {
                    node1: {
                        status: 'updated'
                    }
                }
            });
        });

        const state = useEventStore.getState();
        expect(state.objectInstanceStatus).toEqual({
            object1: {
                node1: {
                    status: 'updated',
                    node: 'node1',
                    path: 'object1',
                    encap: {
                        container1: {
                            resources: {cpu: 100, memory: 200} // Preserved
                        }
                    }
                }
            }
        });
    });

    test('should drop encapsulated resources when empty encap provided in setInstanceStatuses', () => {
        const {setInstanceStatuses} = useEventStore.getState();

        // Set initial state with encapsulated resources
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

        // Update with empty encap
        act(() => {
            setInstanceStatuses({
                object1: {
                    node1: {
                        status: 'updated',
                        encap: {}
                    }
                }
            });
        });

        const state = useEventStore.getState();
        expect(state.objectInstanceStatus).toEqual({
            object1: {
                node1: {
                    status: 'updated',
                    node: 'node1',
                    path: 'object1',
                    encap: {container1: {resources: {cpu: 100, memory: 200}}}
                }
            }
        });
    });

    test('should set heartbeat statuses correctly using setHeartbeatStatuses', () => {
        const {setHeartbeatStatuses} = useEventStore.getState();

        act(() => {
            setHeartbeatStatuses({node1: {heartbeat: 'alive'}});
        });

        const state = useEventStore.getState();
        expect(state.heartbeatStatus).toEqual({node1: {heartbeat: 'alive'}});
    });

    test('should set instance monitors correctly using setInstanceMonitors', () => {
        const {setInstanceMonitors} = useEventStore.getState();

        act(() => {
            setInstanceMonitors({object1: {monitor: 'running'}});
        });

        const state = useEventStore.getState();
        expect(state.instanceMonitor).toEqual({object1: {monitor: 'running'}});
    });

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

    test('should update existing instance config in setInstanceConfig', () => {
        const {setInstanceConfig} = useEventStore.getState();

        // Set initial config
        act(() => {
            setInstanceConfig('object1', 'node1', {setting1: 'value1'});
        });

        // Update config
        act(() => {
            setInstanceConfig('object1', 'node1', {setting2: 'value2'});
        });

        const state = useEventStore.getState();
        expect(state.instanceConfig).toEqual({
            object1: {
                node1: {setting2: 'value2'}
            }
        });
    });

    test('should remove object correctly using removeObject', () => {
        const {setObjectStatuses, removeObject} = useEventStore.getState();

        // Set initial state
        act(() => {
            setObjectStatuses({object1: {status: 'active'}, object2: {status: 'inactive'}});
        });

        // Check the initial state
        let state = useEventStore.getState();
        expect(state.objectStatus).toEqual({
            object1: {status: 'active'},
            object2: {status: 'inactive'},
        });

        // Apply the removeObject action
        act(() => {
            removeObject('object1');
        });

        // Check the state after removing the object
        state = useEventStore.getState();
        expect(state.objectStatus).toEqual({object2: {status: 'inactive'}});
    });

    test('should not affect other properties when removing an object', () => {
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

        act(() => {
            setConfigUpdated([{name: 'service1', node: 'node1'}]); // Duplicate
        });

        expect(useEventStore.getState().configUpdates).toHaveLength(2); // No new entries
    });

    test('should handle SSE format updates in setConfigUpdated', () => {
        const {setConfigUpdated} = useEventStore.getState();

        const updates = [
            {
                kind: 'InstanceConfigUpdated',
                data: {path: 'service1', node: 'node1', labels: {namespace: 'ns1'}},
            },
            {
                kind: 'InstanceConfigUpdated',
                data: {path: 'cluster', node: 'node2'}, // No namespace, defaults to root
            },
        ];

        act(() => {
            setConfigUpdated(updates);
        });

        const state = useEventStore.getState();
        expect(state.configUpdates).toEqual([
            {name: 'service1', fullName: 'ns1/svc/service1', node: 'node1'},
            {name: 'cluster', fullName: 'root/ccfg/cluster', node: 'node2'},
        ]);
    });

    test('should handle invalid JSON in setConfigUpdated', () => {
        const {setConfigUpdated} = useEventStore.getState();
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });

        const updates = [
            'invalid-json-string',
            {name: 'service1', node: 'node1'}
        ];

        act(() => {
            setConfigUpdated(updates);
        });

        const state = useEventStore.getState();
        expect(state.configUpdates).toEqual([
            {name: 'service1', fullName: 'root/svc/service1', node: 'node1'}
        ]);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            '[useEventStore] Invalid JSON in setConfigUpdated:',
            'invalid-json-string'
        );

        consoleWarnSpy.mockRestore();
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
        expect(state.configUpdates).toEqual([
            {name: 'service3', fullName: 'root/svc/service3', node: 'node3'},
            {name: 'cluster', fullName: 'root/ccfg/cluster', node: 'node4'},
        ]);
    });

    test('should handle valid but incomplete JSON string in setConfigUpdated', () => {
        const {setConfigUpdated} = useEventStore.getState();

        const updates = [
            '{"name":"service4"}' // missing node
        ];

        act(() => {
            setConfigUpdated(updates);
        });

        const state = useEventStore.getState();
        expect(state.configUpdates).toEqual([]);
    });

    test('should handle invalid update format in setConfigUpdated', () => {
        const {setConfigUpdated} = useEventStore.getState();

        const updates = [
            {invalid: 'data'}, // Invalid format
            {name: 'service1', node: 'node1'}
        ];

        act(() => {
            setConfigUpdated(updates);
        });

        const state = useEventStore.getState();
        expect(state.configUpdates).toEqual([
            {name: 'service1', fullName: 'root/svc/service1', node: 'node1'}
        ]);
    });

    test('should clear config updates correctly', () => {
        const {setConfigUpdated, clearConfigUpdate} = useEventStore.getState();

        // Set initial updates
        act(() => {
            setConfigUpdated([
                {name: 'service1', node: 'node1'},
                {name: 'service2', node: 'node2'},
                {
                    kind: 'InstanceConfigUpdated',
                    data: {path: 'service3', node: 'node3', labels: {namespace: 'ns1'}},
                },
                {name: 'cluster', node: 'node4'},
            ]);
        });

        expect(useEventStore.getState().configUpdates).toHaveLength(4);

        // Clear one update with full name
        act(() => {
            clearConfigUpdate('root/svc/service1');
        });

        expect(useEventStore.getState().configUpdates).toHaveLength(3);

        // Clear using short name
        act(() => {
            clearConfigUpdate('service2');
        });

        expect(useEventStore.getState().configUpdates).toHaveLength(2);

        // Clear with namespace full name
        act(() => {
            clearConfigUpdate('ns1/svc/service3');
        });

        expect(useEventStore.getState().configUpdates).toHaveLength(1);

        // Clear cluster with short name
        act(() => {
            clearConfigUpdate('cluster');
        });

        expect(useEventStore.getState().configUpdates).toEqual([]);
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

        act(() => {
            clearConfigUpdate('');
        });

        expect(useEventStore.getState().configUpdates).toHaveLength(1);

        act(() => {
            clearConfigUpdate(123);
        });

        expect(useEventStore.getState().configUpdates).toHaveLength(1);
    });
});
