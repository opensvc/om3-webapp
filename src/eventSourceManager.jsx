import useEventStore from './hooks/useEventStore.js';
import useEventLogStore from './hooks/useEventLogStore.js';
import {EventSourcePolyfill} from 'event-source-polyfill';
import {URL_NODE_EVENT} from './config/apiPath.js';
import logger from './utils/logger.js';
import {cleanup} from "@testing-library/react";

// Constants for event names
const EVENT_TYPES = {
    NODE_STATUS_UPDATED: 'NodeStatusUpdated',
    NODE_MONITOR_UPDATED: 'NodeMonitorUpdated',
    NODE_STATS_UPDATED: 'NodeStatsUpdated',
    DAEMON_HEARTBEAT_UPDATED: 'DaemonHeartbeatUpdated',
    OBJECT_STATUS_UPDATED: 'ObjectStatusUpdated',
    INSTANCE_STATUS_UPDATED: 'InstanceStatusUpdated',
    OBJECT_DELETED: 'ObjectDeleted',
    INSTANCE_MONITOR_UPDATED: 'InstanceMonitorUpdated',
    INSTANCE_CONFIG_UPDATED: 'InstanceConfigUpdated',
};

// Default filters
const DEFAULT_FILTERS = Object.values(EVENT_TYPES);

// Filters for specific objectName
const OBJECT_SPECIFIC_FILTERS = [
    EVENT_TYPES.OBJECT_STATUS_UPDATED,
    EVENT_TYPES.INSTANCE_STATUS_UPDATED,
    EVENT_TYPES.OBJECT_DELETED,
    EVENT_TYPES.INSTANCE_MONITOR_UPDATED,
    EVENT_TYPES.INSTANCE_CONFIG_UPDATED,
];

let currentEventSource = null;
let currentLoggerEventSource = null;
let currentToken = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

const isEqual = (a, b) => {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    return JSON.stringify(a) === JSON.stringify(b);
};

// Create query string for EventSource URL
const createQueryString = (filters = DEFAULT_FILTERS, objectName = null) => {
    const validFilters = filters.filter(f => Object.values(EVENT_TYPES).includes(f));
    if (validFilters.length < filters.length) {
        logger.warn(`Invalid filters detected: ${filters.filter(f => !validFilters.includes(f)).join(', ')}. Using only valid ones.`);
    }
    const queryFilters = objectName
        ? OBJECT_SPECIFIC_FILTERS.map(filter => `${filter},path=${encodeURIComponent(objectName)}`)
        : validFilters;
    return `cache=true&${queryFilters.map(filter => `filter=${encodeURIComponent(filter)}`).join('&')}`;
};

// Get current token
export const getCurrentToken = () => localStorage.getItem('authToken') || currentToken;

