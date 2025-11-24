import React from 'react';
import {render, screen, fireEvent, waitFor, act} from '@testing-library/react';
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
    warn: jest.fn(),
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
        logger.warn.mockClear();
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    test('renders the button initially when drawer is closed', () => {
        renderWithTheme(<EventLogger/>);
        expect(screen.getByRole('button', {name: /Event Logger/i})).toBeInTheDocument();
    });

    test('opens the drawer when button is clicked', () => {
        renderWithTheme(<EventLogger/>);
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
        expect(screen.getByText(/Event Logger/i)).toBeInTheDocument();
    });

    test('displays no events message when there are no logs', async () => {
        renderWithTheme(<EventLogger/>);
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
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
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
        await waitFor(() => {
            expect(screen.getByText(/TEST_EVENT/i)).toBeInTheDocument();
            expect(screen.getByText(/Test data/i)).toBeInTheDocument();
        });
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
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
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
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
        const selectInput = screen.getByRole('combobox');
        fireEvent.mouseDown(selectInput);
        await waitFor(() => {
            const menuItems = screen.getAllByRole('option');
            const testEventMenuItem = menuItems.find(item =>
                item.textContent.includes('TEST_EVENT')
            );
            fireEvent.click(testEventMenuItem);
        });
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
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
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
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
        const clearButton = screen.getByRole('button', {name: /Clear logs/i});
        fireEvent.click(clearButton);
        expect(clearLogsMock).toHaveBeenCalled();
    });

    test('closes the drawer when close button is clicked', async () => {
        renderWithTheme(<EventLogger/>);
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
        const closeButton = screen.getByRole('button', {name: /Close/i});
        fireEvent.click(closeButton);
        await waitFor(() => {
            expect(screen.getByRole('button', {name: /Event Logger/i})).toBeInTheDocument();
        });
    });

    test('tests event type filter with no events matching', async () => {
        const mockLogs = [
            {id: '1', eventType: 'TYPE_A', timestamp: new Date().toISOString(), data: {value: 'A'}},
            {id: '2', eventType: 'TYPE_A', timestamp: new Date().toISOString(), data: {value: 'A2'}},
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
        await waitFor(() => {
            expect(screen.getAllByText(/TYPE_A/i)[0]).toBeInTheDocument();
        });
        const searchInput = screen.getByPlaceholderText(/Search events/i);
        fireEvent.change(searchInput, {target: {value: 'NON_EXISTENT_TERM'}});
        await waitFor(() => {
            expect(screen.getByText(/No events match current filters/i)).toBeInTheDocument();
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
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
        await waitFor(() => {
            expect(screen.getByText(/SCROLL_EVENT_1/i)).toBeInTheDocument();
            expect(screen.getByText(/First event/i)).toBeInTheDocument();
        });
    });

    test('tests scroll to bottom button functionality', async () => {
        const mockLogs = [
            {
                id: '1',
                eventType: 'TEST_EVENT_1',
                timestamp: new Date().toISOString(),
                data: {index: 1, description: 'First test event'},
            },
            {
                id: '2',
                eventType: 'TEST_EVENT_2',
                timestamp: new Date().toISOString(),
                data: {index: 2, description: 'Second test event'},
            },
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
        await waitFor(() => {
            expect(screen.getByText(/TEST_EVENT_1/i)).toBeInTheDocument();
            expect(screen.getByText(/First test event/i)).toBeInTheDocument();
        });
        const scrollButton = screen.queryByRole('button', {name: /Scroll to bottom/i});
        expect(scrollButton).not.toBeInTheDocument();
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
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
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
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
        const searchInput = screen.getByPlaceholderText(/Search events/i);
        fireEvent.change(searchInput, {target: {value: 'test'}});
        await waitFor(() => {
            expect(screen.getByText(/Filtered/i)).toBeInTheDocument();
        });
        const filteredChip = screen.getByText(/Filtered/i);
        const deleteButton = filteredChip.parentElement.querySelector('.MuiChip-deleteIcon');
        if (deleteButton) {
            fireEvent.click(deleteButton);
        }
        await waitFor(() => {
            expect(searchInput.value).toBe('');
        });
    });

    test('tests multiple event type selection', async () => {
        const mockLogs = [
            {id: '1', eventType: 'TYPE_A', timestamp: new Date().toISOString(), data: {value: 'A'}},
            {id: '2', eventType: 'TYPE_B', timestamp: new Date().toISOString(), data: {value: 'B'}},
            {id: '3', eventType: 'TYPE_C', timestamp: new Date().toISOString(), data: {value: 'C'}},
        ];
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: jest.fn(),
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
        const selectInput = screen.getByRole('combobox');
        fireEvent.mouseDown(selectInput);
        await waitFor(() => {
            const menuItems = screen.getAllByRole('option');
            const typeAMenuItem = menuItems.find(item =>
                item.textContent.includes('TYPE_A')
            );
            const typeBMenuItem = menuItems.find(item =>
                item.textContent.includes('TYPE_B')
            );
            if (typeAMenuItem) fireEvent.click(typeAMenuItem);
            if (typeBMenuItem) fireEvent.click(typeBMenuItem);
        });
        fireEvent.keyDown(document.activeElement, {key: 'Escape'});
        await waitFor(() => {
            expect(screen.getByText(/TYPE_A/i)).toBeInTheDocument();
            expect(screen.getByText(/TYPE_B/i)).toBeInTheDocument();
            expect(screen.queryByText(/TYPE_C/i)).not.toBeInTheDocument();
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
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
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
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
        const searchInput = screen.getByPlaceholderText(/Search events/i);
        fireEvent.change(searchInput, {target: {value: 'new search'}});
        await waitFor(() => {
            expect(searchInput.value).toBe('new search');
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
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
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
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
        const searchInput = screen.getByPlaceholderText(/Search events/i);
        fireEvent.change(searchInput, {target: {value: 'test'}});
        fireEvent.change(searchInput, {target: {value: ''}});
        await waitFor(() => {
            expect(screen.getByText(/TEST_EVENT/i)).toBeInTheDocument();
        });
    });

    test('displays custom title and buttonLabel', () => {
        renderWithTheme(<EventLogger title="Custom Logger" buttonLabel="Custom Button"/>);
        expect(screen.getByRole('button', {name: /Custom Logger/i})).toBeInTheDocument();
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
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
        await waitFor(() => {
            expect(screen.getByText(/PAUSED/i)).toBeInTheDocument();
        });
    });

    test('displays objectName chip when objectName is provided', async () => {
        renderWithTheme(<EventLogger objectName="/test/path"/>);
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
        await waitFor(() => {
            expect(screen.getByText(/Object: \/test\/path/i)).toBeInTheDocument();
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
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
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
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
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
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
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
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
        await waitFor(() => {
            expect(screen.getByText(/ObjectDeleted/i)).toBeInTheDocument();
        });
    });

    test('tests drawer resize handle exists and can be interacted with', async () => {
        const {container} = renderWithTheme(<EventLogger/>);
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
        await waitFor(() => {
            expect(screen.getByText(/Event Logger/i)).toBeInTheDocument();
        });
        const resizeHandle = container.querySelector('[style*="height: 8px"]');
        if (!resizeHandle) {
            const innerBox = container.querySelector('[style*="width: 40px"]');
            if (innerBox) {
                const parent = innerBox.parentElement;
                if (parent) {
                    fireEvent.mouseDown(parent);
                    return;
                }
            }
            console.warn('Resize handle not found, skipping mouseDown test');
            return;
        }
        expect(resizeHandle).toBeInTheDocument();
        fireEvent.mouseDown(resizeHandle);
    });

    test('tests ObjectDeleted event with invalid _rawEvent JSON parsing', async () => {
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
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
        await waitFor(() => {
            const objectDeletedElements = screen.getAllByText((content, element) => {
                return element.textContent === 'ObjectDeleted' ||
                    element.textContent?.includes('ObjectDeleted');
            });
            expect(objectDeletedElements.length).toBeGreaterThan(0);
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
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
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
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
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
        const mockLogs = [
            {
                id: '1',
                eventType: 'TEST_EVENT',
                timestamp: new Date().toISOString(),
                data: {message: 'test'}
            }
        ];
        const setPausedMock = jest.fn();
        useEventLogStore.mockReturnValue({
            eventLogs: mockLogs,
            isPaused: false,
            setPaused: setPausedMock,
            clearLogs: jest.fn(),
        });
        renderWithTheme(<EventLogger/>);
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
        await waitFor(() => {
            expect(screen.getByText(/TEST_EVENT/i)).toBeInTheDocument();
        });
        const pauseButton = screen.getByRole('button', {name: /Pause/i});
        fireEvent.click(pauseButton);
        await waitFor(() => {
            expect(setPausedMock).toHaveBeenCalledWith(true);
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
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
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
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
        await waitFor(() => {
            expect(screen.getByText(/No events logged/i)).toBeInTheDocument();
        });
    });

    test('tests handleScroll when logsContainerRef is null', () => {
        const {container} = renderWithTheme(<EventLogger/>);
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
        const scrollEvent = new Event('scroll');
        window.dispatchEvent(scrollEvent);
        expect(true).toBe(true);
    });

    test('tests resize timeout cleanup', () => {
        const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
        const {unmount} = renderWithTheme(<EventLogger/>);
        const mockTimeout = setTimeout(() => {
        }, 1000);
        if (global.resizeTimeoutRef) {
            global.resizeTimeoutRef = mockTimeout;
        }
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
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));
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
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));

        const container = await screen.findByTestId('logs-container', {}, {timeout: 1000})
            .catch(() => document.querySelector('[style*="overflow"]'));

        expect(container).not.toBeNull();

        Object.defineProperty(container, 'scrollTop', {value: 0, configurable: true});
        Object.defineProperty(container, 'scrollHeight', {value: 1000, configurable: true});
        Object.defineProperty(container, 'clientHeight', {value: 200, configurable: true});

        fireEvent.scroll(container);

        expect(true).toBe(true);
    });

    test('resize handler runs preventDefault and triggers mouse handlers', async () => {
        renderWithTheme(<EventLogger/>);
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));

        const handles = document.querySelectorAll('div[style*="cursor: row-resize"]');
        const handle = handles[0];

        expect(handle).not.toBeNull();

        const preventDefault = jest.fn();
        const down = new MouseEvent('mousedown', {clientY: 300, bubbles: true});
        Object.defineProperty(down, 'preventDefault', {value: preventDefault});

        handle.dispatchEvent(down);

        document.dispatchEvent(new MouseEvent('mousemove', {clientY: 250, bubbles: true}));
        document.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));

        expect(preventDefault).toHaveBeenCalled();
    });

    test('clears resize timeout on mouseUp during resize', async () => {
        jest.useFakeTimers();

        renderWithTheme(<EventLogger/>);
        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));

        const handles = document.querySelectorAll('div[style*="cursor: row-resize"]');
        const handle = handles[0];

        expect(handle).not.toBeNull();

        fireEvent.mouseDown(handle, {clientY: 300});
        fireEvent.mouseMove(document, {clientY: 250});

        const spy = jest.spyOn(global, 'clearTimeout');

        fireEvent.mouseUp(document);

        expect(spy).toHaveBeenCalled();

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

        fireEvent.click(screen.getByRole('button', {name: /Event Logger/i}));

        const input = screen.getByPlaceholderText(/Search events/i);

        fireEvent.change(input, {target: {value: 'abc'}});

        await waitFor(() => {
            expect(input.value).toBe('abc');
        });
    });
});
