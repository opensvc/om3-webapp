import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Heartbeats, { getStreamStatus } from '../Heartbeats';
import useEventStore from '../../hooks/useEventStore.js';
import useFetchDaemonStatus from '../../hooks/useFetchDaemonStatus.jsx';
import { closeEventSource } from '../../eventSourceManager.jsx';

// Mock MUI icons
jest.mock('@mui/icons-material/Favorite', () => () => <span data-testid="heart-icon" />);
jest.mock('@mui/icons-material/FavoriteBorder', () => () => <span data-testid="heart-broken-icon" />);
jest.mock('@mui/icons-material/HourglassEmpty', () => () => <span data-testid="hourglass-icon" />);
jest.mock('@mui/icons-material/Error', () => () => <span data-testid="error-icon" />);

// Mock CSS
jest.mock('../../styles/main.css', () => ({}));

// Mock hooks
jest.mock('../../hooks/useEventStore.js');
jest.mock('../../hooks/useFetchDaemonStatus.jsx');
jest.mock('../../eventSourceManager.jsx');

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock console
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

// Create a ThemeProvider wrapper
const theme = createTheme();
const renderWithTheme = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('Heartbeats Component', () => {
    const mockFetchNodes = jest.fn();
    const mockStartEventReception = jest.fn();
    const mockCloseEventSource = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        mockLocalStorage.getItem.mockReturnValue('valid-token');
        useFetchDaemonStatus.mockReturnValue({
            fetchNodes: mockFetchNodes,
            startEventReception: mockStartEventReception,
        });
        closeEventSource.mockImplementation(mockCloseEventSource);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('renders Heartbeats title and table when no nodes', async () => {
        useEventStore.mockReturnValue({
            heartbeatStatus: {},
        });

        renderWithTheme(<Heartbeats />);

        expect(screen.getByTestId('heartbeats-title')).toHaveTextContent('Heartbeats');
        expect(screen.getByRole('table')).toBeInTheDocument();
        expect(screen.getByText('Node')).toBeInTheDocument();
        expect(screen.getByText('hb#1 RX')).toBeInTheDocument();
        expect(screen.getByText('hb#1 TX')).toBeInTheDocument();

        console.log('Test 1: DOM after render:');
        screen.debug();
    });

    test('renders static node1 correctly', async () => {
        useEventStore.mockImplementation((selector) => selector({
            heartbeatStatus: {
                node1: {
                    streams: []
                }
            }
        }));

        renderWithTheme(<Heartbeats />);

        await waitFor(() => {
            expect(screen.getByTestId('node-name-node1')).toBeInTheDocument();
            expect(screen.getByTestId('node-row-node1')).toBeInTheDocument();
        }, { timeout: 3000 });
    });

    test('renders nodes and their statuses correctly', async () => {
        useEventStore.mockImplementation((selector) => selector({
            heartbeatStatus: {
                node1: {
                    streams: [
                        { id: 'hb#1.rx', state: 'running', peers: { peer1: { is_beating: true } } },
                        { id: 'hb#1.tx', state: 'running', peers: { peer1: { is_beating: false } } }
                    ]
                },
                node2: {
                    streams: [
                        { id: 'hb#1.rx', state: 'stopped' },
                        { id: 'hb#1.tx', state: 'running', peers: {} }
                    ]
                }
            }
        }));

        renderWithTheme(<Heartbeats />);

        await waitFor(() => {
            expect(screen.getByTestId('node-name-node1')).toBeInTheDocument();
            expect(screen.getByTestId('node-name-node2')).toBeInTheDocument();

            expect(screen.getByTestId('rx-status-node1')).toHaveAttribute('title', 'Beating');
            expect(screen.getByTestId('tx-status-node1')).toHaveAttribute('title', 'Idle');
            expect(screen.getByTestId('rx-status-node2')).toHaveAttribute('title', 'Stopped');
            expect(screen.getByTestId('tx-status-node2')).toHaveAttribute('title', 'Idle');
        }, { timeout: 3000 });
    });

    test('renders unknown status for missing streams', async () => {
        useEventStore.mockImplementation((selector) => selector({
            heartbeatStatus: {
                node1: {
                    streams: []
                }
            }
        }));

        renderWithTheme(<Heartbeats />);

        await waitFor(() => {
            expect(screen.getByTestId('rx-status-node1')).toHaveAttribute('title', 'Unknown');
            expect(screen.getByTestId('tx-status-node1')).toHaveAttribute('title', 'Unknown');
        }, { timeout: 3000 });
    });

    test('calls fetchNodes and startEventReception with token on mount', async () => {
        useEventStore.mockReturnValue({
            heartbeatStatus: {},
        });

        renderWithTheme(<Heartbeats />);

        await waitFor(() => {
            console.log('Test 5: Checking fetchNodes and startEventReception');
            expect(mockLocalStorage.getItem).toHaveBeenCalledWith('authToken');
            expect(mockFetchNodes).toHaveBeenCalledWith('valid-token');
            expect(mockStartEventReception).toHaveBeenCalledWith('valid-token');
        }, { timeout: 5000 });
    });

    test('does not call fetchNodes or startEventReception if no token', async () => {
        mockLocalStorage.getItem.mockReturnValue(null);
        useEventStore.mockReturnValue({
            heartbeatStatus: {},
        });

        renderWithTheme(<Heartbeats />);

        await waitFor(() => {
            console.log('Test 6: Checking no calls without token');
            expect(mockLocalStorage.getItem).toHaveBeenCalledWith('authToken');
            expect(mockFetchNodes).not.toHaveBeenCalled();
            expect(mockStartEventReception).not.toHaveBeenCalled();
        }, { timeout: 5000 });
    });

    test('closes event source on unmount', () => {
        useEventStore.mockReturnValue({
            heartbeatStatus: {},
        });

        const { unmount } = renderWithTheme(<Heartbeats />);
        unmount();

        console.log('Test 7: Checking closeEventSource');
        expect(mockCloseEventSource).toHaveBeenCalled();
    });

    test('getStreamStatus returns correct status and icon for beating stream', () => {
        const stream = {
            state: 'running',
            peers: { peer1: { is_beating: true } },
        };
        const { state, icon } = getStreamStatus(stream);
        expect(state).toBe('Beating');
        expect(icon.props['data-testid']).toBe('heart-icon');
    });

    test('getStreamStatus returns correct status and icon for idle stream', () => {
        const stream = {
            state: 'running',
            peers: { peer1: { is_beating: false } },
        };
        const { state, icon } = getStreamStatus(stream);
        expect(state).toBe('Idle');
        expect(icon.props['data-testid']).toBe('hourglass-icon');
    });

    test('getStreamStatus returns correct status and icon for stopped stream', () => {
        const stream = {
            state: 'stopped',
        };
        const { state, icon } = getStreamStatus(stream);
        expect(state).toBe('Stopped');
        expect(icon.props['data-testid']).toBe('heart-broken-icon');
    });

    test('getStreamStatus returns correct status and icon for unknown stream', () => {
        const stream = null;
        const { state, icon } = getStreamStatus(stream);
        expect(state).toBe('Unknown');
        expect(icon.props['data-testid']).toBe('error-icon');
    });

    test('renders tooltips with correct stream status', async () => {
        const mockHeartbeatStatus = {
            node1: {
                streams: [
                    { id: 'hb#1.rx', state: 'running', peers: { peer1: { is_beating: true } } },
                    { id: 'hb#1.tx', state: 'stopped' },
                ],
            },
        };

        useEventStore.mockImplementation((selector) => selector({
            heartbeatStatus: mockHeartbeatStatus
        }));

        renderWithTheme(<Heartbeats />);

        await waitFor(() => {
            const nodeRow = screen.getByTestId('node-row-node1');

            const rxCell = screen.getByTestId('rx-status-node1');
            const txCell = screen.getByTestId('tx-status-node1');

            expect(rxCell).toHaveAttribute('title', 'Beating');
            expect(txCell).toHaveAttribute('title', 'Stopped');
        }, { timeout: 5000 });
    });
});