// Centralized buffer management
const createBufferManager = () => {
    const buffers = {
        objectStatus: {},
        instanceStatus: {},
        nodeStatus: {},
        nodeMonitor: {},
        nodeStats: {},
        heartbeatStatus: {},
        instanceMonitor: {},
        instanceConfig: {},
        configUpdated: new Set(),
    };
    let flushTimeout = null;

    const scheduleFlush = () => {
        if (!flushTimeout) {
            flushTimeout = setTimeout(flushBuffers, 250);
        }
    };

    const flushBuffers = () => {
        const store = useEventStore.getState();
        const {
            setObjectStatuses,
            setInstanceStatuses,
            setNodeStatuses,
            setNodeMonitors,
            setNodeStats,
            setHeartbeatStatuses,
            setInstanceMonitors,
            setInstanceConfig,
            setConfigUpdated,
        } = store;

        if (Object.keys(buffers.objectStatus).length) {
            setObjectStatuses({...store.objectStatus, ...buffers.objectStatus});
            buffers.objectStatus = {};
        }
        if (Object.keys(buffers.instanceStatus).length) {
            const mergedInst = {...store.objectInstanceStatus};
            for (const obj of Object.keys(buffers.instanceStatus)) {
                mergedInst[obj] = {...mergedInst[obj], ...buffers.instanceStatus[obj]};
            }
            setInstanceStatuses(mergedInst);
            buffers.instanceStatus = {};
        }
        if (Object.keys(buffers.nodeStatus).length) {
            setNodeStatuses({...store.nodeStatus, ...buffers.nodeStatus});
            buffers.nodeStatus = {};
        }
        if (Object.keys(buffers.nodeMonitor).length) {
            setNodeMonitors({...store.nodeMonitor, ...buffers.nodeMonitor});
            buffers.nodeMonitor = {};
        }
        if (Object.keys(buffers.nodeStats).length) {
            setNodeStats({...store.nodeStats, ...buffers.nodeStats});
            buffers.nodeStats = {};
        }
        if (Object.keys(buffers.heartbeatStatus).length) {
            logger.debug('buffer:', buffers.heartbeatStatus);
            setHeartbeatStatuses({...store.heartbeatStatus, ...buffers.heartbeatStatus});
            buffers.heartbeatStatus = {};
        }
        if (Object.keys(buffers.instanceMonitor).length) {
            setInstanceMonitors({...store.instanceMonitor, ...buffers.instanceMonitor});
            buffers.instanceMonitor = {};
        }
        if (Object.keys(buffers.instanceConfig).length) {
            for (const path of Object.keys(buffers.instanceConfig)) {
                for (const node of Object.keys(buffers.instanceConfig[path])) {
                    setInstanceConfig(path, node, buffers.instanceConfig[path][node]);
                }
            }
            buffers.instanceConfig = {};
        }
        if (buffers.configUpdated.size) {
            setConfigUpdated([...buffers.configUpdated]);
            buffers.configUpdated.clear();
        }
        flushTimeout = null;
    };
    return {buffers, scheduleFlush};
};

// Navigation service for SPA-friendly redirects
const navigationService = {
    redirectToAuth: () => {
        window.dispatchEvent(new CustomEvent('om3:auth-redirect', {
            detail: '/auth-choice'
        }));
    }
};

