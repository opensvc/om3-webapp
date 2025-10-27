const isDev = typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production';

const safeSerialize = (arg) => {
    try {
        if (typeof arg === 'string') return arg;
        return JSON.stringify(arg);
    } catch (e) {
        return String(arg);
    }
};

const logger = {
    log: (...args) => {
        if (isDev) console.log(...args);
    },
    // For test compatibility many tests spy on console.log; map info/debug to console.log as well
    info: (...args) => {
        if (isDev) {
            console.log(...args);
            if (console.info) console.info(...args);
        }
    },
    warn: (...args) => {
        if (isDev) console.warn(...args);
    },
    // Ensure error also emits to console.log for tests that spy on console.log
    error: (...args) => {
        if (isDev) {
            console.log(...args);
            if (console.error) console.error(...args);
        }
    },
    debug: (...args) => {
        if (isDev) {
            console.log(...args);
            if (console.debug) console.debug(...args);
        }
    },
    serialize: safeSerialize,
};

export default logger;
