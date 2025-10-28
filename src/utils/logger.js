const isDev = (() => {
    if (typeof process !== 'undefined' && process.env) {
        return process.env.NODE_ENV !== 'production';
    }
    return true;
})();

const isTest = (() => {
    if (typeof process !== 'undefined' && process.env) {
        return process.env.NODE_ENV === 'test';
    }
    return false;
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

// Configuration du comportement
const LOGGER_BEHAVIOR = {
    // En mode test: double logging pour la compatibilité des tests
    // En mode dev: simple logging sans duplication
    info: isTest ? ['log', 'info'] : ['info'],
    error: isTest ? ['log', 'error'] : ['error'],
    debug: isTest ? ['log', 'debug'] : ['debug'],
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
        if (isDev) console.log(...args);
    },
    info: (...args) => {
        if (isDev) callConsoleMethod(LOGGER_BEHAVIOR.info, args);
    },
    warn: (...args) => {
        if (isDev) console.warn(...args);
    },
    error: (...args) => {
        if (isDev) callConsoleMethod(LOGGER_BEHAVIOR.error, args);
    },
    debug: (...args) => {
        if (isDev) callConsoleMethod(LOGGER_BEHAVIOR.debug, args);
    },
    serialize: safeSerialize,
};

export default logger;
