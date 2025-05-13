import {renderHook, act} from '@testing-library/react';
import useAuthInfo from '../AuthInfo';
import {URL_AUTH_INFO} from '../../config/apiPath';

jest.mock('../../config/apiPath', () => ({
    URL_AUTH_INFO: 'http://mock-api/auth-info',
}));

describe('useAuthInfo hook', () => {
    let originalFetch;
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {
    });

    beforeEach(() => {
        originalFetch = global.fetch;
        consoleLogSpy.mockClear();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    test('returns undefined initially', () => {
        global.fetch = jest.fn();
        const {result} = renderHook(() => useAuthInfo());
        expect(result.current).toBeUndefined();
    });

    test('fetches and sets authInfo on successful response', async () => {
        const mockData = {user: 'testuser', role: 'admin'};

        global.fetch = jest.fn().mockResolvedValue({
            json: jest.fn().mockResolvedValue(mockData),
        });

        const {result} = renderHook(() => useAuthInfo());

        await act(async () => {
            await Promise.resolve();
        });

        expect(result.current).toEqual(mockData);
        expect(global.fetch).toHaveBeenCalledWith(URL_AUTH_INFO);
    });

    test('keeps authInfo undefined and logs error on fetch failure', async () => {
        const error = new Error('Network error');

        global.fetch = jest.fn().mockRejectedValue(error);

        const {result} = renderHook(() => useAuthInfo());

        await act(async () => {
            await Promise.resolve();
        });

        expect(result.current).toBeUndefined();
        expect(consoleLogSpy).toHaveBeenCalledWith(error);
    });

    test('keeps authInfo undefined and logs error on JSON parsing failure', async () => {
        const error = new Error('Invalid JSON');

        global.fetch = jest.fn().mockResolvedValue({
            json: jest.fn().mockRejectedValue(error),
        });

        const {result} = renderHook(() => useAuthInfo());

        await act(async () => {
            await Promise.resolve();
        });

        expect(result.current).toBeUndefined();
        expect(consoleLogSpy).toHaveBeenCalledWith(error);
    });

    test('fetch is called only once on mount', async () => {
        const mockData = {user: 'testuser'};

        const fetchMock = jest.fn().mockResolvedValue({
            json: jest.fn().mockResolvedValue(mockData),
        });

        global.fetch = fetchMock;

        const {result, rerender} = renderHook(() => useAuthInfo());

        await act(async () => {
            await Promise.resolve();
        });

        expect(result.current).toEqual(mockData);

        rerender();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('does not update state after unmount', async () => {
        const mockData = {user: 'testuser'};

        let resolveJson;
        const jsonPromise = new Promise((res) => (resolveJson = res));

        global.fetch = jest.fn().mockResolvedValue({
            json: jest.fn(() => jsonPromise),
        });

        const {result, unmount} = renderHook(() => useAuthInfo());

        unmount();

        await act(async () => {
            resolveJson(mockData);
            await jsonPromise;
        });

        expect(result.current).toBeUndefined();
    });
});
