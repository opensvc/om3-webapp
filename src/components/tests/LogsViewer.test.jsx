import React from 'react';
import {render, screen, fireEvent, waitFor, act} from '@testing-library/react';
import '@testing-library/jest-dom';
import LogsViewer from '../LogsViewer';

// Mock MUI's useTheme
jest.mock('@mui/material', () => ({
    ...jest.requireActual('@mui/material'),
    useTheme: () => ({
        palette: {
            background: {paper: '#fff', default: '#f5f5f5'},
            grey: {100: '#f5f5f5'},
            divider: '#e0e0e0',
            text: {primary: '#000', secondary: '#666'},
            error: {main: '#f44336'},
            warning: {main: '#ff9800'},
            info: {main: '#2196f3'},
            action: {hover: '#f0f0f0', selected: '#e0e0e0'},
        },
    }),
}));

// Mock DarkModeContext
jest.mock('../../context/DarkModeContext', () => ({
    useDarkMode: () => ({
        isDarkMode: false,
        toggleDarkMode: jest.fn(),
    }),
}));

jest.mock('../../config/apiPath.js', () => ({
    URL_NODE: 'http://mock-api',
}));

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn().mockReturnValue('mock-token'),
};
Object.defineProperty(window, 'localStorage', {value: mockLocalStorage});


const mockBlob = jest.fn();
global.Blob = mockBlob;

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = jest.fn().mockReturnValue('blob-url');
const mockRevokeObjectURL = jest.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

// Mock ReadableStream
class MockReadableStream {
    constructor(chunks) {
        this.chunks = chunks || [];
        this.cancelled = false;
    }

    getReader() {
        let index = 0;
        const chunks = this.chunks;
        const stream = this;

        return {
            read: async () => {
                if (stream.cancelled) {
                    return {done: true};
                }
                if (index < chunks.length) {
                    const chunk = chunks[index++];
                    return {
                        value: new TextEncoder().encode(chunk),
                        done: false,
                    };
                }
                return {done: true};
            },
            releaseLock: jest.fn(),
            cancel: jest.fn(() => {
                stream.cancelled = true;
                return Promise.resolve();
            }),
        };
    }

    cancel() {
        this.cancelled = true;
        return Promise.resolve();
    }
}

// Helper functions
const mockSuccessfulFetch = (logData = []) => {
    const streamChunks = logData.map((log) => `data: ${JSON.stringify(log)}\n\n`);
    global.fetch = jest.fn().mockImplementation(() =>
        Promise.resolve({
            ok: true,
            status: 200,
            body: new MockReadableStream(streamChunks),
        })
    );
};

const mockErrorFetch = (status = 401, message = 'Unauthorized') => {
    global.fetch = jest.fn().mockImplementation(() =>
        Promise.reject(new Error(message))
    );
};

const mockHttpErrorFetch = (status = 401) => {
    global.fetch = jest.fn().mockImplementation(() =>
        Promise.resolve({
            ok: false,
            status,
        })
    );
};

// Helper to find text in the entire container
const findTextInContainer = (container, text) => {
    return container.textContent.includes(text);
};

// Helper to wait for specific text to appear
const waitForText = async (text, options = {}) => {
    const {timeout = 5000, container = document.body} = options;
    await waitFor(
        () => {
            const hasText = findTextInContainer(container, text);
            if (!hasText) {
                throw new Error(`Text "${text}" not found`);
            }
        },
        {timeout}
    );
};

// Helper to check if text is not present
const waitForTextToDisappear = async (text, options = {}) => {
    const {timeout = 5000, container = document.body} = options;
    await waitFor(
        () => {
            const hasText = findTextInContainer(container, text);
            if (hasText) {
                throw new Error(`Text "${text}" is still present`);
            }
        },
        {timeout}
    );
};

