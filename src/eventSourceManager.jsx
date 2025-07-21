import useEventStore from './hooks/useEventStore.js';
import {EventSourcePolyfill} from 'event-source-polyfill';
import {URL_NODE_EVENT} from './config/apiPath.js';

let currentEventSource = null;
const isEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Default filters when no specific filters are provided
const defaultFilters = [
    'NodeStatusUpdated',
    'NodeMonitorUpdated',
    'NodeStatsUpdated',
    'DaemonHeartbeatUpdated',
    'ObjectStatusUpdated',
    'InstanceStatusUpdated',
    'ObjectDeleted',
    'InstanceMonitorUpdated',
    'InstanceConfigUpdated',
];

// Filters for specific objectName
const objectSpecificFilters = [
    'ObjectStatusUpdated',
    'InstanceStatusUpdated',
    'ObjectDeleted',
    'InstanceMonitorUpdated',
    'InstanceConfigUpdated',
];

// Create query string for EventSource URL
function createQueryString(filters = defaultFilters, objectName = null) {
    let queryFilters = filters;
    if (objectName) {
        queryFilters = objectSpecificFilters.map((filter) => `${filter},path=${encodeURIComponent(objectName)}`);
    }
    return `cache=true&${queryFilters.map((filter) => `filter=${encodeURIComponent(filter)}`).join('&')}`;
}

