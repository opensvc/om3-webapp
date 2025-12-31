import logger from '../logger';

describe('logger', () => {
    let originalEnv;

    beforeAll(() => {
        originalEnv = process.env.NODE_ENV;
    });

    afterAll(() => {
        process.env.NODE_ENV = originalEnv;
    });

    beforeEach(() => {
        jest.restoreAllMocks();
    });

    describe('in development mode', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'development';
        });

        test('log calls console.log with arguments', () => {
            const spy = jest.spyOn(console, 'log').mockImplementation();
            logger.log('test message', 123);
            expect(spy).toHaveBeenCalledWith('test message', 123);
        });

        test('info calls console.info with arguments', () => {
            const infoSpy = jest.spyOn(console, 'info').mockImplementation();
            logger.info('info message', {key: 'value'});
            expect(infoSpy).toHaveBeenCalledWith('info message', {key: 'value'});
        });

        test('warn calls console.warn with arguments', () => {
            const spy = jest.spyOn(console, 'warn').mockImplementation();
            logger.warn('warn message');
            expect(spy).toHaveBeenCalledWith('warn message');
        });

        test('error calls console.error with arguments', () => {
            const errorSpy = jest.spyOn(console, 'error').mockImplementation();
            const error = new Error('test error');
            logger.error('error message', error);
            expect(errorSpy).toHaveBeenCalledWith('error message', error);
        });

        test('debug calls console.debug with arguments', () => {
            const debugSpy = jest.spyOn(console, 'debug').mockImplementation();
            logger.debug('debug message');
            expect(debugSpy).toHaveBeenCalledWith('debug message');
        });

        test('info handles missing console.info', () => {
            const logSpy = jest.spyOn(console, 'log').mockImplementation();
            const originalInfo = console.info;
            console.info = undefined;

            logger.info('info message');
            expect(logSpy).toHaveBeenCalledWith('info message');

            console.info = originalInfo;
        });

        test('error handles missing console.error', () => {
            const logSpy = jest.spyOn(console, 'log').mockImplementation();
            const originalError = console.error;
            console.error = undefined;

            logger.error('error message');
            expect(logSpy).toHaveBeenCalledWith('error message');

            console.error = originalError;
        });

        test('debug handles missing console.debug', () => {
            const logSpy = jest.spyOn(console, 'log').mockImplementation();
            const originalDebug = console.debug;
            console.debug = undefined;

            // eslint-disable-next-line testing-library/no-debugging-utils
            logger.debug('debug message');
            expect(logSpy).toHaveBeenCalledWith('debug message');

            console.debug = originalDebug;
        });
    });

    describe('in production mode', () => {
        beforeEach(() => {
            jest.resetModules();
            process.env.NODE_ENV = 'production';
        });

        afterEach(() => {
            jest.resetModules();
        });

        test('log does not call console.log', () => {
            const loggerProduction = require('../logger').default;
            const spy = jest.spyOn(console, 'log').mockImplementation();
            loggerProduction.log('test message');
            expect(spy).not.toHaveBeenCalled();
        });

        test('info does not call console methods', () => {
            const loggerProduction = require('../logger').default;
            const logSpy = jest.spyOn(console, 'log').mockImplementation();
            const infoSpy = jest.spyOn(console, 'info').mockImplementation();
            loggerProduction.info('info message');
            expect(logSpy).not.toHaveBeenCalled();
            expect(infoSpy).not.toHaveBeenCalled();
        });

        test('debug does not call console methods', () => {
            const loggerProduction = require('../logger').default;
            const logSpy = jest.spyOn(console, 'log').mockImplementation();
            const debugSpy = jest.spyOn(console, 'debug').mockImplementation();
            // eslint-disable-next-line testing-library/no-debugging-utils
            loggerProduction.debug('debug message');
            expect(logSpy).not.toHaveBeenCalled();
            expect(debugSpy).not.toHaveBeenCalled();
        });
    });

    describe('serialize', () => {
        test('returns string as is', () => {
            expect(logger.serialize('hello')).toBe('hello');
        });

        test('stringifies JSON-serializable values', () => {
            expect(logger.serialize({a: 1, b: 'test'})).toBe('{"a":1,"b":"test"}');
            expect(logger.serialize([1, 2, 3])).toBe('[1,2,3]');
        });

        test('handles circular references', () => {
            const circular = {};
            circular.self = circular;
            const result = logger.serialize(circular);
            expect(result).toContain('[object Object]');
        });

        test('handles non-serializable objects', () => {
            // Create an object that will throw when serialized
            const specialObj = {};
            Object.defineProperty(specialObj, 'toJSON', {
                value: () => {
                    throw new Error('Not serializable');
                },
                writable: true,
                configurable: true
            });

            const result = logger.serialize(specialObj);
            expect(result).toBe(String(specialObj));
        });


        test('handles undefined and null', () => {
            expect(logger.serialize(undefined)).toBe('undefined');
            expect(logger.serialize(null)).toBe('null');
        });
    });

    describe('environment handling', () => {
        test('works without process object', () => {
            const originalProcess = global.process;
            delete global.process;

            jest.resetModules();
            const loggerWithoutProcess = require('../logger').default;

            const spy = jest.spyOn(console, 'log').mockImplementation();
            loggerWithoutProcess.log('test');
            expect(spy).toHaveBeenCalledWith('test');

            global.process = originalProcess;
            jest.resetModules();
        });

        test('handles missing process.env', () => {
            const originalEnv = process.env;
            process.env = undefined;

            jest.resetModules();
            const loggerWithoutEnv = require('../logger').default;

            const spy = jest.spyOn(console, 'log').mockImplementation();
            loggerWithoutEnv.log('test');
            expect(spy).toHaveBeenCalledWith('test');

            process.env = originalEnv;
            jest.resetModules();
        });

        test('handles missing process.env.NODE_ENV', () => {
            const originalNodeEnv = process.env.NODE_ENV;
            delete process.env.NODE_ENV;

            jest.resetModules();
            const loggerWithoutNodeEnv = require('../logger').default;

            const spy = jest.spyOn(console, 'log').mockImplementation();
            loggerWithoutNodeEnv.log('test');
            expect(spy).toHaveBeenCalledWith('test');

            process.env.NODE_ENV = originalNodeEnv;
            jest.resetModules();
        });
    });
});