describe('LogsViewer Component', () => {
    beforeAll(() => {
        HTMLElement.prototype.scrollIntoView = jest.fn();
        jest.useFakeTimers();
    });

    afterAll(() => {
        delete HTMLElement.prototype.scrollIntoView;
        jest.useRealTimers();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockLocalStorage.getItem.mockReturnValue('mock-token');
    });

    // Helper to render component
    const renderComponent = (props = {}) => {
        return render(<LogsViewer nodename="test-node" {...props} />);
    };

    test('renders subtitle for node type', () => {
        mockSuccessfulFetch([]);
        renderComponent();
        expect(screen.getByText('test-node', {exact: false})).toBeInTheDocument();
    });

    test('renders subtitle for instance type', () => {
        mockSuccessfulFetch([]);
        renderComponent({
            type: 'instance',
            instanceName: 'test-instance',
            namespace: 'test-ns',
            kind: 'test-kind',
        });
        expect(screen.getByText('test-instance', {exact: false})).toBeInTheDocument();
        expect(screen.getByText('test-node', {exact: false})).toBeInTheDocument();
    });

    test('shows error if instanceName missing for instance type', () => {
        mockSuccessfulFetch([]);
        renderComponent({
            type: 'instance',
            instanceName: '',
        });
        expect(screen.getByText('Instance name is required', {exact: false})).toBeInTheDocument();
    });

    test('fetches logs with correct URL for node type', async () => {
        mockSuccessfulFetch([]);
        renderComponent();

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                'http://mock-api/test-node/log?follow=true',
                expect.objectContaining({
                    method: 'GET',
                    headers: expect.objectContaining({
                        Authorization: 'Bearer mock-token',
                        Accept: 'text/event-stream',
                    }),
                })
            );
        });
    });

    test('fetches logs with correct URL for instance type', async () => {
        mockSuccessfulFetch([]);
        renderComponent({
            type: 'instance',
            instanceName: 'test-instance',
            namespace: 'test-ns',
            kind: 'test-kind',
        });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                'http://mock-api/test-node/instance/path/test-ns/test-kind/test-instance/log?follow=true',
                expect.objectContaining({
                    method: 'GET',
                    headers: expect.objectContaining({
                        Authorization: 'Bearer mock-token',
                        Accept: 'text/event-stream',
                    }),
                })
            );
        });
    });

    test('pauses and resumes log streaming', async () => {
        mockSuccessfulFetch([]);
        renderComponent();

        await waitFor(() => {
            const buttons = screen.getAllByRole('button');
            const hasPause = buttons.some((btn) => btn.getAttribute('aria-label')?.includes('Pause'));
            expect(hasPause).toBe(true);
        });

        await act(async () => {
            const pauseButton = screen.getAllByRole('button').find((btn) =>
                btn.getAttribute('aria-label')?.includes('Pause')
            );
            if (pauseButton) fireEvent.click(pauseButton);
        });

        await waitFor(() => {
            const buttons = screen.getAllByRole('button');
            const hasResume = buttons.some((btn) => btn.getAttribute('aria-label')?.includes('Resume'));
            expect(hasResume).toBe(true);
        });

        await act(async () => {
            const resumeButton = screen.getAllByRole('button').find((btn) =>
                btn.getAttribute('aria-label')?.includes('Resume')
            );
            if (resumeButton) fireEvent.click(resumeButton);
        });

        await waitFor(() => {
            const buttons = screen.getAllByRole('button');
            const hasPause = buttons.some((btn) => btn.getAttribute('aria-label')?.includes('Pause'));
            expect(hasPause).toBe(true);
        });
    });

    test('displays no logs message when empty', async () => {
        mockSuccessfulFetch([]);
        renderComponent();

        await waitForText('No logs available');
    });

    test('handles non-JSON log parsing', async () => {
        const mockLogs = [
            {__REALTIME_TIMESTAMP: Date.now() * 1000, MESSAGE: 'Non-JSON test message'},
        ];
        mockSuccessfulFetch(mockLogs);
        renderComponent();

        await waitForText('Non-JSON test message');
        await waitForText('[INFO]');
    });

    test('disables buttons when no logs', async () => {
        mockSuccessfulFetch([]);
        renderComponent();

        await waitForText('No logs available');

        const clearButton = screen.getAllByRole('button').find((btn) =>
            btn.getAttribute('aria-label')?.includes('Clear')
        );
        expect(clearButton).toBeDisabled();

        const downloadButton = screen.getAllByRole('button').find((btn) =>
            btn.getAttribute('aria-label')?.includes('Download')
        );
        expect(downloadButton).toBeDisabled();
    });

    test('shows connected status after successful fetch', async () => {
        mockSuccessfulFetch([]);
        renderComponent();

        await waitForText('Connected');
    });

    test('handles parse error gracefully', async () => {
        const streamChunks = ['data: invalid json\n\n'];
        global.fetch = jest.fn().mockImplementation(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                body: new MockReadableStream(streamChunks),
            })
        );
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        renderComponent();

        await waitForText('No logs available');
        expect(consoleWarnSpy).toHaveBeenCalled();

        consoleWarnSpy.mockRestore();
    });

    test('deduplicates logs by timestamp', async () => {
        const ts = Date.now() * 1000;
        const mockLogs = [
            {__REALTIME_TIMESTAMP: ts, MESSAGE: 'dup'},
            {__REALTIME_TIMESTAMP: ts, MESSAGE: 'dup'},
            {__REALTIME_TIMESTAMP: ts + 1000, MESSAGE: 'unique'},
        ];
        mockSuccessfulFetch(mockLogs);
        renderComponent();

        await waitForText('unique');
        const dups = screen.getAllByText('dup', {exact: false});
        expect(dups.length).toBe(1);
    });

    test('handles JSON log parsing with all fields', async () => {
        const ts = Date.now();
        const mockLogs = [
            {
                JSON: JSON.stringify({
                    time: ts,
                    level: 'debug',
                    message: 'JSON test message',
                    method: 'GET',
                    path: '/api/test',
                    node: 'test-node',
                    request_uuid: 'uuid-123',
                    pkg: 'test-pkg',
                }),
                __REALTIME_TIMESTAMP: ts * 1000,
            },
        ];
        mockSuccessfulFetch(mockLogs);
        renderComponent();

        await waitForText('JSON test message');
        await waitForText('[DEBUG]');
        await waitForText('GET');
        await waitForText('/api/test');
    });

    test('clears logs correctly', async () => {
        const ts = Date.now() * 1000;
        const mockLogs = [
            {__REALTIME_TIMESTAMP: ts, MESSAGE: 'Test log'},
        ];
        mockSuccessfulFetch(mockLogs);
        renderComponent();

        await waitForText('Test log');

        const clearButton = screen.getAllByRole('button').find((btn) =>
            btn.getAttribute('aria-label')?.includes('Clear')
        );
        fireEvent.click(clearButton);

        await waitForText('No logs available');
    });

    test('shows authentication error for 401', async () => {
        mockHttpErrorFetch(401);
        renderComponent();

        await waitForText('HTTP error! status: 401');
    });

    test('shows node not found error for 404 in node type', async () => {
        mockErrorFetch(404, '404');
        renderComponent();

        await waitForText('Node logs endpoint not found for node test-node');
    });

    test('shows instance not found error for 404 in instance type', async () => {
        mockErrorFetch(404, '404');
        renderComponent({
            type: 'instance',
            instanceName: 'test-instance',
            namespace: 'test-ns',
            kind: 'test-kind',
        });

        await waitForText('Instance logs endpoint not found for test-instance on node test-node');
    });

    test('shows general fetch error', async () => {
        mockErrorFetch(500, 'Network error');
        renderComponent();

        await waitForText('Failed to fetch logs: Network error');
    });

    test('reconnects on retry button after error', async () => {
        mockHttpErrorFetch(401);
        renderComponent();

        await waitForText('HTTP error! status: 401');

        mockSuccessfulFetch([]);

        const retryButton = screen.getByText('Retry');
        fireEvent.click(retryButton);

        await waitForText('Connected');
    });

    test('limits logs to maxLogs', async () => {
        const ts = Date.now() * 1000;
        const mockLogs = Array.from({length: 5}, (_, i) => ({
            __REALTIME_TIMESTAMP: ts + i * 1000,
            MESSAGE: `Log ${i + 1}`,
        }));
        mockSuccessfulFetch(mockLogs);
        renderComponent({maxLogs: 3});

        await waitForText('Log 3');
        await waitForText('Log 4');
        await waitForText('Log 5');
        await waitForTextToDisappear('Log 1');
        await waitForTextToDisappear('Log 2');
    });

    test('does not update logs when paused', async () => {
        const ts = Date.now() * 1000;
        const initialLogs = [{__REALTIME_TIMESTAMP: ts, MESSAGE: 'Initial log'}];
        mockSuccessfulFetch(initialLogs);
        renderComponent();

        await waitForText('Initial log');

        const pauseButton = screen.getAllByRole('button').find((btn) =>
            btn.getAttribute('aria-label')?.includes('Pause')
        );
        fireEvent.click(pauseButton);

        const additionalLogs = [{__REALTIME_TIMESTAMP: ts + 1000, MESSAGE: 'Buffered log'}];
        global.fetch = jest.fn().mockImplementationOnce(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                body: new MockReadableStream(additionalLogs.map((log) => `data: ${JSON.stringify(log)}\n\n`)),
            })
        );

        await act(async () => {
            jest.advanceTimersByTime(5000);
        });

        await waitForTextToDisappear('Buffered log');
    });

    test('shows loading indicator during fetch', async () => {
        global.fetch = jest.fn().mockImplementation(() => new Promise(() => {
        }));
        renderComponent();

        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    test('aborts fetch on pause', async () => {
        const abortSpy = jest.fn();
        global.AbortController = class {
            constructor() {
                this.signal = {};
            }

            abort() {
                abortSpy();
            }
        };

        mockSuccessfulFetch([]);
        renderComponent();

        await waitFor(() => expect(global.fetch).toHaveBeenCalled());

        const pauseButton = screen.getAllByRole('button').find((btn) =>
            btn.getAttribute('aria-label')?.includes('Pause')
        );
        fireEvent.click(pauseButton);

        expect(abortSpy).toHaveBeenCalled();
    });

    test('shows authentication token error when token is missing', async () => {
        mockLocalStorage.getItem.mockReturnValue(null);
        renderComponent();

        await waitForText('Authentication token not found');
    });

    test('handles missing token error', async () => {
        mockLocalStorage.getItem.mockReturnValue(null);
        mockSuccessfulFetch([]);
        renderComponent();
        await waitForText('Authentication token not found');
    });

    test('AbortError handling in fetchLogs', async () => {
        const abortErr = new Error('Aborted');
        abortErr.name = 'AbortError';
        global.fetch = jest.fn().mockRejectedValue(abortErr);
        renderComponent();
        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    });

    test('shows 404 error messages properly', async () => {
        mockErrorFetch(404, '404');
        renderComponent();
        await waitForText('Node logs endpoint not found for node test-node');

        mockErrorFetch(404, '404');
        renderComponent({
            type: 'instance',
            instanceName: 'instX',
            namespace: 'ns',
            kind: 'kind',
        });
        await waitForText('Instance logs endpoint not found for instX on node test-node');
    });

    test('handles getLevelColor variations', async () => {
        const ts = Date.now();
        const logs = [
            {__REALTIME_TIMESTAMP: ts * 1000, JSON: JSON.stringify({level: 'error', message: 'err'})},
            {__REALTIME_TIMESTAMP: ts * 1000 + 1, JSON: JSON.stringify({level: 'warn', message: 'warn'})},
            {__REALTIME_TIMESTAMP: ts * 1000 + 2, JSON: JSON.stringify({level: 'debug', message: 'dbg'})},
            {__REALTIME_TIMESTAMP: ts * 1000 + 3, JSON: JSON.stringify({level: 'other', message: 'other'})},
        ];
        mockSuccessfulFetch(logs);
        renderComponent();
        await waitForText('err');
        await waitForText('warn');
        await waitForText('dbg');
        await waitForText('other');
    });

    test('handleDownload creates blob and triggers download', async () => {
        const ts = Date.now() * 1000;
        const mockLogs = [{__REALTIME_TIMESTAMP: ts, MESSAGE: 'Download test'}];
        mockSuccessfulFetch(mockLogs);
        renderComponent();
        await waitForText('Download test');
        const downloadButton = screen.getAllByRole('button').find((btn) =>
            btn.getAttribute('aria-label')?.includes('Download')
        );
        fireEvent.click(downloadButton);
        expect(mockCreateObjectURL).toHaveBeenCalled();
    });

    test('filters logs by search term', async () => {
        const ts = Date.now() * 1000;
        const mockLogs = [
            {__REALTIME_TIMESTAMP: ts, MESSAGE: 'Test log with keyword'},
            {__REALTIME_TIMESTAMP: ts + 1000, MESSAGE: 'Another log'},
        ];
        mockSuccessfulFetch(mockLogs);
        renderComponent();

        await waitForText('Test log with keyword');
        await waitForText('Another log');

        const searchInput = screen.getByPlaceholderText('Search logs...');
        fireEvent.change(searchInput, {target: {value: 'keyword'}});

        await waitForText('Test log with keyword');
        await waitForTextToDisappear('Another log');
        expect(screen.getByText('Filters active', {exact: false})).toBeInTheDocument();
    });

    test('filters logs by level', async () => {
        const ts = Date.now();
        const mockLogs = [
            {
                __REALTIME_TIMESTAMP: ts * 1000,
                JSON: JSON.stringify({level: 'debug', message: 'Debug log'}),
            },
            {
                __REALTIME_TIMESTAMP: ts * 1000 + 1,
                JSON: JSON.stringify({level: 'error', message: 'Error log'}),
            },
        ];
        mockSuccessfulFetch(mockLogs);
        renderComponent();

        await waitForText('Debug log');
        await waitForText('Error log');

        const selectInput = screen.getByLabelText('Select Log Levels');
        fireEvent.mouseDown(selectInput);
        const debugOption = screen.getByText('Debug');
        fireEvent.click(debugOption);

        await waitForText('Debug log');
        await waitForTextToDisappear('Error log');
        expect(screen.getByText('Filters active', {exact: false})).toBeInTheDocument();
    });

    test('clears filters on log click when filtered', async () => {
        const ts = Date.now();
        const mockLogs = [
            {
                __REALTIME_TIMESTAMP: ts * 1000,
                JSON: JSON.stringify({level: 'debug', message: 'Debug log'}),
            },
            {
                __REALTIME_TIMESTAMP: ts * 1000 + 1,
                JSON: JSON.stringify({level: 'error', message: 'Error log'}),
            },
        ];
        mockSuccessfulFetch(mockLogs);
        renderComponent();

        await waitForText('Debug log');
        await waitForText('Error log');

        const selectInput = screen.getByLabelText('Select Log Levels');
        fireEvent.mouseDown(selectInput);
        const debugOption = screen.getByText('Debug');
        fireEvent.click(debugOption);

        await waitForText('Debug log');
        await waitForTextToDisappear('Error log');

        const logLine = screen.getByText('Debug log');
        fireEvent.click(logLine);

        await waitForText('Error log');
        expect(screen.queryByText('Filters active', {exact: false})).not.toBeInTheDocument();
    });

    test('highlights selected log and scrolls to it', async () => {
        const ts = Date.now() * 1000;
        const mockLogs = Array.from({length: 10}, (_, i) => ({
            __REALTIME_TIMESTAMP: ts + i * 1000,
            MESSAGE: `Log ${i + 1}`,
        }));
        mockSuccessfulFetch(mockLogs);
        renderComponent();

        await waitForText('Log 10');

        const searchInput = screen.getByPlaceholderText('Search logs...');
        fireEvent.change(searchInput, {target: {value: 'Log 5'}});

        await waitForText('Log 5');
        await waitForTextToDisappear('Log 10');

        const logLine = screen.getByText('Log 5');
        fireEvent.click(logLine);

        await waitForText('Log 10');

        const logElements = screen.getAllByText(/Log \d+/);
        const log5Element = logElements.find(element => element.textContent === 'Log 5');
        expect(log5Element).toBeInTheDocument();
    });

    test('handles empty log message', async () => {
        const ts = Date.now() * 1000;
        const mockLogs = [
            {__REALTIME_TIMESTAMP: ts, MESSAGE: ''},
        ];
        mockSuccessfulFetch(mockLogs);
        renderComponent();

        await waitForText('[INFO]');
    });

    test('handles malformed JSON in parseLogMessage', async () => {
        const ts = Date.now() * 1000;
        const mockLogs = [
            {__REALTIME_TIMESTAMP: ts, JSON: '{malformed'},
        ];
        mockSuccessfulFetch(mockLogs);
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        renderComponent();

        await waitForText('{malformed');
        expect(consoleWarnSpy).toHaveBeenCalled();
        consoleWarnSpy.mockRestore();
    });

    test('buildDownloadFilename generates correct filename', async () => {
        mockSuccessfulFetch([]);
        renderComponent({type: 'instance', instanceName: 'test-instance'});

        const downloadButton = screen.getAllByRole('button').find((btn) =>
            btn.getAttribute('aria-label')?.includes('Download')
        );
        expect(downloadButton).toBeDisabled();
    });

    test('renders log count correctly', async () => {
        const ts = Date.now() * 1000;
        const mockLogs = [
            {__REALTIME_TIMESTAMP: ts, MESSAGE: 'Log 1'},
            {__REALTIME_TIMESTAMP: ts + 1000, MESSAGE: 'Log 2'},
        ];
        mockSuccessfulFetch(mockLogs);
        renderComponent();

        await waitForText('2 / 2 logs');
    });

    test('renders filtered log count', async () => {
        const ts = Date.now() * 1000;
        const mockLogs = [
            {__REALTIME_TIMESTAMP: ts, JSON: JSON.stringify({level: 'debug', message: 'Debug log'})},
            {__REALTIME_TIMESTAMP: ts + 1000, JSON: JSON.stringify({level: 'error', message: 'Error log'})},
        ];
        mockSuccessfulFetch(mockLogs);
        renderComponent();

        await waitForText('2 / 2 logs');

        const selectInput = screen.getByLabelText('Select Log Levels');
        fireEvent.mouseDown(selectInput);
        const debugOption = screen.getByText('Debug');
        fireEvent.click(debugOption);

        await waitForText('1 / 2 logs');
    });

    test('MockReadableStream reads chunks correctly', async () => {
        const chunks = ['data: {"message":"chunk1"}\n\n', 'data: {"message":"chunk2"}\n\n'];
        const stream = new MockReadableStream(chunks);
        const reader = stream.getReader();

        const {value: value1, done: done1} = await reader.read();
        expect(done1).toBe(false);
        expect(new TextDecoder().decode(value1)).toBe(chunks[0]);

        const {value: value2, done: done2} = await reader.read();
        expect(done2).toBe(false);
        expect(new TextDecoder().decode(value2)).toBe(chunks[1]);

        const {done: done3} = await reader.read();
        expect(done3).toBe(true);
    });

    test('MockReadableStream cancels correctly', async () => {
        const chunks = ['data: {"message":"chunk1"}\n\n', 'data: {"message":"chunk2"}\n\n'];
        const stream = new MockReadableStream(chunks);
        const reader = stream.getReader();

        const {value: value1, done: done1} = await reader.read();
        expect(done1).toBe(false);
        expect(new TextDecoder().decode(value1)).toBe(chunks[0]);

        await reader.cancel();

        const {done: done2} = await reader.read();
        expect(done2).toBe(true);
    });

    test('MockReadableStream stream-level cancel works', async () => {
        const chunks = ['data: {"message":"chunk1"}\n\n', 'data: {"message":"chunk2"}\n\n'];
        const stream = new MockReadableStream(chunks);
        const reader = stream.getReader();

        const {value: value1, done: done1} = await reader.read();
        expect(done1).toBe(false);
        expect(new TextDecoder().decode(value1)).toBe(chunks[0]);

        await stream.cancel();

        const {done: done2} = await reader.read();
        expect(done2).toBe(true);
    });
});
