// useEventLogStore.test.js
import { act } from '@testing-library/react';
import useEventLogStore from '../useEventLogStore'; // Ajustez le chemin d'import

// Mock de Date pour contrôler les timestamps
beforeAll(() => {
    global.Date = class extends Date {
        constructor() {
            super('2023-01-01T00:00:00.000Z');
        }
    };
});

describe('useEventLogStore', () => {
    beforeEach(() => {
        // Réinitialise le store avant chaque test
        act(() => {
            useEventLogStore.getState().clearLogs();
            useEventLogStore.getState().setPaused(false);
        });
    });

    test('devrait avoir un état initial correct', () => {
        const state = useEventLogStore.getState();
        expect(state.eventLogs).toEqual([]);
        expect(state.maxLogs).toBe(500);
        expect(state.isPaused).toBe(false);
    });


    test('ne devrait pas ajouter de log quand pause est activée', () => {
        const { addEventLog, setPaused, eventLogs } = useEventLogStore.getState();

        act(() => {
            setPaused(true);
            addEventLog('TEST_EVENT', {});
        });

        expect(eventLogs).toHaveLength(0);
    });

    test('devrait vider les logs', () => {
        const { addEventLog, clearLogs, eventLogs } = useEventLogStore.getState();

        act(() => {
            addEventLog('TEST_EVENT', {});
            clearLogs();
        });

        expect(eventLogs).toHaveLength(0);
    });

    test('devrait calculer les statistiques des événements', () => {
        const { addEventLog, getEventStats } = useEventLogStore.getState();

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