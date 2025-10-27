const isDev = (() => {
    if (typeof process !== 'undefined' && process.env) {
        return process.env.NODE_ENV !== 'production';
    }
    return true;
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

const logger = {
    log: (...args) => {
        if (isDev) console.log(...args);
    },
    info: (...args) => {
        if (isDev) {
            console.log(...args);
            if (typeof console.info !== 'undefined') console.info(...args);
        }
    },
    warn: (...args) => {
        if (isDev) console.warn(...args);
    },
    error: (...args) => {
        if (isDev) {
            console.log(...args);
            if (typeof console.error !== 'undefined') console.error(...args);
        }
    },
    debug: (...args) => {
        if (isDev) {
            console.log(...args);
            if (typeof console.debug !== 'undefined') console.debug(...args);
        }
    },
    serialize: safeSerialize,
};

export default logger;
