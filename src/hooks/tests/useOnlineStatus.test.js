import React from 'react';
import {render, screen, act} from '@testing-library/react';
import useOnlineStatus from '../useOnlineStatus';

const TestComponent = () => {
    const online = useOnlineStatus();
    return <div data-testid="online">{online.toString()}</div>;
};

describe('useOnlineStatus hook', () => {
    let originalNavigatorOnLine;

    beforeAll(() => {
        // Mock navigator.onLine to be controllable
        originalNavigatorOnLine = Object.getOwnPropertyDescriptor(navigator, 'onLine');
        Object.defineProperty(navigator, 'onLine', {
            value: true,
            writable: true,
            configurable: true,
        });
    });

    afterAll(() => {
        // Restore original navigator.onLine
        if (originalNavigatorOnLine) {
            Object.defineProperty(navigator, 'onLine', originalNavigatorOnLine);
        } else {
            delete navigator.onLine;
        }
    });

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        navigator.onLine = true;
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('should return true initially when navigator.onLine is true', () => {
        render(<TestComponent/>);
        expect(screen.getByTestId('online').textContent).toBe('true');
    });

    test('should return false initially when navigator.onLine is false', () => {
        navigator.onLine = false;
        render(<TestComponent/>);
        expect(screen.getByTestId('online').textContent).toBe('false');
    });

    test('should return true if navigator is undefined on mount', () => {
        const originalNavigator = global.navigator;
        delete global.navigator;

        render(<TestComponent/>);
        expect(screen.getByTestId('online').textContent).toBe('true');

        global.navigator = originalNavigator;
    });

    test('should update to true when online event is fired', () => {
        navigator.onLine = false;
        render(<TestComponent/>);
        expect(screen.getByTestId('online').textContent).toBe('false');

        act(() => {
            window.dispatchEvent(new Event('online'));
        });

        expect(screen.getByTestId('online').textContent).toBe('true');
    });

    test('should update to false when offline event is fired', () => {
        navigator.onLine = true;
        render(<TestComponent/>);
        expect(screen.getByTestId('online').textContent).toBe('true');

        act(() => {
            window.dispatchEvent(new Event('offline'));
        });

        expect(screen.getByTestId('online').textContent).toBe('false');
    });

    test('should check periodically via interval and update state', () => {
        navigator.onLine = true;
        render(<TestComponent/>);
        expect(screen.getByTestId('online').textContent).toBe('true');

        navigator.onLine = false;

        act(() => {
            jest.advanceTimersByTime(15000);
        });

        expect(screen.getByTestId('online').textContent).toBe('false');
    });

    test('should handle undefined navigator during interval check', () => {
        const originalNavigator = global.navigator;

        render(<TestComponent/>);
        expect(screen.getByTestId('online').textContent).toBe('true');

        delete global.navigator;

        act(() => {
            jest.advanceTimersByTime(15000);
        });

        expect(screen.getByTestId('online').textContent).toBe('true');

        global.navigator = originalNavigator;
    });

    test('should add and remove event listeners correctly', () => {
        const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
        const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

        const {unmount} = render(<TestComponent/>);

        expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
        expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));

        unmount();

        expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
        expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    test('should set and clear interval correctly', () => {
        const setIntervalSpy = jest.spyOn(global, 'setInterval');
        const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

        const {unmount} = render(<TestComponent/>);

        expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 15000);

        const intervalId = setIntervalSpy.mock.results[0].value;

        unmount();

        expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
    });
});