export const createEventSource = (url, token) => {
    if (!token) {
        console.error('❌ Missing token for EventSource!');
        return null;
    }

    if (currentEventSource) {
        console.log('Closing existing EventSource');
        currentEventSource.close();
    }

    const {
        setObjectStatuses,
        setInstanceStatuses,
        setNodeStatuses,
        setNodeMonitors,
        setNodeStats,
        setHeartbeatStatuses,
        setInstanceMonitors,
        setInstanceConfig,
        removeObject,
        setConfigUpdated,
    } = useEventStore.getState();

    // Buffers for batching SSE updates
    let objectStatusBuffer = {};
    let instanceStatusBuffer = {};
    let nodeStatusBuffer = {};
    let nodeMonitorBuffer = {};
    let nodeStatsBuffer = {};
    let heartbeatStatusBuffer = {};
    let instanceMonitorBuffer = {};
    let instanceConfigBuffer = {};
    let configUpdatedBuffer = new Set();
    let flushTimeout = null;

    const scheduleFlush = () => {
        if (!flushTimeout) {
            flushTimeout = setTimeout(flushBuffers, 250);
        }
    };

    const flushBuffers = () => {
        const store = useEventStore.getState();

        if (Object.keys(objectStatusBuffer).length > 0) {
            const merged = {...store.objectStatus, ...objectStatusBuffer};
            setObjectStatuses(merged);
            objectStatusBuffer = {};
        }

        if (Object.keys(instanceStatusBuffer).length > 0) {
            console.log('[eventSourceManager] Flushing instanceStatusBuffer:', instanceStatusBuffer);
            setInstanceStatuses(instanceStatusBuffer);
            instanceStatusBuffer = {};
        }

        if (Object.keys(nodeStatusBuffer).length > 0) {
            const merged = {...store.nodeStatus, ...nodeStatusBuffer};
            setNodeStatuses(merged);
            nodeStatusBuffer = {};
        }

        if (Object.keys(nodeMonitorBuffer).length > 0) {
            const merged = {...store.nodeMonitor, ...nodeMonitorBuffer};
            setNodeMonitors(merged);
            nodeMonitorBuffer = {};
        }

        if (Object.keys(nodeStatsBuffer).length > 0) {
            const merged = {...store.nodeStats, ...nodeStatsBuffer};
            setNodeStats(merged);
            nodeStatsBuffer = {};
        }

        if (Object.keys(heartbeatStatusBuffer).length > 0) {
            console.log('buffer:', heartbeatStatusBuffer);
            const merged = {...store.heartbeatStatus, ...heartbeatStatusBuffer};
            setHeartbeatStatuses(merged);
            heartbeatStatusBuffer = {};
        }

        if (Object.keys(instanceMonitorBuffer).length > 0) {
            const merged = {...store.instanceMonitor, ...instanceMonitorBuffer};
            setInstanceMonitors(merged);
            instanceMonitorBuffer = {};
        }

        if (Object.keys(instanceConfigBuffer).length > 0) {
            const merged = {...store.instanceConfig, ...instanceConfigBuffer};
            setInstanceConfig(merged);
            instanceConfigBuffer = {};
        }

        if (configUpdatedBuffer.size > 0) {
            setConfigUpdated([...configUpdatedBuffer]);
            configUpdatedBuffer.clear();
        }

        flushTimeout = null;
    };

    console.log('🔗 Creating EventSource with URL:', url);

    currentEventSource = new EventSourcePolyfill(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'text/event-stream',
        },
    });

    currentEventSource.onopen = () => {
        console.log('✅ SSE connection established! URL:', url, 'readyState:', currentEventSource.readyState);
    };

    currentEventSource.onerror = (error) => {
        console.error('🚨 EventSource error:', error, 'URL:', url, 'readyState:', currentEventSource.readyState);
        currentEventSource.close();
        setTimeout(() => {
            console.log('🔄 Attempting to reconnect...');
            createEventSource(url, token);
        }, 5000);
    };

    currentEventSource.addEventListener('NodeStatusUpdated', (event) => {
        const {node, node_status} = JSON.parse(event.data);
        const current = useEventStore.getState().nodeStatus[node];
        if (!isEqual(current, node_status)) {
            nodeStatusBuffer[node] = node_status;
            scheduleFlush();
        }
    });

    currentEventSource.addEventListener('NodeMonitorUpdated', (event) => {
        const {node, node_monitor} = JSON.parse(event.data);
        const current = useEventStore.getState().nodeMonitor[node];
        if (!isEqual(current, node_monitor)) {
            nodeMonitorBuffer[node] = node_monitor;
            scheduleFlush();
        }
    });

    currentEventSource.addEventListener('NodeStatsUpdated', (event) => {
        const {node, node_stats} = JSON.parse(event.data);
        const current = useEventStore.getState().nodeStats[node];
        if (!isEqual(current, node_stats)) {
            nodeStatsBuffer[node] = node_stats;
            scheduleFlush();
        }
    });

    currentEventSource.addEventListener('ObjectStatusUpdated', (event) => {
        const parsed = JSON.parse(event.data);
        const name = parsed.path || parsed.labels?.path;
        const status = parsed.object_status;
        if (!name || !status) return;

        const current = useEventStore.getState().objectStatus[name];
        if (!isEqual(current, status)) {
            objectStatusBuffer[name] = status;
            scheduleFlush();
        }
    });

    currentEventSource.addEventListener('InstanceStatusUpdated', (event) => {
        const parsed = JSON.parse(event.data);
        console.log("[eventSourceManager] InstanceStatusUpdated event:", parsed);
        console.log("[eventSourceManager] instStatus.encap:", parsed.instance_status?.encap);
        const name = parsed.path || parsed.labels?.path;
        const node = parsed.node;
        const instStatus = parsed.instance_status;
        if (!name || !node || !instStatus) {
            console.error("[eventSourceManager] Invalid InstanceStatusUpdated event:", parsed);
            return;
        }

        const current = useEventStore.getState().objectInstanceStatus?.[name]?.[node];
        if (!isEqual(current?.instance_status, instStatus)) {
            console.log("[eventSourceManager] Updating instanceStatusBuffer for:", {name, node});
            console.log("[eventSourceManager] instStatus:", instStatus);
            instanceStatusBuffer[name] = {
                ...(instanceStatusBuffer[name] || {}),
                [node]: instStatus,
            };
            scheduleFlush();
        }
    });

    currentEventSource.addEventListener('DaemonHeartbeatUpdated', (event) => {
        const parsed = JSON.parse(event.data);
        const node = parsed.node || parsed.labels?.node;
        const status = parsed.heartbeat;
        if (!node || status === undefined) return;

        const current = useEventStore.getState().heartbeatStatus[node];
        if (!isEqual(current, status)) {
            heartbeatStatusBuffer[node] = status;
            scheduleFlush();
        }
    });

    currentEventSource.addEventListener('ObjectDeleted', (event) => {
        console.log('📩 Received ObjectDeleted event:', event.data);
        const parsed = JSON.parse(event.data);
        const name = parsed.path || parsed.labels?.path;
        if (!name) {
            console.warn('⚠️ ObjectDeleted event missing objectName:', parsed);
            return;
        }
        delete objectStatusBuffer[name];
        delete instanceStatusBuffer[name];
        removeObject(name);
        scheduleFlush();
    });

    currentEventSource.addEventListener('InstanceMonitorUpdated', (event) => {
        const parsed = JSON.parse(event.data);
        const {node, path, instance_monitor} = parsed;
        if (!node || !path || !instance_monitor) return;

        const key = `${node}:${path}`;
        const current = useEventStore.getState().instanceMonitor[key];
        if (!isEqual(current, instance_monitor)) {
            instanceMonitorBuffer[key] = instance_monitor;
            scheduleFlush();
        }
    });

    currentEventSource.addEventListener('InstanceConfigUpdated', (event) => {
        const parsed = JSON.parse(event.data);
        console.log("[eventSourceManager] InstanceConfigUpdated event:", parsed);
        const name = parsed.path || parsed.labels?.path;
        const node = parsed.node;
        const instConfig = parsed.instance_config;
        if (!name || !node) {
            console.warn('⚠️ InstanceConfigUpdated event missing name or node:', parsed);
            return;
        }
        configUpdatedBuffer.add(JSON.stringify({name, node}));
        if (instConfig) {
            instanceConfigBuffer[name] = {
                ...(instanceConfigBuffer[name] || {}),
                [node]: instConfig,
            };
        }
        scheduleFlush();
    });

    return currentEventSource;
};

export const closeEventSource = () => {
    if (currentEventSource) {
        console.log('Closing current EventSource');
        currentEventSource.close();
        currentEventSource = null;
    }
};

export const configureEventSource = (token, objectName = null, filters = defaultFilters) => {
    if (!token) {
        console.error('❌ No token provided for SSE!');
        return;
    }

    const queryString = createQueryString(filters, objectName);
    const url = `${URL_NODE_EVENT}?${queryString}`;

    if (currentEventSource) {
        closeEventSource();
    }

    currentEventSource = createEventSource(url, token);
};

export const startEventReception = (token, filters = defaultFilters) => {
    if (!token) {
        console.error('❌ No token provided for SSE!');
        return;
    }
    configureEventSource(token, null, filters);
};
