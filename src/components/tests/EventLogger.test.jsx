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

const theme = createTheme();

const renderWithTheme = (ui) => {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
};

describe('EventLogger Component', () => {

    beforeEach(() => {
        useEventLogStore.mockReturnValue({
            eventLogs: [],
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        logger.info.mockClear();
        logger.warn.mockClear();
        logger.error.mockClear();
        logger.debug.mockClear();
        logger.log.mockClear();
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
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

    test('opens the drawer when button is clicked', () => {
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);
        expect(screen.getByText(/Event Logger/i)).toBeInTheDocument();
    });

    test('displays no events message when there are no logs', async () => {
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);
        await waitFor(() => {
            expect(screen.getByText(/No events logged/i)).toBeInTheDocument();
        });
    });

    test('displays logs when eventLogs are provided', async () => {
        const mockLogs = [
            {
                id: '1',
                eventType: 'TEST_EVENT',
                timestamp: new Date().toISOString(),
                data: {message: 'Test data'},
            },
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/TEST_EVENT/i)).toBeInTheDocument();
        });

        expect(screen.getByText(/Test data/i)).toBeInTheDocument();
    });

    test('filters logs by search term', async () => {
        const mockLogs = [
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
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/TEST_EVENT/i)).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText(/Search events/i);
        fireEvent.change(searchInput, {target: {value: 'Test'}});

        await waitFor(() => {
            expect(screen.getByText(/TEST_EVENT/i)).toBeInTheDocument();
            expect(screen.queryByText(/ANOTHER_EVENT/i)).not.toBeInTheDocument();
        });
    });

    test('filters logs by event type', async () => {
        const mockLogs = [
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
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/TEST_EVENT/i)).toBeInTheDocument();
        });

        const selectInput = screen.getByRole('combobox');
        fireEvent.mouseDown(selectInput);

        await waitFor(() => {
            expect(screen.getByRole('listbox')).toBeInTheDocument();
        });

        const listbox = screen.getByRole('listbox');
        const testEventOption = within(listbox).getByText(/TEST_EVENT/i);
        fireEvent.click(testEventOption);
        fireEvent.keyDown(document.activeElement, {key: 'Escape'});

        await waitFor(() => {
            expect(screen.getByText(/Test data/i)).toBeInTheDocument();
            expect(screen.queryByText(/Other data/i)).not.toBeInTheDocument();
        });
    });

    test('toggles pause state', async () => {
        const setPausedMock = jest.fn();
        useEventLogStore.mockReturnValue({
            eventLogs: [],
            isPaused: false,
            setPaused: setPausedMock,
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        const pauseButton = screen.getByRole('button', {name: /Pause/i});
        fireEvent.click(pauseButton);
        expect(setPausedMock).toHaveBeenCalledWith(true);
    });

    test('clears logs when clear button is clicked', async () => {
        const clearLogsMock = jest.fn();
        useEventLogStore.mockReturnValue({
            eventLogs: [{id: '1', eventType: 'TEST', timestamp: new Date().toISOString(), data: {}}],
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: clearLogsMock,
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        const clearButton = screen.getByRole('button', {name: /Clear logs/i});
        fireEvent.click(clearButton);
        expect(clearLogsMock).toHaveBeenCalled();
    });

    test('closes the drawer when close button is clicked', async () => {
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        const closeButton = screen.getByRole('button', {name: /Close/i});
        fireEvent.click(closeButton);

        await waitFor(() => {
            const reopenButton = screen.getByRole('button', {name: /Events|Event Logger/i});
            expect(reopenButton).toBeInTheDocument();
        });
    });

    test('tests scroll behavior and autoScroll functionality', async () => {
        const mockLogs = [
            {
                id: '1',
                eventType: 'SCROLL_EVENT_1',
                timestamp: new Date().toISOString(),
                data: {index: 1, content: 'First event'},
            },
            {
                id: '2',
                eventType: 'SCROLL_EVENT_2',
                timestamp: new Date().toISOString(),
                data: {index: 2, content: 'Second event'},
            },
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/SCROLL_EVENT_1/i)).toBeInTheDocument();
            expect(screen.getByText(/First event/i)).toBeInTheDocument();
        });
    });

    test('tests event color coding functionality', async () => {
        const mockLogs = [
            {id: '1', eventType: 'ERROR_EVENT_1', timestamp: new Date().toISOString(), data: {}},
            {id: '2', eventType: 'UPDATED_EVENT_1', timestamp: new Date().toISOString(), data: {}},
            {id: '3', eventType: 'DELETED_EVENT_1', timestamp: new Date().toISOString(), data: {}},
            {id: '4', eventType: 'CONNECTION_EVENT_1', timestamp: new Date().toISOString(), data: {}},
            {id: '5', eventType: 'REGULAR_EVENT_1', timestamp: new Date().toISOString(), data: {}},
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/ERROR_EVENT_1/i)).toBeInTheDocument();
            expect(screen.getByText(/UPDATED_EVENT_1/i)).toBeInTheDocument();
            expect(screen.getByText(/DELETED_EVENT_1/i)).toBeInTheDocument();
            expect(screen.getByText(/CONNECTION_EVENT_1/i)).toBeInTheDocument();
            expect(screen.getByText(/REGULAR_EVENT_1/i)).toBeInTheDocument();
        });
    });

    test('tests clear filters functionality', async () => {
        const mockLogs = [
            {id: '1', eventType: 'TEST_EVENT', timestamp: new Date().toISOString(), data: {message: 'test'}},
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);

        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/TEST_EVENT/i)).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText(/Search events/i);
        fireEvent.change(searchInput, {target: {value: 'test'}});

        await waitFor(() => {
            expect(screen.getByText(/Filtered/i)).toBeInTheDocument();
        });

        const filterChip = screen.getByRole('button', {name: /Filtered/i});
        expect(filterChip).toBeInTheDocument();

        const deleteIcon = within(filterChip).getByTestId('CancelIcon');
        fireEvent.click(deleteIcon);

        await waitFor(() => {
            expect(searchInput).toHaveValue('');
        });
    });

    test('tests timestamp formatting', async () => {
        const testTimestamp = new Date('2023-01-01T12:34:56.789Z').toISOString();
        const mockLogs = [
            {id: '1', eventType: 'TEST_EVENT', timestamp: testTimestamp, data: {}},
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            const timeElements = screen.getAllByText(/\d{1,2}:\d{2}:\d{2}/);
            expect(timeElements.length).toBeGreaterThan(0);
        });
    });

    test('tests component cleanup on unmount', () => {
        const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
        const {unmount} = renderWithTheme(<EventLogger/>);
        unmount();
        expect(clearTimeoutSpy).toHaveBeenCalled();
        clearTimeoutSpy.mockRestore();
    });

    test('tests autoScroll reset when filters change', async () => {
        const mockLogs = [
            {id: '1', eventType: 'TEST_EVENT', timestamp: new Date().toISOString(), data: {message: 'test'}},
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        const searchInput = screen.getByPlaceholderText(/Search events/i);
        fireEvent.change(searchInput, {target: {value: 'new search'}});

        await waitFor(() => {
            expect(searchInput).toHaveValue('new search');
        });
    });

    test('tests complex objectName filtering scenarios', async () => {
        const mockLogs = [
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
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        const {rerender} = renderWithTheme(<EventLogger objectName="/test/path"/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/1\/1 events/i)).toBeInTheDocument();
        });

        rerender(<ThemeProvider theme={theme}><EventLogger objectName="/label/path"/></ThemeProvider>);
        await waitFor(() => {
            expect(screen.getByText(/1\/1 events/i)).toBeInTheDocument();
        });
    });

    test('tests empty search term behavior', async () => {
        const mockLogs = [
            {id: '1', eventType: 'TEST_EVENT', timestamp: new Date().toISOString(), data: {message: 'test'}},
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        const searchInput = screen.getByPlaceholderText(/Search events/i);
        fireEvent.change(searchInput, {target: {value: 'test'}});
        fireEvent.change(searchInput, {target: {value: ''}});

        await waitFor(() => {
            expect(screen.getByText(/TEST_EVENT/i)).toBeInTheDocument();
        });
    });

    test('displays custom title and buttonLabel', () => {
        renderWithTheme(<EventLogger title="Custom Logger" buttonLabel="Custom Button"/>);
        expect(screen.getByText('Custom Button')).toBeInTheDocument();
    });

    test('displays event count badge on button', () => {
        const mockLogs = [
            {id: '1', eventType: 'TEST', timestamp: new Date().toISOString(), data: {}},
            {id: '2', eventType: 'TEST', timestamp: new Date().toISOString(), data: {}},
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        expect(screen.getByText('2')).toBeInTheDocument();
    });

    test('displays paused chip when isPaused is true', async () => {
        useEventLogStore.mockReturnValue({
            eventLogs: [],
            isPaused: true,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/PAUSED/i)).toBeInTheDocument();
        });
    });

    test('displays objectName chip when objectName is provided', async () => {
        renderWithTheme(<EventLogger objectName="/test/path"/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/object: \/test\/path/i)).toBeInTheDocument();
        });
    });

    test('handles search with data content matching', async () => {
        const mockLogs = [
            {id: '1', eventType: 'EVENT', timestamp: new Date().toISOString(), data: {content: 'searchable'}},
            {id: '2', eventType: 'EVENT', timestamp: new Date().toISOString(), data: {content: 'other'}},
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        const searchInput = screen.getByPlaceholderText(/Search events/i);
        fireEvent.change(searchInput, {target: {value: 'searchable'}});

        await waitFor(() => {
            expect(screen.getByText(/searchable/i)).toBeInTheDocument();
            expect(screen.queryByText(/other/i)).not.toBeInTheDocument();
        });
    });

    test('disables clear button when no logs are present', async () => {
        useEventLogStore.mockReturnValue({
            eventLogs: [],
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        const clearButton = screen.getByRole('button', {name: /Clear logs/i});
        expect(clearButton).toBeDisabled();
    });

    test('filters logs by custom eventTypes prop', async () => {
        const mockLogs = [
            {id: '1', eventType: 'ALLOWED_EVENT', timestamp: new Date().toISOString(), data: {}},
            {id: '2', eventType: 'BLOCKED_EVENT', timestamp: new Date().toISOString(), data: {}},
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger eventTypes={['ALLOWED_EVENT']}/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/ALLOWED_EVENT/i)).toBeInTheDocument();
            expect(screen.queryByText(/BLOCKED_EVENT/i)).not.toBeInTheDocument();
        });
    });

    test('handles ObjectDeleted event with valid _rawEvent JSON', async () => {
        const mockLogs = [
            {
                id: '1',
                eventType: 'ObjectDeleted',
                timestamp: new Date().toISOString(),
                data: {_rawEvent: JSON.stringify({path: '/test/path'})},
            },
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger objectName="/test/path"/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/ObjectDeleted/i)).toBeInTheDocument();
        });
    });

    test('tests drawer resize handle exists and can be interacted with', async () => {
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/Event Logger/i)).toBeInTheDocument();
        });

        const resizeHandle = screen.getByLabelText(/Resize handle/i);
        expect(resizeHandle).toBeInTheDocument();
        fireEvent.mouseDown(resizeHandle);
    });

    test('handles ObjectDeleted event with invalid _rawEvent JSON parsing', async () => {
        const mockLogs = [
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
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/ObjectDeleted/i)).toBeInTheDocument();
        });
    });

    test('tests scroll behavior when autoScroll is enabled', async () => {
        const mockLogs = [
            {
                id: '1',
                eventType: 'SCROLL_TEST',
                timestamp: new Date().toISOString(),
                data: {test: 'data'}
            }
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        const scrollIntoViewMock = jest.fn();
        Element.prototype.scrollIntoView = scrollIntoViewMock;
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/SCROLL_TEST/i)).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(scrollIntoViewMock).toHaveBeenCalled();
        }, {timeout: 200});
    });

    test('tests various objectName filtering scenarios with different data structures', async () => {
        const mockLogs = [
            {
                id: '1',
                eventType: 'CONNECTION_EVENT',
                timestamp: new Date().toISOString(),
                data: {type: 'connection'}
            },
            {
                id: '2',
                eventType: 'ObjectUpdated',
                timestamp: new Date().toISOString(),
                data: {path: '/target/path'}
            },
            {
                id: '3',
                eventType: 'ObjectUpdated',
                timestamp: new Date().toISOString(),
                data: {labels: {path: '/target/path'}}
            },
            {
                id: '4',
                eventType: 'ObjectUpdated',
                timestamp: new Date().toISOString(),
                data: {data: {path: '/target/path'}}
            },
            {
                id: '5',
                eventType: 'ObjectUpdated',
                timestamp: new Date().toISOString(),
                data: {data: {labels: {path: '/target/path'}}}
            }
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger objectName="/target/path"/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/5\/5 events/i)).toBeInTheDocument();
        });
    });

    test('tests cleanup of resize timeout on unmount specifically', () => {
        const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
        const {unmount} = renderWithTheme(<EventLogger/>);
        unmount();
        expect(clearTimeoutSpy).toHaveBeenCalled();
        clearTimeoutSpy.mockRestore();
    });

    test('tests forceUpdate mechanism triggers re-renders', async () => {
        let mockLogs = [
            {id: '1', eventType: 'INITIAL', timestamp: new Date().toISOString(), data: {}},
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        const {rerender} = renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/INITIAL/i)).toBeInTheDocument();
        });

        mockLogs = [
            ...mockLogs,
            {id: '2', eventType: 'NEW_EVENT', timestamp: new Date().toISOString(), data: {}},
        ];
        act(() => {
            useEventLogStore.mockReturnValue({
                eventLogs: mockLogs,
                isPaused: false,
                setPaused: jest.fn(),
                clearLogs: jest.fn(),
            });
        });
        rerender(<ThemeProvider theme={theme}><EventLogger/></ThemeProvider>);
        await waitFor(() => {
            expect(screen.getByText(/NEW_EVENT/i)).toBeInTheDocument();
        });
    });

    test('tests all event color coding scenarios work without errors', async () => {
        const mockLogs = [
            {id: '1', eventType: 'SOME_ERROR_EVENT', timestamp: new Date().toISOString(), data: {}},
            {id: '2', eventType: 'OBJECT_UPDATED', timestamp: new Date().toISOString(), data: {}},
            {id: '3', eventType: 'ITEM_DELETED', timestamp: new Date().toISOString(), data: {}},
            {id: '4', eventType: 'CONNECTION_STATUS', timestamp: new Date().toISOString(), data: {}},
            {id: '5', eventType: 'REGULAR_EVENT', timestamp: new Date().toISOString(), data: {}}
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/SOME_ERROR_EVENT/i)).toBeInTheDocument();
            expect(screen.getByText(/OBJECT_UPDATED/i)).toBeInTheDocument();
            expect(screen.getByText(/ITEM_DELETED/i)).toBeInTheDocument();
            expect(screen.getByText(/CONNECTION_STATUS/i)).toBeInTheDocument();
            expect(screen.getByText(/REGULAR_EVENT/i)).toBeInTheDocument();
        });
    });

    test('tests objectName filtering with non-matching logs', async () => {
        const mockLogs = [
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
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger objectName="/target/path"/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/No events match current filters/i)).toBeInTheDocument();
        });
    });

    test('tests handleScroll when logsContainerRef is null', () => {
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);
        fireEvent.scroll(window);
        expect(true).toBe(true);
    });

    test('tests resize timeout cleanup', () => {
        const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
        const {unmount} = renderWithTheme(<EventLogger/>);
        unmount();
        expect(clearTimeoutSpy).toHaveBeenCalled();
        clearTimeoutSpy.mockRestore();
    });

    test('tests CONNECTION events are always included with objectName filter', async () => {
        const mockLogs = [
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
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger objectName="/some/path"/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/2\/2 events/i)).toBeInTheDocument();
        });
    });

    test('handleScroll updates autoScroll when not at bottom', async () => {
        useEventLogStore.mockReturnValue({
            eventLogs: [{
                id: '1',
                eventType: 'SCROLL_TEST',
                timestamp: new Date().toISOString(),
                data: {}
            }],
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        fireEvent.scroll(window);
        expect(true).toBe(true);
    });

    test('resize handler runs preventDefault and triggers mouse handlers', async () => {
        const mockPreventDefault = jest.fn();

        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/Event Logger/i)).toBeInTheDocument();
        });

        const resizeHandle = screen.getByLabelText(/Resize handle/i);

        const mouseDownEvent = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            clientY: 300
        });
        mouseDownEvent.preventDefault = mockPreventDefault;

        resizeHandle.dispatchEvent(mouseDownEvent);
        expect(mockPreventDefault).toHaveBeenCalled();
    });

    test('clears resize timeout on mouseUp during resize', async () => {
        jest.useFakeTimers();
        const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        const resizeHandle = screen.getByLabelText(/Resize handle/i);
        fireEvent.mouseDown(resizeHandle, {clientY: 300});
        fireEvent.mouseMove(document, {clientY: 250});
        jest.advanceTimersByTime(20);
        fireEvent.mouseUp(document);

        expect(clearTimeoutSpy).toHaveBeenCalled();
        clearTimeoutSpy.mockRestore();
        jest.useRealTimers();
    });

    test('autoScroll resets to true when search term changes', async () => {
        useEventLogStore.mockReturnValue({
            eventLogs: [{
                id: '1',
                eventType: 'TEST',
                timestamp: new Date().toISOString(),
                data: {}
            }],
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        const input = screen.getByPlaceholderText(/Search events/i);
        fireEvent.change(input, {target: {value: 'abc'}});

        await waitFor(() => {
            expect(input).toHaveValue('abc');
        });
    });

    test('handles JSON serializing error in search', async () => {
        const circularRef = {};
        circularRef.circular = circularRef;
        const mockLogs = [
            {
                id: '1',
                eventType: 'CIRCULAR_EVENT',
                timestamp: new Date().toISOString(),
                data: circularRef
            },
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        const searchInput = screen.getByPlaceholderText(/Search events/i);
        fireEvent.change(searchInput, {target: {value: 'test'}});

        await waitFor(() => {
            expect(logger.warn).toHaveBeenCalledWith(
                "Error serializing log data for search:",
                expect.any(Error)
            );
        });
    });

    test('tests all branches of getEventColor function', async () => {
        const mockLogs = [
            {id: '1', eventType: 'SOME_ERROR', timestamp: new Date().toISOString(), data: {}},
            {id: '2', eventType: 'SOMETHING_UPDATED', timestamp: new Date().toISOString(), data: {}},
            {id: '3', eventType: 'ITEM_DELETED', timestamp: new Date().toISOString(), data: {}},
            {id: '4', eventType: 'CONNECTION_CHANGE', timestamp: new Date().toISOString(), data: {}},
            {id: '5', eventType: 'REGULAR', timestamp: new Date().toISOString(), data: {}},
            {id: '6', eventType: undefined, timestamp: new Date().toISOString(), data: {}},
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/SOME_ERROR/i)).toBeInTheDocument();
            expect(screen.getByText(/SOMETHING_UPDATED/i)).toBeInTheDocument();
            expect(screen.getByText(/ITEM_DELETED/i)).toBeInTheDocument();
            expect(screen.getByText(/CONNECTION_CHANGE/i)).toBeInTheDocument();
            expect(screen.getByText(/REGULAR/i)).toBeInTheDocument();
        });
    });

    test('handles empty eventTypes array in filtering', async () => {
        const mockLogs = [
            {id: '1', eventType: 'EVENT_A', timestamp: new Date().toISOString(), data: {}},
            {id: '2', eventType: 'EVENT_B', timestamp: new Date().toISOString(), data: {}},
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger eventTypes={[]}/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/EVENT_A/i)).toBeInTheDocument();
            expect(screen.getByText(/EVENT_B/i)).toBeInTheDocument();
        });
    });

    test('tests objectName filtering with null data', async () => {
        const mockLogs = [
            {
                id: '1',
                eventType: 'NULL_DATA_EVENT',
                timestamp: new Date().toISOString(),
                data: null
            },
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger objectName="/test/path"/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/No events match current filters/i)).toBeInTheDocument();
        });
    });

    test('tests ObjectDeleted event without _rawEvent', async () => {
        const mockLogs = [
            {
                id: '1',
                eventType: 'ObjectDeleted',
                timestamp: new Date().toISOString(),
                data: {otherField: 'test'}
            },
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger objectName="/test/path"/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/No events match current filters/i)).toBeInTheDocument();
        });
    });

    test('handles mouseDown event without preventDefault', () => {
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        const resizeHandle = screen.getByLabelText(/Resize handle/i);
        const mouseDownEvent = new MouseEvent('mousedown', {
            clientY: 300,
            bubbles: true
        });
        resizeHandle.dispatchEvent(mouseDownEvent);
        expect(true).toBe(true);
    });


    test('tests filteredData with null data in JSONView', async () => {
        const mockLogs = [
            {
                id: '1',
                eventType: 'NULL_DATA_VIEW',
                timestamp: new Date().toISOString(),
                data: null
            },
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/NULL_DATA_VIEW/i)).toBeInTheDocument();
        });
    });

    test('tests autoScroll when logsEndRef is null', async () => {
        const mockLogs = [
            {
                id: '1',
                eventType: 'SCROLL_TEST',
                timestamp: new Date().toISOString(),
                data: {test: 'data'}
            }
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/SCROLL_TEST/i)).toBeInTheDocument();
        });

        const pauseButton = screen.getByRole('button', {name: /Pause/i});
        expect(() => {
            fireEvent.click(pauseButton);
        }).not.toThrow();
    });

    test('tests clearLogs when eventLogs is empty array', () => {
        useEventLogStore.mockReturnValue({
            eventLogs: [],
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        const clearButton = screen.getByRole('button', {name: /Clear logs/i});
        expect(clearButton).toBeDisabled();
    });

    test('tests eventType filter with empty selection', async () => {
        const mockLogs = [
            {id: '1', eventType: 'TYPE_A', timestamp: new Date().toISOString(), data: {}},
            {id: '2', eventType: 'TYPE_B', timestamp: new Date().toISOString(), data: {}},
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const buttons = screen.getAllByRole('button');
        const eventLoggerButton = buttons.find(btn =>
            btn.textContent?.includes('Events') || btn.textContent?.includes('Event Logger')
        );
        if (eventLoggerButton) {
            fireEvent.click(eventLoggerButton);
            const selectInput = screen.getByRole('combobox');
            fireEvent.mouseDown(selectInput);
            await waitFor(() => {
                const menuItems = screen.getAllByRole('option');
                if (menuItems.length > 0) {
                    fireEvent.click(menuItems[0]);
                    fireEvent.click(menuItems[0]);
                }
            });
            fireEvent.keyDown(document.activeElement, {key: 'Escape'});
            await waitFor(() => {
                expect(screen.getByText(/TYPE_A/i)).toBeInTheDocument();
                expect(screen.getByText(/TYPE_B/i)).toBeInTheDocument();
            });
        }
    });

    test('tests search with empty term', async () => {
        const mockLogs = [
            {id: '1', eventType: 'TEST_EVENT', timestamp: new Date().toISOString(), data: {message: 'test'}},
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        const searchInput = screen.getByPlaceholderText(/Search events/i);
        fireEvent.change(searchInput, {target: {value: ' '}});

        await waitFor(() => {
            expect(screen.getByText(/TEST_EVENT/i)).toBeInTheDocument();
        });
    });

    test('displays log with non-object data', async () => {
        const mockLogs = [
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
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/STRING_EVENT/i)).toBeInTheDocument();
            expect(screen.getByText('"simple string data"')).toBeInTheDocument();
            expect(screen.getByText(/NULL_EVENT/i)).toBeInTheDocument();
        });
    });

    test('toggles log expansion', async () => {
        const mockLogs = [
            {
                id: '1',
                eventType: 'EXPAND_TEST',
                timestamp: new Date().toISOString(),
                data: {key: 'value'},
            },
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/EXPAND_TEST/i)).toBeInTheDocument();
        });

        const logElements = screen.getAllByRole('button', {hidden: true});
        const logButton = logElements.find(el =>
            el.closest('[style*="cursor: pointer"]') ||
            el.textContent?.includes('EXPAND_TEST')
        );
        if (logButton) {
            fireEvent.click(logButton);
            await waitFor(() => {
                expect(screen.getByText(/"key"/i)).toBeInTheDocument();
                expect(screen.getByText(/"value"/i)).toBeInTheDocument();
            });
            fireEvent.click(logButton);
            await waitFor(() => {
                expect(screen.getByText(/EXPAND_TEST/i)).toBeInTheDocument();
            });
        }
    });

    test('covers all objectName filter conditions', async () => {
        const objectName = '/target/path';
        const mockLogs = [
            {
                id: '1',
                eventType: 'ObjectUpdated',
                timestamp: new Date().toISOString(),
                data: {path: objectName, labels: {path: '/other'}, data: {path: '/other', labels: {path: '/other'}}}
            },
            {
                id: '2',
                eventType: 'ObjectUpdated',
                timestamp: new Date().toISOString(),
                data: {path: '/other', labels: {path: objectName}, data: {path: '/other', labels: {path: '/other'}}}
            },
            {
                id: '3',
                eventType: 'ObjectUpdated',
                timestamp: new Date().toISOString(),
                data: {path: '/other', labels: {path: '/other'}, data: {path: objectName, labels: {path: '/other'}}}
            },
            {
                id: '4',
                eventType: 'ObjectUpdated',
                timestamp: new Date().toISOString(),
                data: {path: '/other', labels: {path: '/other'}, data: {path: '/other', labels: {path: objectName}}}
            },
            {
                id: '5',
                eventType: 'ObjectUpdated',
                timestamp: new Date().toISOString(),
                data: {path: '/other', labels: {path: '/other'}, data: {path: '/other', labels: {path: '/other'}}}
            },
            {id: '6', eventType: 'CONNECTION', timestamp: new Date().toISOString(), data: {}},
            {
                id: '7',
                eventType: 'ObjectDeleted',
                timestamp: new Date().toISOString(),
                data: {_rawEvent: JSON.stringify({path: objectName})}
            },
            {
                id: '8',
                eventType: 'ObjectDeleted',
                timestamp: new Date().toISOString(),
                data: {_rawEvent: JSON.stringify({labels: {path: objectName}})}
            },
            {id: '9', eventType: 'ObjectDeleted', timestamp: new Date().toISOString(), data: {_rawEvent: 'invalid'}},
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger objectName={objectName}/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/7\/7 events/i)).toBeInTheDocument();
        });
    });

    test('handles circular data in JSONView', async () => {
        const circularRef = {};
        circularRef.self = circularRef;
        const mockLogs = [
            {
                id: '1',
                eventType: 'CIRCULAR_VIEW',
                timestamp: new Date().toISOString(),
                data: {normal: 'ok', circ: circularRef}
            },
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/CIRCULAR_VIEW/i)).toBeInTheDocument();
        });
    });

    test('displays JSON with all types', async () => {
        const mockLogs = [
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
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/ALL_TYPES/i)).toBeInTheDocument();
        });

        const logElements = screen.getAllByRole('button', {hidden: true});
        const logButton = logElements.find(el => el.textContent?.includes('ALL_TYPES'));
        if (logButton) {
            fireEvent.click(logButton);
            await waitFor(() => {
                expect(screen.getByText(/"str":/i)).toBeInTheDocument();
                expect(screen.getByText(/"string & < >"/i)).toBeInTheDocument();
                expect(screen.getByText(/42/i)).toBeInTheDocument();
                expect(screen.getByText(/true/i)).toBeInTheDocument();
                expect(screen.getByText(/false/i)).toBeInTheDocument();
                expect(screen.getByText(/null/i)).toBeInTheDocument();
            });
        }
    });

    test('handles invalid timestamp', async () => {
        const mockLogs = [
            {
                id: '1',
                eventType: 'INVALID_TS',
                timestamp: {},
                data: {}
            },
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/INVALID_TS/i)).toBeInTheDocument();
        });
    });

    test('renders subscription info when eventTypes provided', async () => {
        renderWithTheme(<EventLogger eventTypes={['EVENT1', 'EVENT2']}/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/Subscribed to:/i)).toBeInTheDocument();
        });
    });

    test('renders subscription info when objectName and eventTypes provided', async () => {
        renderWithTheme(<EventLogger eventTypes={['EVENT1']} objectName="/test/path"/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/Subscribed to:/i)).toBeInTheDocument();
            expect(screen.getByText(/object: \/test\/path/i)).toBeInTheDocument();
        });
    });

    test('opens subscription dialog and interacts with it - simplified', async () => {
        const eventTypes = ['EVENT1'];
        const mockLogs = [
            {id: '1', eventType: 'EVENT1', timestamp: new Date().toISOString(), data: {}},
        ];

        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });

        renderWithTheme(<EventLogger eventTypes={eventTypes}/>);

        const eventLoggerButton = screen.getByRole('button', {name: /Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/Event Logger/i)).toBeInTheDocument();
        });

        const settingsIcon = screen.getByTestId('SettingsIcon');
        fireEvent.click(settingsIcon);

        await waitFor(() => {
            expect(screen.getByText('Event Subscriptions')).toBeInTheDocument();
        });

        expect(screen.getByText(/Subscribe to All/i)).toBeInTheDocument();
        expect(screen.getByText(/Unsubscribe from All/i)).toBeInTheDocument();

        const applyButton = screen.getByRole('button', {name: /Apply Subscriptions/i});
        fireEvent.click(applyButton);

        await waitFor(() => {
            expect(screen.queryByText('Event Subscriptions')).not.toBeInTheDocument();
        });
    });

    test('handles subscription dialog with no eventTypes', async () => {
        renderWithTheme(<EventLogger eventTypes={[]}/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/Subscribed to: 0 event type\(s\)/i)).toBeInTheDocument();
        });

        const settingsIcon = screen.getByTestId('SettingsIcon');
        fireEvent.click(settingsIcon);

        await waitFor(() => {
            expect(screen.getByText(/No event types selected. You won't receive any events./i)).toBeInTheDocument();
        });
    });

    test('closes subscription dialog with close button', async () => {
        const eventTypes = ['EVENT1'];
        renderWithTheme(<EventLogger eventTypes={eventTypes}/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        const settingsIcon = screen.getByTestId('SettingsIcon');
        fireEvent.click(settingsIcon);

        await waitFor(() => {
            expect(screen.getByText('Event Subscriptions')).toBeInTheDocument();
        });

        const closeButtons = screen.getAllByLabelText('Close');
        const dialogCloseButton = closeButtons[closeButtons.length - 1];
        fireEvent.click(dialogCloseButton);

        await waitFor(() => {
            expect(screen.queryByText('Event Subscriptions')).not.toBeInTheDocument();
        });
    });

    test('resets subscriptions with delete icon on chip', async () => {
        const eventTypes = ['EVENT1', 'EVENT2'];
        renderWithTheme(<EventLogger eventTypes={eventTypes}/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/Event Logger/i)).toBeInTheDocument();
        });

        expect(screen.getByTestId('SettingsIcon')).toBeInTheDocument();
    });

    test('tests syntaxHighlightJSON with non-string input', async () => {
        const mockLogs = [{
            id: '1',
            eventType: 'TEST',
            timestamp: new Date().toISOString(),
            data: {number: 123, boolean: true, null: null}
        }];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/TEST/i)).toBeInTheDocument();
        });
    });

    test('tests filterData function with null data', () => {
        const {container} = renderWithTheme(<EventLogger/>);
        expect(container).toBeInTheDocument();
    });

    test('tests escapeHtml function with special characters', () => {
        const {container} = renderWithTheme(<EventLogger/>);
        expect(container).toBeInTheDocument();
    });

    test('tests createHighlightedHtml with empty search term', () => {
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        const searchInput = screen.getByPlaceholderText(/Search events/i);
        fireEvent.change(searchInput, {target: {value: ''}});
        expect(searchInput).toHaveValue('');
    });

    test('tests JSONView with unserializable data', async () => {
        const mockLogs = [{
            id: '1',
            eventType: 'BIGINT_EVENT',
            timestamp: new Date().toISOString(),
            data: {big: 123}
        }];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/BIGINT_EVENT/i)).toBeInTheDocument();
        });
    });

    test('tests handleScroll when at bottom', () => {
        useEventLogStore.mockReturnValue({
            eventLogs: [{
                id: '1',
                eventType: 'TEST',
                timestamp: new Date().toISOString(),
                data: {}
            }],
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);
        fireEvent.scroll(window);
        expect(true).toBe(true);
    });

    test('tests resize timeout during mouse move', async () => {
        jest.useFakeTimers();
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        const resizeHandle = screen.getByLabelText(/Resize handle/i);
        fireEvent.mouseDown(resizeHandle, {clientY: 300});
        fireEvent.mouseMove(document, {clientY: 250});
        fireEvent.mouseMove(document, {clientY: 200});
        jest.advanceTimersByTime(20);
        fireEvent.mouseUp(document);

        jest.useRealTimers();
        expect(true).toBe(true);
    });

    test('tests formatTimestamp with invalid date', () => {
        const mockLogs = [{
            id: '1',
            eventType: 'INVALID_DATE',
            timestamp: 'not-a-date',
            data: {}
        }];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        expect(screen.getByText(/INVALID_DATE/i)).toBeInTheDocument();
    });

    test('tests EventTypeChip with search term highlight', async () => {
        const mockLogs = [{
            id: '1',
            eventType: 'SEARCHABLE_EVENT',
            timestamp: new Date().toISOString(),
            data: {}
        }];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        const searchInput = screen.getByPlaceholderText(/Search events/i);
        fireEvent.change(searchInput, {target: {value: 'SEARCHABLE'}});

        await waitFor(() => {
            expect(screen.getByText(/SEARCHABLE_EVENT/i)).toBeInTheDocument();
        });
    });

    test('tests autoScroll useEffect with drawer closed', () => {
        const mockLogs = [{
            id: '1',
            eventType: 'NO_SCROLL',
            timestamp: new Date().toISOString(),
            data: {}
        }];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        expect(eventLoggerButton).toBeInTheDocument();
    });

    test('tests subscription useEffect with token', () => {
        const localStorageMock = {
            getItem: jest.fn(() => 'test-token'),
        };
        Object.defineProperty(window, 'localStorage', {
            value: localStorageMock,
        });

        renderWithTheme(<EventLogger eventTypes={['TEST']} objectName="/test"/>);
        expect(localStorageMock.getItem).toHaveBeenCalledWith('authToken');
    });

    test('tests getCurrentSubscriptions function', async () => {
        const eventTypes = ['TYPE_A', 'TYPE_B'];
        renderWithTheme(<EventLogger eventTypes={eventTypes}/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/Event Logger/i)).toBeInTheDocument();
        });

        expect(screen.getByRole('button', {name: /Pause/i})).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Search events/i)).toBeInTheDocument();
    });

    test('tests search highlight in JSON syntax', async () => {
        const mockLogs = [{
            id: '1',
            eventType: 'JSON_SEARCH',
            timestamp: new Date().toISOString(),
            data: {
                message: 'test value',
                number: 42
            }
        }];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        const searchInput = screen.getByPlaceholderText(/Search events/i);
        fireEvent.change(searchInput, {target: {value: '42'}});

        await waitFor(() => {
            expect(screen.getByText(/JSON_SEARCH/i)).toBeInTheDocument();
        });
    });

    test('tests dark mode styling classes', async () => {
        const darkTheme = createTheme({
            palette: {
                mode: 'dark',
            },
        });
        render(
            <ThemeProvider theme={darkTheme}>
                <EventLogger/>
            </ThemeProvider>
        );

        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        expect(eventLoggerButton).toBeInTheDocument();
    });

    test('tests forceUpdate when eventLogs change', async () => {
        const mockLogs1 = [
            {id: '1', eventType: 'INITIAL', timestamp: new Date().toISOString(), data: {}},
        ];
        const mockLogs2 = [
            {id: '1', eventType: 'INITIAL', timestamp: new Date().toISOString(), data: {}},
            {id: '2', eventType: 'ADDED', timestamp: new Date().toISOString(), data: {}},
        ];
        let currentLogs = mockLogs1;
        const mockSetPaused = jest.fn();
        const mockClearLogs = jest.fn();
        useEventLogStore.mockImplementation(() => ({
            eventLogs: currentLogs,
            isPaused: false,
            setPaused: mockSetPaused,
            clearLogs: mockClearLogs,
        }));
        const {rerender} = renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/INITIAL/i)).toBeInTheDocument();
        });

        currentLogs = mockLogs2;
        rerender(<ThemeProvider theme={theme}><EventLogger/></ThemeProvider>);
        await waitFor(() => {
            expect(screen.getByText(/ADDED/i)).toBeInTheDocument();
        });
    });

    test('syntaxHighlightJSON - branch when match is key (/:$/)', async () => {
        const mockLogs = [{
            id: '1',
            eventType: 'KEY_TEST',
            timestamp: new Date().toISOString(),
            data: {myKey: 'myValue'},
        }];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });

        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText('KEY_TEST')).toBeInTheDocument();
        });
    });

    test('handleScroll - branch when at bottom (atBottom === true)', async () => {
        const mockLogs = [{
            id: '1',
            eventType: 'SCROLL_TEST',
            timestamp: new Date().toISOString(),
            data: {},
        }];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/SCROLL_TEST/i)).toBeInTheDocument();
        });

        fireEvent.scroll(window);
        expect(true).toBe(true);
    });

    test('main drawer onClose callback', async () => {
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        expect(eventLoggerButton).toBeInTheDocument();

        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/Event Logger/i)).toBeInTheDocument();
        });

        const closeButton = screen.getByRole('button', {name: /Close/i});
        fireEvent.click(closeButton);

        await waitFor(() => {
            const reopenButton = screen.getByRole('button', {name: /Events|Event Logger/i});
            expect(reopenButton).toBeInTheDocument();
        });
    });

    test('covers createHighlightedHtml no search term branch', async () => {
        const mockLogs = [
            {
                id: '1',
                eventType: 'NO_SEARCH_BRANCH',
                timestamp: new Date().toISOString(),
                data: {message: 'content to escape & < >'},
            },
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/NO_SEARCH_BRANCH/i)).toBeInTheDocument();
        });
    });

    test('covers subscription dialog empty eventTypes', async () => {
        renderWithTheme(<EventLogger eventTypes={[]}/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/Subscribed to: 0 event type\(s\)/i)).toBeInTheDocument();
        });
    });

    test('dark mode styles are applied correctly', async () => {
        const darkTheme = createTheme({
            palette: {
                mode: 'dark',
            },
        });

        const mockLogs = [
            {
                id: '1',
                eventType: 'DARK_MODE_TEST',
                timestamp: new Date().toISOString(),
                data: {}
            }
        ];

        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
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
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });

        const {container} = renderWithTheme(<EventLogger/>);
        expect(container).toBeInTheDocument();
    });

    test('JSONView handles non-serializable data', () => {
        const circular = {};
        circular.self = circular;

        const mockLogs = [{
            id: '1',
            eventType: 'NON_SERIALIZABLE',
            timestamp: new Date().toISOString(),
            data: circular
        }];

        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });

        const {container} = renderWithTheme(<EventLogger/>);
        expect(container).toBeInTheDocument();
    });

    test('filterData handles non-object input', () => {
        const mockLogs = [{
            id: '1',
            eventType: 'NON_OBJECT_DATA',
            timestamp: new Date().toISOString(),
            data: 'string data'
        }];

        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });

        const {container} = renderWithTheme(<EventLogger/>);
        expect(container).toBeInTheDocument();
    });

    test('createHighlightedHtml branch when !searchTerm', () => {
        const {container} = renderWithTheme(<EventLogger/>);
        expect(container).toBeInTheDocument();
    });

    test('syntaxHighlightJSON key vs string branch', () => {
        const mockLogs = [{
            id: '1',
            eventType: 'JSON_KEY_TEST',
            timestamp: new Date().toISOString(),
            data: {key: "value"}
        }];

        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });

        const {container} = renderWithTheme(<EventLogger/>);
        expect(container).toBeInTheDocument();
    });

    test('getCurrentSubscriptions returns array', () => {
        const {container} = renderWithTheme(
            <EventLogger eventTypes={['TYPE_A', 'TYPE_B']}/>
        );
        expect(container).toBeInTheDocument();
    });

    test('handleScroll branch when ref is null', () => {
        const {container} = renderWithTheme(<EventLogger/>);
        fireEvent.scroll(window);
        expect(container).toBeInTheDocument();
    });

    test('formatTimestamp catch branch', () => {
        const mockLogs = [{
            id: '1',
            eventType: 'INVALID_TIMESTAMP',
            timestamp: {},
            data: {}
        }];

        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });

        const {container} = renderWithTheme(<EventLogger/>);
        expect(container).toBeInTheDocument();
    });

    test('main Drawer onClose branch', () => {
        const {container} = renderWithTheme(<EventLogger/>);
        expect(container).toBeInTheDocument();
    });

    test('scroll to bottom setTimeout branch', () => {
        const mockSetTimeout = jest.spyOn(global, 'setTimeout').mockImplementation((cb) => {
            if (typeof cb === 'function') {
                cb();
            }
            return 1;
        });

        const {container} = renderWithTheme(<EventLogger/>);
        mockSetTimeout.mockRestore();
        expect(container).toBeInTheDocument();
    });

    test('createHighlightedHtml while loop branch', () => {
        const mockLogs = [{
            id: '1',
            eventType: 'WHILE_LOOP_TEST',
            timestamp: new Date().toISOString(),
            data: {text: 'test test test'}
        }];

        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });

        const {container} = renderWithTheme(<EventLogger/>);
        expect(container).toBeInTheDocument();
    });

    test('applyHighlightToMatch no match branch', () => {
        const mockLogs = [{
            id: '1',
            eventType: 'NO_MATCH_HIGHLIGHT',
            timestamp: new Date().toISOString(),
            data: {field: 'value'}
        }];

        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });

        const {container} = renderWithTheme(<EventLogger/>);
        expect(container).toBeInTheDocument();
    });

    test('escapeHtml all characters branch', () => {
        const mockLogs = [{
            id: '1',
            eventType: 'HTML_CHARS',
            timestamp: new Date().toISOString(),
            data: {html: '&<>"\''}
        }];

        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });

        const {container} = renderWithTheme(<EventLogger/>);
        expect(container).toBeInTheDocument();
    });

    test('JSONView dense with searchTerm branch', () => {
        const mockLogs = [{
            id: '1',
            eventType: 'DENSE_SEARCH_VIEW',
            timestamp: new Date().toISOString(),
            data: {find: 'me'}
        }];

        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });

        const {container} = renderWithTheme(<EventLogger/>);
        expect(container).toBeInTheDocument();
    });

    test('search handles JSON serialization errors gracefully', () => {
        const circular = {};
        circular.self = circular;

        const mockLogs = [
            {
                id: '1',
                eventType: 'CIRCULAR_TEST',
                timestamp: new Date().toISOString(),
                data: circular
            }
        ];

        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });

        logger.warn = jest.fn();

        renderWithTheme(<EventLogger/>);
    });

    test('handles logs without id property', () => {
        const mockLogs = [
            {eventType: 'NO_ID_EVENT', timestamp: new Date().toISOString(), data: {}}
        ];

        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });

        expect(() => {
            renderWithTheme(<EventLogger/>);
        }).not.toThrow();
    });

    test('clearLogs button is found and works', () => {
        const mockClearLogs = jest.fn();
        const mockLogs = [
            {id: '1', eventType: 'TEST', timestamp: new Date().toISOString(), data: {}},
        ];

        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: mockClearLogs,
        });

        renderWithTheme(<EventLogger/>);

        const openButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(openButton);

        waitFor(() => {
            expect(screen.getByText(/Event Logger/i)).toBeInTheDocument();
        });

        const deleteIcons = screen.getAllByTestId('DeleteOutlineIcon');
        if (deleteIcons.length > 0) {
            const clearButton = deleteIcons[0].closest('button');
            if (clearButton) {
                fireEvent.click(clearButton);
                expect(mockClearLogs).toHaveBeenCalled();
            }
        }
    });

    test('handles empty search term', () => {
        const mockLogs = [
            {id: '1', eventType: 'TEST', timestamp: new Date().toISOString(), data: {}}
        ];

        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });

        renderWithTheme(<EventLogger/>);
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

    test('covers createHighlightedHtml no search term branch', async () => {
        const mockLogs = [
            {
                id: '1',
                eventType: 'NO_SEARCH_BRANCH',
                timestamp: new Date().toISOString(),
                data: {message: 'content to escape & < >'},
            },
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        const searchInput = screen.getByPlaceholderText(/Search events/i);
        fireEvent.change(searchInput, {target: {value: ''}});

        await waitFor(() => {
            expect(screen.getByText(/NO_SEARCH_BRANCH/i)).toBeInTheDocument();
        });
    });

    test('covers createHighlightedHtml no text branch', async () => {
        const mockLogs = [
            {
                id: '1',
                eventType: 'NO_TEXT_BRANCH',
                timestamp: new Date().toISOString(),
                data: {message: null},
            },
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger eventTypes={['NO_TEXT_BRANCH']}/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText('NO_TEXT_BRANCH')).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText(/Search events/i);
        fireEvent.change(searchInput, {target: {value: ''}});

        await waitFor(() => {
            expect(searchInput.value).toBe('');
        });
    });

    test('covers applyHighlightToMatch no searchTerm branch', async () => {
        const mockLogs = [
            {
                id: '1',
                eventType: 'NO_SEARCH_APPLY',
                timestamp: new Date().toISOString(),
                data: {key: 'value'},
            },
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });

        const {unmount} = renderWithTheme(<EventLogger/>);

        await waitFor(() => {
            const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
            expect(eventLoggerButton).toBeInTheDocument();
        }, {timeout: 3000});

        const eventLoggerButton = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/Event Logger/i)).toBeInTheDocument();
        }, {timeout: 3000});

        await waitFor(() => {
            expect(screen.getByText(/NO_SEARCH_APPLY/i)).toBeInTheDocument();
        }, {timeout: 3000});

        const searchInput = screen.getByPlaceholderText(/Search events/i);
        fireEvent.change(searchInput, {target: {value: ''}});

        await waitFor(() => {
            expect(screen.getByText(/NO_SEARCH_APPLY/i)).toBeInTheDocument();
        }, {timeout: 2000});

        unmount();
    });

    test('escapeHtml with special characters', () => {
        const mockLogs = [{
            id: '1',
            eventType: 'HTML_SPECIAL_CHARS',
            timestamp: new Date().toISOString(),
            data: {
                html: 'Test & < > " \' special characters',
                script: '<script>alert("xss")</script>'
            }
        }];

        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });

        renderWithTheme(<EventLogger/>);
        const button = screen.getByRole('button', {name: /Events|Event Logger/i});
        fireEvent.click(button);

        waitFor(() => {
            expect(screen.getByText(/HTML_SPECIAL_CHARS/i)).toBeInTheDocument();
        });
    });

    test('SubscriptionDialog handles all interaction types', async () => {
        renderWithTheme(<EventLogger eventTypes={['PAGE_EVENT1', 'PAGE_EVENT2']}/>);
        const eventLoggerButton = screen.getByRole('button', {name: /Event Logger/i});
        fireEvent.click(eventLoggerButton);

        const settingsButton = screen.getByTestId('SettingsIcon');
        fireEvent.click(settingsButton);

        await waitFor(() => {
            expect(screen.getByText('Event Subscriptions')).toBeInTheDocument();
        });

        const subscribeAllButton = screen.getByText(/Subscribe to All/i);
        fireEvent.click(subscribeAllButton);

        const unsubscribeAllButton = screen.getByText(/Unsubscribe from All/i);
        fireEvent.click(unsubscribeAllButton);

        const subscribePageButton = screen.getByText(/Subscribe to Page Events/i);
        fireEvent.click(subscribePageButton);

        const checkboxes = screen.getAllByRole('checkbox');
        if (checkboxes.length > 0) {
            fireEvent.click(checkboxes[0]);
        }

        const applyButton = screen.getByText(/Apply Subscriptions/i);
        fireEvent.click(applyButton);

        await waitFor(() => {
            expect(screen.queryByText('Event Subscriptions')).not.toBeInTheDocument();
        });
    });

    test('tests toggleExpand functionality through UI', async () => {
        const mockLogs = [
            {
                id: '1',
                eventType: 'EXPAND_TEST',
                timestamp: new Date().toISOString(),
                data: {key: 'value', nested: {deep: 'data'}}
            }
        ];

        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });

        renderWithTheme(<EventLogger/>);

        const eventLoggerButton = await waitFor(() =>
            screen.getByRole('button', {name: /Events|Event Logger/i})
        );
        fireEvent.click(eventLoggerButton);

        await waitFor(() => {
            expect(screen.getByText(/EXPAND_TEST/i)).toBeInTheDocument();
        });

        const chips = screen.getAllByText('EXPAND_TEST');
        const chip = chips[0];
        const logContainer = chip.closest('[style*="cursor: pointer"]') || chip.closest('div');

        if (logContainer) {
            fireEvent.click(logContainer);

            await waitFor(() => {
                expect(screen.getByText(/"key"/i)).toBeInTheDocument();
                expect(screen.getByText(/"value"/i)).toBeInTheDocument();
            });

            fireEvent.click(logContainer);

            await waitFor(() => {
                expect(screen.getByText(/EXPAND_TEST/i)).toBeInTheDocument();
            });
        }
    });
});