export const createEventSource = (url, token) => {
    if (!token) {
        logger.error('❌ Missing token for EventSource!');
        return null;
    }

    if (currentEventSource) {
        logger.info('Closing existing EventSource');
        currentEventSource.close();
    }

    currentToken = token;
    const {buffers, scheduleFlush} = createBufferManager();
    const {removeObject} = useEventStore.getState();

    logger.info('🔗 Creating EventSource with URL:', url);
    currentEventSource = new EventSourcePolyfill(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'text/event-stream',
        },
        withCredentials: true,
    });

    currentEventSource.onopen = () => {
        logger.info('✅ EventSource connection established');
        reconnectAttempts = 0;
    };

    currentEventSource.onerror = (error) => {
        logger.error('🚨 EventSource error:', error, 'URL:', url, 'readyState:', currentEventSource?.readyState);

        if (error.status === 401) {
            logger.warn('🔐 Authentication error detected');
            const newToken = localStorage.getItem('authToken');
            if (newToken && newToken !== token) {
                logger.info('🔄 New token available, updating EventSource');
                updateEventSourceToken(newToken);
                return;
            }
            if (window.oidcUserManager) {
                logger.info('🔄 Attempting silent token renewal...');
                window.oidcUserManager.signinSilent()
                    .then(user => {
                        const refreshedToken = user.access_token;
                        localStorage.setItem('authToken', refreshedToken);
                        localStorage.setItem('tokenExpiration', user.expires_at.toString());
                        updateEventSourceToken(refreshedToken);
                    })
                    .catch(silentError => {
                        logger.error('❌ Silent renew failed:', silentError);
                        navigationService.redirectToAuth();
                    });
                return;
            }
        }

        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts) + Math.random() * 100, MAX_RECONNECT_DELAY);
            logger.info(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

            setTimeout(() => {
                const currentToken = getCurrentToken();
                if (currentToken) {
                    createEventSource(url, currentToken);
                }
            }, delay);
        } else {
            logger.error('❌ Max reconnection attempts reached');
            navigationService.redirectToAuth();
        }
    };

    // Event handlers with type checking
    const addEventListener = (eventType, handler) => {
        currentEventSource.addEventListener(eventType, (event) => {
            let parsed;
            try {
                parsed = JSON.parse(event.data);
            } catch (e) {
                logger.warn(`⚠️ Invalid JSON in ${eventType} event:`, event.data);
                return;
            }
            handler(parsed);
        });
    };

    addEventListener(EVENT_TYPES.NODE_STATUS_UPDATED, ({node, node_status}) => {
        if (!node || !node_status) return;
        const current = useEventStore.getState().nodeStatus[node];
        if (!isEqual(current, node_status)) {
            buffers.nodeStatus[node] = node_status;
            scheduleFlush();
        }
    });

    addEventListener(EVENT_TYPES.NODE_MONITOR_UPDATED, ({node, node_monitor}) => {
        if (!node || !node_monitor) return;
        const current = useEventStore.getState().nodeMonitor[node];
        if (!isEqual(current, node_monitor)) {
            buffers.nodeMonitor[node] = node_monitor;
            scheduleFlush();
        }
    });

    addEventListener(EVENT_TYPES.NODE_STATS_UPDATED, ({node, node_stats}) => {
        if (!node || !node_stats) return;
        const current = useEventStore.getState().nodeStats[node];
        if (!isEqual(current, node_stats)) {
            buffers.nodeStats[node] = node_stats;
            scheduleFlush();
        }
    });

    addEventListener(EVENT_TYPES.OBJECT_STATUS_UPDATED, ({path, labels, object_status}) => {
        const name = path || labels?.path;
        if (!name || !object_status) return;
        const current = useEventStore.getState().objectStatus[name];
        if (!isEqual(current, object_status)) {
            buffers.objectStatus[name] = object_status;
            scheduleFlush();
        }
    });

    addEventListener(EVENT_TYPES.INSTANCE_STATUS_UPDATED, ({path, labels, node, instance_status}) => {
        const name = path || labels?.path;
        if (!name || !node || !instance_status) return;
        const current = useEventStore.getState().objectInstanceStatus?.[name]?.[node];
        if (!isEqual(current, instance_status)) {
            buffers.instanceStatus[name] = {...(buffers.instanceStatus[name] || {}), [node]: instance_status};
            scheduleFlush();
        }
    });

    addEventListener(EVENT_TYPES.DAEMON_HEARTBEAT_UPDATED, ({node, labels, heartbeat}) => {
        const nodeName = node || labels?.node;
        if (!nodeName || heartbeat === undefined) return;
        const current = useEventStore.getState().heartbeatStatus[nodeName];
        if (!isEqual(current, heartbeat)) {
            buffers.heartbeatStatus[nodeName] = heartbeat;
            scheduleFlush();
        }
    });

    addEventListener(EVENT_TYPES.OBJECT_DELETED, ({path, labels}) => {
        logger.debug('📩 Received ObjectDeleted event:', JSON.stringify({path, labels}));
        const name = path || labels?.path;
        if (!name) {
            logger.warn('⚠️ ObjectDeleted event missing objectName:', {path, labels});
            return;
        }
        delete buffers.objectStatus[name];
        delete buffers.instanceStatus[name];
        delete buffers.instanceConfig[name];
        removeObject(name);
        scheduleFlush();
    });

    addEventListener(EVENT_TYPES.INSTANCE_MONITOR_UPDATED, ({node, path, instance_monitor}) => {
        if (!node || !path || !instance_monitor) return;
        const key = `${node}:${path}`;
        const current = useEventStore.getState().instanceMonitor[key];
        if (!isEqual(current, instance_monitor)) {
            buffers.instanceMonitor[key] = instance_monitor;
            scheduleFlush();
        }
    });

    addEventListener(EVENT_TYPES.INSTANCE_CONFIG_UPDATED, ({path, labels, node, instance_config}) => {
        const name = path || labels?.path;
        if (!name || !node) {
            logger.warn('⚠️ InstanceConfigUpdated event missing name or node:', {path, labels, node});
            return;
        }
        if (instance_config) {
            buffers.instanceConfig[name] = {...(buffers.instanceConfig[name] || {}), [node]: instance_config};
        }
        buffers.configUpdated.add(JSON.stringify({name, node}));
        scheduleFlush();
    });

    // attach cleanup to returned object
    const returned = currentEventSource;
    returned._cleanup = cleanup;
    return returned;
};

