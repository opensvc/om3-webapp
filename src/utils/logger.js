const isDev = (() => {
    try {
        if (typeof process !== 'undefined' && process.env) {
            return process.env.NODE_ENV !== 'production';
        }
        return true;
    } catch (e) {
        return true;
    }
})();

const isTest = (() => {
    try {
        if (typeof process !== 'undefined' && process.env) {
            return process.env.NODE_ENV === 'test';
        }
        return false;
    } catch (e) {
        return false;
    }
})();

const safeSerialize = (arg) => {
    try {
        if (typeof arg === 'string') return arg;
        if (arg === undefined) return 'undefined';
        if (arg === null) return 'null';
        return JSON.stringify(arg);
    } catch (e) {
        return String(arg);
    }
};

const shouldLog = isDev || isTest;

const LOGGER_BEHAVIOR = {
    log: ['log'],
    info: ['log', 'info'],
    error: ['log', 'error'],
    debug: ['log', 'debug'],
    warn: ['warn'],
};

const callConsoleMethod = (methods, args) => {
    methods.forEach(method => {
        if (typeof console[method] !== 'undefined') {
            console[method](...args);
        } else if (method !== 'log' && typeof console.log !== 'undefined') {
            // Fallback sur console.log si la méthode n'existe pas
            console.log(...args);
        }
    });
};

const logger = {
    log: (...args) => {
        if (shouldLog) callConsoleMethod(LOGGER_BEHAVIOR.log, args);
    },
    info: (...args) => {
        if (shouldLog) callConsoleMethod(LOGGER_BEHAVIOR.info, args);
    },
    warn: (...args) => {
        if (shouldLog) callConsoleMethod(LOGGER_BEHAVIOR.warn, args);
    },
    error: (...args) => {
        if (shouldLog) callConsoleMethod(LOGGER_BEHAVIOR.error, args);
    },
    debug: (...args) => {
        if (shouldLog) callConsoleMethod(LOGGER_BEHAVIOR.debug, args);
    },
    serialize: safeSerialize,
};

export default logger;
