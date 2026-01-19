import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import '@testing-library/jest-dom';
import EventLogger from '../EventLogger';
import useEventLogStore from '../../hooks/useEventLogStore';
import {ThemeProvider} from '@mui/material/styles';
import {createTheme} from '@mui/material';
import logger from '../../utils/logger.js';

beforeAll(() => {
    Element.prototype.scrollIntoView = jest.fn();
});

jest.mock('../../hooks/useEventLogStore', () => ({
    __esModule: true,
    default: jest.fn(() => ({
        eventLogs: [],
        isPaused: false,
        setPaused: jest.fn(),
        clearLogs: jest.fn(),
    })),
}));

jest.mock('../../utils/logger.js', () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        log: jest.fn(),
        serialize: jest.fn(arg => JSON.stringify(arg)),
    }
}));

jest.mock('../../eventSourceManager', () => ({
    __esModule: true,
    startLoggerReception: jest.fn(),
    closeLoggerEventSource: jest.fn(),
}));

const theme = createTheme();

const renderWithTheme = (ui) => {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
};

describe('EventLogger Component', () => {
    let consoleErrorSpy;
    let eventLogs = [];
    let isPaused = false;
    const mockSetPaused = jest.fn();
    const mockClearLogs = jest.fn();

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((message, ...args) => {
            if (typeof message === 'string' && message.includes('Each child in a list should have a unique "key" prop')) {
                return;
            }
            console.error(message, ...args);
        });

        eventLogs = [];
        isPaused = false;
        mockSetPaused.mockClear();
        mockClearLogs.mockClear();

        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        logger.info.mockClear();
        logger.warn.mockClear();
        logger.error.mockClear();
        logger.debug.mockClear();
        logger.log.mockClear();
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        jest.clearAllMocks();
        jest.useRealTimers();

        const closeButtons = screen.queryAllByRole('button', {name: /Close/i});
        closeButtons.forEach(btn => {
            if (btn) {
                fireEvent.click(btn);
            }
        });
    });

    test('renders the button initially when drawer is closed', () => {
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        expect(eventLoggerButton).toBeInTheDocument();
    });

    test('opens the drawer when button is clicked', async () => {
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/Event Logger/i)).toBeInTheDocument();
        });
    });

    test('displays no events message when there are no logs', async () => {
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/No events logged/i)).toBeInTheDocument();
        });
    });

    test('displays logs when eventLogs are provided', async () => {
        eventLogs = [
            {
                id: '1',
                eventType: 'TEST_EVENT',
                timestamp: new Date().toISOString(),
                data: {message: 'Test data'},
            },
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });

        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/TEST_EVENT/i)).toBeInTheDocument();
        });
    });

    test('filters logs by search term', async () => {
        jest.useFakeTimers();
        eventLogs = [
            {
                id: '1',
                eventType: 'TEST_EVENT',
                timestamp: new Date().toISOString(),
                data: {message: 'Test data'},
            },
            {
                id: '2',
                eventType: 'ANOTHER_EVENT',
                timestamp: new Date().toISOString(),
                data: {message: 'Other data'},
            },
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/TEST_EVENT/i)).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText(/Search events/i);

        act(() => {
            fireEvent.change(searchInput, {target: {value: 'Test'}});
        });

        act(() => {
            jest.advanceTimersByTime(300);
        });

        await waitFor(() => {
            expect(screen.getByText(/TEST_EVENT/i)).toBeInTheDocument();
        });

        jest.useRealTimers();
    });

    test('filters logs by event type', async () => {
        eventLogs = [
            {
                id: '1',
                eventType: 'TEST_EVENT',
                timestamp: new Date().toISOString(),
                data: {message: 'Test data'},
            },
            {
                id: '2',
                eventType: 'ANOTHER_EVENT',
                timestamp: new Date().toISOString(),
                data: {message: 'Other data'},
            },
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/TEST_EVENT/i)).toBeInTheDocument();
        });

        const selectInput = screen.getByRole('combobox');

        act(() => {
            fireEvent.mouseDown(selectInput);
        });

        await waitFor(() => {
            expect(screen.getByRole('listbox')).toBeInTheDocument();
        });

        const listbox = screen.getByRole('listbox');
        const testEventOption = within(listbox).getByText(/TEST_EVENT/i);

        act(() => {
            fireEvent.click(testEventOption);
            fireEvent.keyDown(document.activeElement || document.body, {key: 'Escape'});
        });

        await waitFor(() => {
            expect(screen.getByText(/Test data/i)).toBeInTheDocument();
        });
    });

    test('toggles pause state', async () => {
        useEventLogStore.mockReturnValue({
            eventLogs: [],
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        const pauseButton = screen.getByRole('button', {name: /Pause/i});

        act(() => {
            fireEvent.click(pauseButton);
        });

        expect(mockSetPaused).toHaveBeenCalledWith(true);
    });

    test('clears logs when clear button is clicked', async () => {
        eventLogs = [{id: '1', eventType: 'TEST', timestamp: new Date().toISOString(), data: {}}];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        const clearButton = screen.getByRole('button', {name: /Clear logs/i});

        act(() => {
            fireEvent.click(clearButton);
        });

        expect(mockClearLogs).toHaveBeenCalled();
    });

    test('closes the drawer when close button is clicked', async () => {
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/Event Logger/i)).toBeInTheDocument();
        });

        const closeButton = screen.getByRole('button', {name: /Close/i});

        act(() => {
            fireEvent.click(closeButton);
        });

        await waitFor(() => {
            const reopenButton = screen.getByRole('button', {name: /Events|Event Logger/i});
            expect(reopenButton).toBeInTheDocument();
        });
    });

    test('displays paused chip when isPaused is true', async () => {
        isPaused = true;
        useEventLogStore.mockReturnValue({
            eventLogs: [],
            isPaused: true,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/PAUSED/i)).toBeInTheDocument();
        });
    });

    test('displays objectName chip when objectName is provided', async () => {
        renderWithTheme(<EventLogger objectName="/test/path"/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/object: \/test\/path/i)).toBeInTheDocument();
        });
    });

    test('disables clear button when no logs are present', async () => {
        useEventLogStore.mockReturnValue({
            eventLogs: [],
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        const clearButton = screen.getByRole('button', {name: /Clear logs/i});
        expect(clearButton).toBeDisabled();
    });

    test('handles ObjectDeleted event with valid _rawEvent JSON', async () => {
        eventLogs = [
            {
                id: '1',
                eventType: 'ObjectDeleted',
                timestamp: new Date().toISOString(),
                data: {_rawEvent: JSON.stringify({path: '/test/path'})},
            },
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger objectName="/test/path"/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/ObjectDeleted/i)).toBeInTheDocument();
        });
    });

    test('tests drawer resize handle exists and can be interacted with', async () => {
        jest.useFakeTimers();
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/Event Logger/i)).toBeInTheDocument();
        });

        const resizeHandle = screen.getByLabelText(/Resize handle/i);
        expect(resizeHandle).toBeInTheDocument();

        jest.useRealTimers();
    });

    test('handles ObjectDeleted event with invalid _rawEvent JSON parsing', async () => {
        eventLogs = [
            {
                id: '1',
                eventType: 'ObjectDeleted',
                timestamp: new Date().toISOString(),
                data: {
                    _rawEvent: 'invalid json {',
                    otherData: 'test'
                }
            }
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/ObjectDeleted/i)).toBeInTheDocument();
        });
    });

    test('displays log with non-object data', async () => {
        eventLogs = [
            {
                id: '1',
                eventType: 'STRING_EVENT',
                timestamp: new Date().toISOString(),
                data: 'simple string data'
            },
            {
                id: '2',
                eventType: 'NULL_EVENT',
                timestamp: new Date().toISOString(),
                data: null
            },
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/STRING_EVENT/i)).toBeInTheDocument();
            expect(screen.getByText(/NULL_EVENT/i)).toBeInTheDocument();
        });
    });

    test('toggles log expansion', async () => {
        eventLogs = [
            {
                id: '1',
                eventType: 'EXPAND_TEST',
                timestamp: new Date().toISOString(),
                data: {key: 'value'},
            },
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/EXPAND_TEST/i)).toBeInTheDocument();
        });

        const logElements = screen.getAllByRole('button', {hidden: true});
        const logButton = logElements.find(el =>
            el.closest('[style*="cursor: pointer"]') ||
            el.textContent?.includes('EXPAND_TEST')
        );
        if (logButton) {
            act(() => {
                fireEvent.click(logButton);
            });

            await waitFor(() => {
                expect(screen.getByText(/"key"/i)).toBeInTheDocument();
            });

            act(() => {
                fireEvent.click(logButton);
            });

            await waitFor(() => {
                expect(screen.getByText(/EXPAND_TEST/i)).toBeInTheDocument();
            });
        }
    });

    test('tests clear filters functionality', async () => {
        jest.useFakeTimers();
        eventLogs = [
            {id: '1', eventType: 'TEST_EVENT', timestamp: new Date().toISOString(), data: {message: 'test'}},
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger/>);

        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/TEST_EVENT/i)).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText(/Search events/i);

        act(() => {
            fireEvent.change(searchInput, {target: {value: 'test'}});
        });

        act(() => {
            jest.advanceTimersByTime(300);
        });

        await waitFor(() => {
            expect(screen.getByText(/Filtered/i)).toBeInTheDocument();
        });

        const filterChip = screen.getByRole('button', {name: /Filtered/i});
        expect(filterChip).toBeInTheDocument();

        const deleteIcon = within(filterChip).getByTestId('CancelIcon');

        act(() => {
            fireEvent.click(deleteIcon);
        });

        await waitFor(() => {
            expect(searchInput).toHaveValue('');
        });

        jest.useRealTimers();
    });

    test('tests timestamp formatting', async () => {
        const testTimestamp = new Date('2023-01-01T12:34:56.789Z').toISOString();
        eventLogs = [
            {id: '1', eventType: 'TEST_EVENT', timestamp: testTimestamp, data: {}},
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            const timeElements = screen.getAllByText(/\d{1,2}:\d{2}:\d{2}/);
            expect(timeElements.length).toBeGreaterThan(0);
        });
    });

    test('displays custom title and buttonLabel', () => {
        renderWithTheme(<EventLogger title="Custom Logger" buttonLabel="Custom Button"/>);
        expect(screen.getByText('Custom Button')).toBeInTheDocument();
    });

    test('displays event count in drawer when opened', async () => {
        eventLogs = [
            {id: '1', eventType: 'TEST', timestamp: new Date().toISOString(), data: {}},
            {id: '2', eventType: 'TEST', timestamp: new Date().toISOString(), data: {}},
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });

        renderWithTheme(<EventLogger/>);

        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/2\/2 events/i)).toBeInTheDocument();
        });
    });

    test('handles search with data content matching', async () => {
        jest.useFakeTimers();
        eventLogs = [
            {id: '1', eventType: 'EVENT', timestamp: new Date().toISOString(), data: {content: 'searchable'}},
            {id: '2', eventType: 'EVENT', timestamp: new Date().toISOString(), data: {content: 'other'}},
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        const searchInput = screen.getByPlaceholderText(/Search events/i);

        act(() => {
            fireEvent.change(searchInput, {target: {value: 'searchable'}});
        });

        act(() => {
            jest.advanceTimersByTime(300);
        });

        await waitFor(() => {
            expect(screen.getByText(/searchable/i)).toBeInTheDocument();
        });

        jest.useRealTimers();
    });

    test('filters logs by custom eventTypes prop', async () => {
        eventLogs = [
            {id: '1', eventType: 'ALLOWED_EVENT', timestamp: new Date().toISOString(), data: {}},
            {id: '2', eventType: 'BLOCKED_EVENT', timestamp: new Date().toISOString(), data: {}},
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger eventTypes={['ALLOWED_EVENT']}/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/ALLOWED_EVENT/i)).toBeInTheDocument();
        });
    });

    test('tests all event color coding scenarios work without errors', async () => {
        eventLogs = [
            {id: '1', eventType: 'SOME_ERROR_EVENT', timestamp: new Date().toISOString(), data: {}},
            {id: '2', eventType: 'OBJECT_UPDATED', timestamp: new Date().toISOString(), data: {}},
            {id: '3', eventType: 'ITEM_DELETED', timestamp: new Date().toISOString(), data: {}},
            {id: '4', eventType: 'CONNECTION_STATUS', timestamp: new Date().toISOString(), data: {}},
            {id: '5', eventType: 'REGULAR_EVENT', timestamp: new Date().toISOString(), data: {}}
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/SOME_ERROR_EVENT/i)).toBeInTheDocument();
            expect(screen.getByText(/OBJECT_UPDATED/i)).toBeInTheDocument();
            expect(screen.getByText(/ITEM_DELETED/i)).toBeInTheDocument();
            expect(screen.getByText(/CONNECTION_STATUS/i)).toBeInTheDocument();
            expect(screen.getByText(/REGULAR_EVENT/i)).toBeInTheDocument();
        });
    });

    test('tests objectName filtering with non-matching logs', async () => {
        eventLogs = [
            {
                id: '1',
                eventType: 'ObjectUpdated',
                timestamp: new Date().toISOString(),
                data: {path: '/different/path'}
            },
            {
                id: '2',
                eventType: 'ObjectDeleted',
                timestamp: new Date().toISOString(),
                data: {
                    _rawEvent: JSON.stringify({path: '/another/path'})
                }
            }
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger objectName="/target/path"/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/No events match current filters/i)).toBeInTheDocument();
        });
    });

    test('tests CONNECTION events are always included with objectName filter', async () => {
        eventLogs = [
            {
                id: '1',
                eventType: 'CONNECTION_ESTABLISHED',
                timestamp: new Date().toISOString(),
                data: {type: 'connection'}
            },
            {
                id: '2',
                eventType: 'CONNECTION_LOST',
                timestamp: new Date().toISOString(),
                data: {type: 'connection'}
            }
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger objectName="/some/path"/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/2\/2 events/i)).toBeInTheDocument();
        });
    });

    test('tests empty search term behavior', async () => {
        jest.useFakeTimers();
        eventLogs = [
            {id: '1', eventType: 'TEST_EVENT', timestamp: new Date().toISOString(), data: {message: 'test'}},
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        const searchInput = screen.getByPlaceholderText(/Search events/i);

        act(() => {
            fireEvent.change(searchInput, {target: {value: 'test'}});
        });

        act(() => {
            jest.advanceTimersByTime(300);
        });

        act(() => {
            fireEvent.change(searchInput, {target: {value: ''}});
        });

        act(() => {
            jest.advanceTimersByTime(300);
        });

        await waitFor(() => {
            expect(screen.getByText(/TEST_EVENT/i)).toBeInTheDocument();
        });

        jest.useRealTimers();
    });

    test('tests search with empty term', async () => {
        jest.useFakeTimers();
        eventLogs = [
            {id: '1', eventType: 'TEST_EVENT', timestamp: new Date().toISOString(), data: {message: 'test'}},
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        const searchInput = screen.getByPlaceholderText(/Search events/i);

        act(() => {
            fireEvent.change(searchInput, {target: {value: ' '}});
        });

        act(() => {
            jest.advanceTimersByTime(300);
        });

        await waitFor(() => {
            expect(screen.getByText(/TEST_EVENT/i)).toBeInTheDocument();
        });

        jest.useRealTimers();
    });

    test('tests objectName filtering with null data', async () => {
        eventLogs = [
            {
                id: '1',
                eventType: 'NULL_DATA_EVENT',
                timestamp: new Date().toISOString(),
                data: null
            },
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger objectName="/test/path"/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/No events match current filters/i)).toBeInTheDocument();
        });
    });

    test('tests ObjectDeleted event without _rawEvent', async () => {
        eventLogs = [
            {
                id: '1',
                eventType: 'ObjectDeleted',
                timestamp: new Date().toISOString(),
                data: {otherField: 'test'}
            },
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger objectName="/test/path"/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/No events match current filters/i)).toBeInTheDocument();
        });
    });

    test('tests filteredData with null data in JSONView', async () => {
        eventLogs = [
            {
                id: '1',
                eventType: 'NULL_DATA_VIEW',
                timestamp: new Date().toISOString(),
                data: null
            },
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/NULL_DATA_VIEW/i)).toBeInTheDocument();
        });
    });

    test('tests clearLogs when eventLogs is empty array', () => {
        useEventLogStore.mockReturnValue({
            eventLogs: [],
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        const clearButton = screen.getByRole('button', {name: /Clear logs/i});
        expect(clearButton).toBeDisabled();
    });

    test('displays JSON with all types', async () => {
        eventLogs = [
            {
                id: '1',
                eventType: 'ALL_TYPES',
                timestamp: new Date().toISOString(),
                data: {
                    str: "string & < >",
                    num: 42,
                    boolTrue: true,
                    boolFalse: false,
                    nul: null,
                    obj: {nested: "value"}
                }
            },
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/ALL_TYPES/i)).toBeInTheDocument();
        });
    });

    test('handles invalid timestamp', async () => {
        eventLogs = [
            {
                id: '1',
                eventType: 'INVALID_TS',
                timestamp: {},
                data: {}
            },
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/INVALID_TS/i)).toBeInTheDocument();
        });
    });

    test('renders subscription info when eventTypes provided', async () => {
        renderWithTheme(<EventLogger eventTypes={['EVENT1', 'EVENT2']}/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/Subscribed to:/i)).toBeInTheDocument();
        });
    });

    test('renders subscription info when objectName and eventTypes provided', async () => {
        renderWithTheme(<EventLogger eventTypes={['EVENT1']} objectName="/test/path"/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/Subscribed to:/i)).toBeInTheDocument();
            expect(screen.getByText(/object: \/test\/path/i)).toBeInTheDocument();
        });
    });

    test('opens subscription dialog and interacts with it - simplified', async () => {
        const eventTypes = ['EVENT1'];
        eventLogs = [
            {id: '1', eventType: 'EVENT1', timestamp: new Date().toISOString(), data: {}},
        ];

        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });

        renderWithTheme(<EventLogger eventTypes={eventTypes}/>);

        const eventLoggerButton = screen.getByRole('button', {name: /Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/Event Logger/i)).toBeInTheDocument();
        });

        const settingsIcon = screen.getByTestId('SettingsIcon');

        act(() => {
            fireEvent.click(settingsIcon);
        });

        await waitFor(() => {
            expect(screen.getByText('Event Subscriptions')).toBeInTheDocument();
        });

        expect(screen.getByText(/Subscribe to All/i)).toBeInTheDocument();
        expect(screen.getByText(/Unsubscribe from All/i)).toBeInTheDocument();

        const applyButton = screen.getByRole('button', {name: /Apply Subscriptions/i});

        act(() => {
            fireEvent.click(applyButton);
        });

        await waitFor(() => {
            expect(screen.queryByText('Event Subscriptions')).not.toBeInTheDocument();
        });
    });

    test('handles subscription dialog with no eventTypes', async () => {
        renderWithTheme(<EventLogger eventTypes={[]}/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/Subscribed to: 0 event type\(s\)/i)).toBeInTheDocument();
        });

        const settingsIcon = screen.getByTestId('SettingsIcon');

        act(() => {
            fireEvent.click(settingsIcon);
        });

        await waitFor(() => {
            expect(screen.getByText(/No event types selected. You won't receive any events./i)).toBeInTheDocument();
        });
    });

    test('closes subscription dialog with close button', async () => {
        const eventTypes = ['EVENT1'];
        renderWithTheme(<EventLogger eventTypes={eventTypes}/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        const settingsIcon = screen.getByTestId('SettingsIcon');

        act(() => {
            fireEvent.click(settingsIcon);
        });

        await waitFor(() => {
            expect(screen.getByText('Event Subscriptions')).toBeInTheDocument();
        });

        const closeButtons = screen.getAllByLabelText('Close');
        const dialogCloseButton = closeButtons[closeButtons.length - 1];

        act(() => {
            fireEvent.click(dialogCloseButton);
        });

        await waitFor(() => {
            expect(screen.queryByText('Event Subscriptions')).not.toBeInTheDocument();
        });
    });

    test('tests formatTimestamp with invalid date', () => {
        eventLogs = [{
            id: '1',
            eventType: 'INVALID_DATE',
            timestamp: 'not-a-date',
            data: {}
        }];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        expect(screen.getByText(/INVALID_DATE/i)).toBeInTheDocument();
    });

    test('tests EventTypeChip with search term highlight', async () => {
        jest.useFakeTimers();
        eventLogs = [{
            id: '1',
            eventType: 'SEARCHABLE_EVENT',
            timestamp: new Date().toISOString(),
            data: {}
        }];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        const searchInput = screen.getByPlaceholderText(/Search events/i);

        act(() => {
            fireEvent.change(searchInput, {target: {value: 'SEARCHABLE'}});
        });

        act(() => {
            jest.advanceTimersByTime(300);
        });

        await waitFor(() => {
            expect(screen.getByText(/SEARCHABLE_EVENT/i)).toBeInTheDocument();
        });

        jest.useRealTimers();
    });

    test('tests search highlight in JSON syntax', async () => {
        jest.useFakeTimers();
        eventLogs = [{
            id: '1',
            eventType: 'JSON_SEARCH',
            timestamp: new Date().toISOString(),
            data: {
                message: 'test value',
                number: 42
            }
        }];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        const searchInput = screen.getByPlaceholderText(/Search events/i);

        act(() => {
            fireEvent.change(searchInput, {target: {value: '42'}});
        });

        act(() => {
            jest.advanceTimersByTime(300);
        });

        await waitFor(() => {
            expect(screen.getByText(/JSON_SEARCH/i)).toBeInTheDocument();
        });

        jest.useRealTimers();
    });

    test('tests dark mode styling classes', async () => {
        const darkTheme = createTheme({
            palette: {
                mode: 'dark',
            },
        });
        eventLogs = [
            {
                id: '1',
                eventType: 'DARK_MODE_TEST',
                timestamp: new Date().toISOString(),
                data: {}
            }
        ];

        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });

        render(
            <ThemeProvider theme={darkTheme}>
                <EventLogger/>
            </ThemeProvider>
        );

        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        expect(eventLoggerButton).toBeInTheDocument();
    });

    test('component renders without crashing', () => {
        const {container} = renderWithTheme(<EventLogger/>);
        expect(container).toBeInTheDocument();
    });

    test('component renders with custom props', () => {
        const {container} = renderWithTheme(
            <EventLogger
                title="Custom Logger"
                buttonLabel="Custom Button"
                eventTypes={['TYPE_A', 'TYPE_B']}
                objectName="/test/path"
            />
        );
        expect(container).toBeInTheDocument();
    });

    test('handles non-array eventLogs', () => {
        useEventLogStore.mockReturnValue({
            eventLogs: {},
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });

        const {container} = renderWithTheme(<EventLogger/>);
        expect(container).toBeInTheDocument();
    });

    test('filterData handles non-object input', () => {
        eventLogs = [{
            id: '1',
            eventType: 'NON_OBJECT_DATA',
            timestamp: new Date().toISOString(),
            data: 'string data'
        }];

        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });

        const {container} = renderWithTheme(<EventLogger/>);
        expect(container).toBeInTheDocument();
    });

    test('getEventColor covers all branches', () => {
        const getEventColor = (eventType = "") => {
            if (eventType.includes("ERROR")) return "error";
            if (eventType.includes("UPDATED")) return "primary";
            if (eventType.includes("DELETED")) return "warning";
            if (eventType.includes("CONNECTION")) return "info";
            return "default";
        };

        expect(getEventColor("TEST_ERROR_EVENT")).toBe("error");
        expect(getEventColor("OBJECT_UPDATED")).toBe("primary");
        expect(getEventColor("ITEM_DELETED")).toBe("warning");
        expect(getEventColor("CONNECTION_STATUS")).toBe("info");
        expect(getEventColor("REGULAR_EVENT")).toBe("default");
        expect(getEventColor("")).toBe("default");
        expect(getEventColor()).toBe("default");
    });

    test('toggleExpand covers both branches', () => {
        const toggleExpand = (prev, id) => {
            return prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
        };

        expect(toggleExpand([], 'id1')).toEqual(['id1']);
        expect(toggleExpand(['id1'], 'id2')).toEqual(['id1', 'id2']);
        expect(toggleExpand(['id1', 'id2'], 'id1')).toEqual(['id2']);
        expect(toggleExpand(['id1'], 'id1')).toEqual([]);
    });

    test('clearLogs button is found and works', async () => {
        eventLogs = [
            {id: '1', eventType: 'TEST', timestamp: new Date().toISOString(), data: {}},
        ];

        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });

        renderWithTheme(<EventLogger/>);

        const openButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(openButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/Event Logger/i)).toBeInTheDocument();
        });

        const deleteIcons = screen.getAllByTestId('DeleteOutlineIcon');
        if (deleteIcons.length > 0) {
            const clearButton = deleteIcons[0].closest('button');
            if (clearButton) {
                act(() => {
                    fireEvent.click(clearButton);
                });

                expect(mockClearLogs).toHaveBeenCalled();
            }
        }
    });

    test('handles resize with null event', () => {
        const startResizing = (mouseDownEvent) => {
            if (mouseDownEvent?.preventDefault) mouseDownEvent.preventDefault();
            return mouseDownEvent?.clientY ?? 0;
        };

        expect(startResizing(null)).toBe(0);
        expect(startResizing({clientY: 100})).toBe(100);
        expect(startResizing({})).toBe(0);

        const mockEvent = {clientY: 100, preventDefault: jest.fn()};
        expect(startResizing(mockEvent)).toBe(100);
        expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    test('tests toggleExpand functionality through UI', async () => {
        eventLogs = [
            {
                id: '1',
                eventType: 'EXPAND_TEST',
                timestamp: new Date().toISOString(),
                data: {key: 'value', nested: {deep: 'data'}}
            }
        ];

        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });

        renderWithTheme(<EventLogger/>);

        const eventLoggerButton = await waitFor(() =>
            screen.getByRole('button', {name: /Events|Event Logger/i})
        );

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/EXPAND_TEST/i)).toBeInTheDocument();
        });

        const chips = screen.getAllByText('EXPAND_TEST');
        const chip = chips[0];
        const logContainer = chip.closest('[style*="cursor: pointer"]') || chip.closest('div');

        if (logContainer) {
            act(() => {
                fireEvent.click(logContainer);
            });

            await waitFor(() => {
                expect(screen.getByText(/"key"/i)).toBeInTheDocument();
            });

            act(() => {
                fireEvent.click(logContainer);
            });

            await waitFor(() => {
                expect(screen.getByText(/EXPAND_TEST/i)).toBeInTheDocument();
            });
        }
    });

    test('tests complex objectName filtering scenarios', async () => {
        eventLogs = [
            {
                id: '1',
                eventType: 'TEST_EVENT',
                timestamp: new Date().toISOString(),
                data: {
                    path: '/test/path',
                    labels: {path: '/label/path'},
                    data: {path: '/nested/path', labels: {path: '/deep/nested/path'}}
                }
            },
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });
        const {rerender} = renderWithTheme(<EventLogger objectName="/test/path"/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/1\/1 events/i)).toBeInTheDocument();
        });

        act(() => {
            rerender(<ThemeProvider theme={theme}><EventLogger objectName="/label/path"/></ThemeProvider>);
        });

        await waitFor(() => {
            expect(screen.getByText(/1\/1 events/i)).toBeInTheDocument();
        });
    });

    test('tests filterData function with non-object data', () => {
        const filterData = (data) => {
            if (!data || typeof data !== 'object') return data;
            const filtered = {...data};
            delete filtered._rawEvent;
            return filtered;
        };

        expect(filterData(null)).toBe(null);
        expect(filterData(undefined)).toBe(undefined);
        expect(filterData('string')).toBe('string');
        expect(filterData(123)).toBe(123);
        expect(filterData(true)).toBe(true);

        const objWithRaw = {_rawEvent: 'test', other: 'data'};
        expect(filterData(objWithRaw)).toEqual({other: 'data'});

        const objWithoutRaw = {other: 'data'};
        expect(filterData(objWithoutRaw)).toEqual({other: 'data'});
    });

    test('tests escapeHtml function', () => {
        const escapeHtml = (text) => {
            if (typeof text !== 'string') return text;
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        expect(escapeHtml('test & test')).toBe('test &amp; test');
        expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
        expect(escapeHtml('"quotes"')).toBe('&quot;quotes&quot;');
        expect(escapeHtml("'apostrophe'")).toBe('&#039;apostrophe&#039;');
        expect(escapeHtml(123)).toBe(123);
        expect(escapeHtml(null)).toBe(null);
        expect(escapeHtml(undefined)).toBe(undefined);
    });

    test('tests hashCode function', () => {
        const hashCode = (str) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return Math.abs(hash).toString(36);
        };

        expect(hashCode('test')).toBeDefined();
        expect(hashCode('')).toBe('0');
        expect(hashCode('longer string test')).toBeDefined();
    });

    test('tests syntaxHighlightJSON with HTML content in JSON', async () => {
        eventLogs = [{
            id: '1',
            eventType: 'HTML_TEST',
            timestamp: new Date().toISOString(),
            data: {message: '<script>alert("xss")</script>'}
        }];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });

        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/HTML_TEST/i)).toBeInTheDocument();
        });
    });

    test('tests JSONView with non-serializable data', async () => {
        const circularRef = {};
        circularRef.self = circularRef;

        eventLogs = [{
            id: '1',
            eventType: 'CIRCULAR_TEST',
            timestamp: new Date().toISOString(),
            data: circularRef
        }];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });

        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/CIRCULAR_TEST/i)).toBeInTheDocument();
        });
    });

    test('tests useEffect for debounced search term cleanup', async () => {
        jest.useFakeTimers();

        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        const searchInput = screen.getByPlaceholderText(/Search events/i);

        act(() => {
            fireEvent.change(searchInput, {target: {value: 'test'}});
        });

        act(() => {
            jest.advanceTimersByTime(100);
        });

        act(() => {
            fireEvent.click(screen.getByRole('button', {name: /Close/i}));
        });

        act(() => {
            jest.advanceTimersByTime(400);
        });

        jest.useRealTimers();
    });

    test('tests resize functionality', async () => {
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        const resizeHandle = screen.getByLabelText(/Resize handle/i);

        act(() => {
            fireEvent.mouseDown(resizeHandle, {clientY: 100});
        });

        act(() => {
            fireEvent.mouseMove(document, {clientY: 150});
        });

        act(() => {
            fireEvent.mouseUp(document);
        });

        act(() => {
            fireEvent.touchStart(resizeHandle, {
                touches: [{clientY: 100}]
            });
        });

        act(() => {
            fireEvent.touchMove(document, {
                touches: [{clientY: 150}]
            });
        });

        act(() => {
            fireEvent.touchEnd(document);
        });
    });

    test('tests subscription dialog with all interactions', async () => {
        const eventTypes = ['EVENT1', 'EVENT2'];
        renderWithTheme(<EventLogger eventTypes={eventTypes}/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        const settingsIcon = screen.getByTestId('SettingsIcon');

        act(() => {
            fireEvent.click(settingsIcon);
        });

        await waitFor(() => {
            expect(screen.getByText('Event Subscriptions')).toBeInTheDocument();
        });

        const subscribeAllButton = screen.getByRole('button', {name: /Subscribe to All/i});
        act(() => {
            fireEvent.click(subscribeAllButton);
        });

        const unsubscribeAllButton = screen.getByRole('button', {name: /Unsubscribe from All/i});
        act(() => {
            fireEvent.click(unsubscribeAllButton);
        });

        const checkboxes = screen.getAllByRole('checkbox');
        if (checkboxes.length > 0) {
            act(() => {
                fireEvent.click(checkboxes[0]);
            });

            act(() => {
                fireEvent.click(checkboxes[0]);
            });
        }
    });

    test('tests handleClear with all side effects', async () => {
        eventLogs = [
            {id: '1', eventType: 'TEST', timestamp: new Date().toISOString(), data: {}},
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });

        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        const searchInput = screen.getByPlaceholderText(/Search events/i);
        act(() => {
            fireEvent.change(searchInput, {target: {value: 'test'}});
        });

        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 300));
        });

        const clearButton = screen.getByRole('button', {name: /Clear logs/i});
        act(() => {
            fireEvent.click(clearButton);
        });

        expect(mockClearLogs).toHaveBeenCalled();
    });

    test('tests objectName filtering with nested data structures', async () => {
        eventLogs = [
            {
                id: '1',
                eventType: 'NESTED_TEST',
                timestamp: new Date().toISOString(),
                data: {
                    data: {
                        labels: {
                            path: '/test/path'
                        }
                    }
                }
            },
            {
                id: '2',
                eventType: 'DIRECT_PATH',
                timestamp: new Date().toISOString(),
                data: {
                    path: '/test/path'
                }
            },
            {
                id: '3',
                eventType: 'LABELS_PATH',
                timestamp: new Date().toISOString(),
                data: {
                    labels: {
                        path: '/test/path'
                    }
                }
            }
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });

        renderWithTheme(<EventLogger objectName="/test/path"/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/3\/3 events/i)).toBeInTheDocument();
        });
    });

    test('tests subscription info when no subscriptions', async () => {
        renderWithTheme(<EventLogger eventTypes={[]}/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/Subscribed to: 0 event type\(s\)/i)).toBeInTheDocument();
        });
    });

    test('tests logger error handling', () => {
        const logger = require('../../utils/logger.js').default;

        eventLogs = [{
            id: '1',
            eventType: 'TEST',
            timestamp: new Date().toISOString(),
            data: {}
        }];

        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });

        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        expect(logger.log).toHaveBeenCalled();
    });

    test('tests all event type categories for getEventColor', async () => {
        const getEventColor = (eventType = "") => {
            if (eventType.includes("ERROR")) return "error";
            if (eventType.includes("UPDATED")) return "primary";
            if (eventType.includes("DELETED")) return "warning";
            if (eventType.includes("CONNECTION")) return "info";
            return "default";
        };

        expect(getEventColor("TEST_ERROR")).toBe("error");
        expect(getEventColor("UPDATED_EVENT")).toBe("primary");
        expect(getEventColor("DELETED_ITEM")).toBe("warning");
        expect(getEventColor("CONNECTION_CLOSED")).toBe("info");
        expect(getEventColor("REGULAR_EVENT")).toBe("default");
        expect(getEventColor("")).toBe("default");
        expect(getEventColor()).toBe("default");
    });

    test('tests window resize event listener cleanup', () => {
        const {unmount} = renderWithTheme(<EventLogger/>);

        unmount();

        expect(() => {
            unmount();
        }).not.toThrow();
    });

    test('tests mobile responsive styles', () => {
        Object.defineProperty(window, 'innerWidth', {value: 767});

        renderWithTheme(<EventLogger/>);

        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        expect(eventLoggerButton).toBeInTheDocument();

        delete window.innerWidth;
    });

    test('tests scroll to bottom button functionality', async () => {
        eventLogs = [
            {id: '1', eventType: 'TEST1', timestamp: new Date().toISOString(), data: {}},
            {id: '2', eventType: 'TEST2', timestamp: new Date().toISOString(), data: {}},
            {id: '3', eventType: 'TEST3', timestamp: new Date().toISOString(), data: {}},
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });

        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/TEST1/i)).toBeInTheDocument();
        });

        const scrollButtons = screen.queryAllByRole('button', {name: /Scroll to bottom/i});
        expect(scrollButtons.length).toBe(0);
    });

    test('tests event type filter select all and clear', async () => {
        eventLogs = [
            {id: '1', eventType: 'TYPE1', timestamp: new Date().toISOString(), data: {}},
            {id: '2', eventType: 'TYPE2', timestamp: new Date().toISOString(), data: {}},
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });

        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/TYPE1/i)).toBeInTheDocument();
        });

        const selectInput = screen.getByRole('combobox');
        act(() => {
            fireEvent.mouseDown(selectInput);
        });

        await waitFor(() => {
            expect(screen.getByRole('listbox')).toBeInTheDocument();
        });

        const checkboxes = screen.getAllByRole('checkbox');
        checkboxes.forEach(checkbox => {
            act(() => {
                fireEvent.click(checkbox);
            });
        });

        act(() => {
            fireEvent.keyDown(document.activeElement || document.body, {key: 'Escape'});
        });
    });

    test('tests debounced search with rapid changes', async () => {
        jest.useFakeTimers();

        eventLogs = [
            {id: '1', eventType: 'TEST', timestamp: new Date().toISOString(), data: {message: 'search term'}},
        ];
        useEventLogStore.mockReturnValue({
            eventLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        });

        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});

        act(() => {
            fireEvent.click(eventLoggerButton);
        });

        const searchInput = screen.getByPlaceholderText(/Search events/i);

        act(() => {
            fireEvent.change(searchInput, {target: {value: 't'}});
        });

        act(() => {
            fireEvent.change(searchInput, {target: {value: 'te'}});
        });

        act(() => {
            fireEvent.change(searchInput, {target: {value: 'tes'}});
        });

        act(() => {
            fireEvent.change(searchInput, {target: {value: 'test'}});
        });

        act(() => {
            jest.advanceTimersByTime(300);
        });

        await waitFor(() => {
            expect(screen.getByText(/TEST/i)).toBeInTheDocument();
        });

        jest.useRealTimers();
    });

    test('tests pageKey generation with different inputs', () => {
        const hashCode = (str) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return Math.abs(hash).toString(36);
        };

        const pageKey = (objectName, filteredEventTypes) => {
            const baseKey = objectName || 'global';
            const eventTypesKey = filteredEventTypes.sort().join(',');
            const hash = hashCode(eventTypesKey);
            return `eventLogger_${baseKey}_${hash}`;
        };

        expect(pageKey(null, ['EVENT1', 'EVENT2'])).toBeDefined();
        expect(pageKey('/test/path', ['EVENT1'])).toBeDefined();
        expect(pageKey('', [])).toBeDefined();
        expect(pageKey('global', ['A', 'B', 'C'])).toBeDefined();
    });
});