// Create Logger EventSource (only for logging)
export const createLoggerEventSource = (url, token, filters) => {
    if (!token) {
        logger.error('❌ Missing token for Logger EventSource!');
        return null;
    }

    if (currentLoggerEventSource) {
        logger.info('Closing existing Logger EventSource');
        currentLoggerEventSource.close();
    }

    logger.info('🔗 Creating Logger EventSource with URL:', url);
    currentLoggerEventSource = new EventSourcePolyfill(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'text/event-stream',
        },
        withCredentials: true,
    });

    currentLoggerEventSource.onopen = () => {
        logger.info('✅ Logger EventSource connection established');
        reconnectAttempts = 0;
        if (filters.includes('CONNECTION_OPENED')) {
            useEventLogStore.getState().addEventLog('CONNECTION_OPENED', {
                url,
                timestamp: new Date().toISOString()
            });
        }
    };

    currentLoggerEventSource.onerror = (error) => {
        logger.error('🚨 Logger EventSource error:', error, 'URL:', url, 'readyState:', currentLoggerEventSource?.readyState);

        if (filters.includes('CONNECTION_ERROR')) {
            useEventLogStore.getState().addEventLog('CONNECTION_ERROR', {
                error: error.message,
                status: error.status,
                readyState: currentLoggerEventSource?.readyState,
                url,
                timestamp: new Date().toISOString()
            });
        }

        if (error.status === 401) {
            logger.warn('🔐 Authentication error detected in logger');
            const newToken = localStorage.getItem('authToken');
            if (newToken && newToken !== token) {
                logger.info('🔄 New token available, updating Logger EventSource');
                updateLoggerEventSourceToken(newToken);
                return;
            }
            if (window.oidcUserManager) {
                window.oidcUserManager.signinSilent()
                    .then(user => {
                        const refreshedToken = user.access_token;
                        localStorage.setItem('authToken', refreshedToken);
                        localStorage.setItem('tokenExpiration', user.expires_at.toString());
                        updateLoggerEventSourceToken(refreshedToken);
                    })
                    .catch(silentError => {
                        logger.error('❌ Silent renew failed for logger:', silentError);
                        navigationService.redirectToAuth();
                    });
                return;
            }
        }

        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts) + Math.random() * 100, MAX_RECONNECT_DELAY);
            logger.info(`🔄 Logger reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

            if (filters.includes('RECONNECTION_ATTEMPT')) {
                useEventLogStore.getState().addEventLog('RECONNECTION_ATTEMPT', {
                    attempt: reconnectAttempts,
                    maxAttempts: MAX_RECONNECT_ATTEMPTS,
                    delay,
                    timestamp: new Date().toISOString()
                });
            }

            setTimeout(() => {
                const currentToken = getCurrentToken();
                if (currentToken) {
                    createLoggerEventSource(url, currentToken, filters);
                }
            }, delay);
        } else {
            logger.error('❌ Max reconnection attempts reached for logger');
            if (filters.includes('MAX_RECONNECTIONS_REACHED')) {
                useEventLogStore.getState().addEventLog('MAX_RECONNECTIONS_REACHED', {
                    maxAttempts: MAX_RECONNECT_ATTEMPTS,
                    timestamp: new Date().toISOString()
                });
            }
            navigationService.redirectToAuth();
        }
    };

    // Event handlers for logging only
    const addEventListener = (eventType, handler) => {
        currentLoggerEventSource.addEventListener(eventType, (event) => {
            handler(event);
        });
    };

    // Add listeners only for subscribed event types
    filters.filter(f => Object.values(EVENT_TYPES).includes(f)).forEach(eventType => {
        addEventListener(eventType, (event) => {
            let parsed;
            try {
                parsed = JSON.parse(event.data);
                useEventLogStore.getState().addEventLog(eventType, {
                    ...parsed,
                    _rawEvent: event.data
                });
            } catch (e) {
                logger.warn(`⚠️ Invalid JSON in ${eventType} event for logger:`, event.data);
                useEventLogStore.getState().addEventLog(`${eventType}_PARSE_ERROR`, {
                    error: e.message,
                    rawData: event.data
                });
            }
        });
    });

    // attach cleanup
    const returned = currentLoggerEventSource;
    returned._cleanup = cleanup;
    return returned;
};

// Update EventSource token
export const updateEventSourceToken = (newToken) => {
    if (!newToken) return;
    currentToken = newToken;
    if (currentEventSource && currentEventSource.readyState !== EventSource.CLOSED) {
        logger.info('🔄 Token updated, restarting EventSource');
        const currentUrl = currentEventSource.url;
        closeEventSource();
        setTimeout(() => createEventSource(currentUrl, newToken), 100);
    }
};

// Update Logger EventSource token
export const updateLoggerEventSourceToken = (newToken) => {
    if (!newToken) return;
    if (currentLoggerEventSource && currentLoggerEventSource.readyState !== EventSource.CLOSED) {
        logger.info('🔄 Token updated, restarting Logger EventSource');
        const currentUrl = currentLoggerEventSource.url;
        closeLoggerEventSource();
        setTimeout(() => createLoggerEventSource(currentUrl, newToken), 100);
    }
};

// Close EventSource
export const closeEventSource = () => {
    if (currentEventSource) {
        logger.info('Closing current EventSource');
        if (typeof currentEventSource._cleanup === 'function') {
            try {
                currentEventSource._cleanup();
            } catch (e) {
                logger.debug('Error during eventSource cleanup', e);
            }
        }
        currentEventSource.close();
        currentEventSource = null;
        currentToken = null;
        reconnectAttempts = 0;
    }
};

// Close Logger EventSource
export const closeLoggerEventSource = () => {
    if (currentLoggerEventSource) {
        logger.info('Closing current Logger EventSource');
        if (typeof currentLoggerEventSource._cleanup === 'function') {
            try {
                currentLoggerEventSource._cleanup();
            } catch (e) {
                logger.debug('Error during logger eventSource cleanup', e);
            }
        }
        currentLoggerEventSource.close();
        currentLoggerEventSource = null;
    }
};

// Configure EventSource
export const configureEventSource = (token, objectName = null, filters = DEFAULT_FILTERS) => {
    if (!token) {
        logger.error('❌ No token provided for SSE!');
        return;
    }
    const queryString = createQueryString(filters, objectName);
    const url = `${URL_NODE_EVENT}?${queryString}`;
    closeEventSource();
    currentEventSource = createEventSource(url, token);
};

// Start Event Reception (main)
export const startEventReception = (token, filters = DEFAULT_FILTERS) => {
    if (!token) {
        logger.error('❌ No token provided for SSE!');
        return;
    }
    configureEventSource(token, null, filters);
};

// Configure Logger EventSource
export const configureLoggerEventSource = (token, objectName = null, filters = DEFAULT_FILTERS) => {
    if (!token) {
        logger.error('❌ No token provided for Logger SSE!');
        return;
    }
    const queryString = createQueryString(filters, objectName);
    const url = `${URL_NODE_EVENT}?${queryString}`;
    closeLoggerEventSource();
    currentLoggerEventSource = createLoggerEventSource(url, token, filters);
};

// Start Logger Reception
export const startLoggerReception = (token, filters = DEFAULT_FILTERS, objectName = null) => {
    if (!token) {
        logger.error('❌ No token provided for Logger SSE!');
        return;
    }
    configureLoggerEventSource(token, objectName, filters);
};

// Export navigation service for external use
export {navigationService};
