import {act} from '@testing-library/react';
import useEventLogStore from '../useEventLogStore';

beforeAll(() => {
    global.Date = class extends Date {
        constructor() {
            super('2023-01-01T00:00:00.000Z');
        }
    };
});

describe('useEventLogStore', () => {
    beforeEach(() => {
        act(() => {
            useEventLogStore.getState().clearLogs();
            useEventLogStore.getState().setPaused(false);
        });
    });

    test('should have correct initial state', () => {
        const state = useEventLogStore.getState();
        expect(state.eventLogs).toEqual([]);
        expect(state.maxLogs).toBe(500);
        expect(state.isPaused).toBe(false);
    });

    test('should not add log when paused', () => {
        const {addEventLog, setPaused, eventLogs} = useEventLogStore.getState();

        act(() => {
            setPaused(true);
            addEventLog('TEST_EVENT', {});
        });

        expect(eventLogs).toHaveLength(0);
    });

    test('should clear logs', () => {
        const {addEventLog, clearLogs, eventLogs} = useEventLogStore.getState();

        act(() => {
            addEventLog('TEST_EVENT', {});
            clearLogs();
        });

        expect(eventLogs).toHaveLength(0);
    });

    test('should calculate event statistics', () => {
        const {addEventLog, getEventStats} = useEventLogStore.getState();

        act(() => {
            addEventLog('TYPE_A', {});
            addEventLog('TYPE_B', {});
            addEventLog('TYPE_A', {});
            addEventLog('TYPE_C', {});
        });

        const stats = getEventStats();
        expect(stats).toEqual({
            TYPE_A: 2,
            TYPE_B: 1,
            TYPE_C: 1,
        });
    });
});