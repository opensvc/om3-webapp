import React from 'react';
import {render, screen, waitFor, within} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import Heartbeats, {getStreamStatus} from '../Heartbeats';
import useEventStore from '../../hooks/useEventStore.js';
import useFetchDaemonStatus from '../../hooks/useFetchDaemonStatus.jsx';
import {closeEventSource} from '../../eventSourceManager.jsx';

// Mock MUI icons to return spans with aria-label and color
jest.mock('@mui/icons-material/Favorite', () => () => (
    <span aria-label="Beating stream" style={{color: 'rgb(211, 47, 47)'}}/> // error color
));
jest.mock('@mui/icons-material/FavoriteBorder', () => () => (
    <span aria-label="Stopped stream" style={{color: 'rgb(117, 117, 117)'}}/> // action color
));
jest.mock('@mui/icons-material/HourglassEmpty', () => () => (
    <span aria-label="Idle stream" style={{color: 'rgb(189, 189, 189)'}}/> // disabled color
));
jest.mock('@mui/icons-material/Error', () => () => (
    <span aria-label="Unknown stream status" style={{color: 'rgb(189, 189, 189)'}}/> // disabled color
));

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
Object.defineProperty(window, 'localStorage', {value: mockLocalStorage});

// Mock console
jest.spyOn(console, 'log').mockImplementation(() => {
});
jest.spyOn(console, 'error').mockImplementation(() => {
});

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

        renderWithTheme(<Heartbeats/>);

        expect(screen.getByRole('heading', {name: /Heartbeats/i})).toHaveTextContent('Heartbeats');
        expect(screen.getByRole('table', {name: /heartbeats table/i})).toBeInTheDocument();
        expect(screen.getByText('Node')).toBeInTheDocument();
        expect(screen.getByText('hb#1 RX')).toBeInTheDocument();
        expect(screen.getByText('hb#1 TX')).toBeInTheDocument();
    });

    test('renders static node1 correctly', async () => {
        useEventStore.mockImplementation((selector) => selector({
            heartbeatStatus: {
                node1: {
                    streams: []
                }
            }
        }));

        renderWithTheme(<Heartbeats/>);

        await waitFor(() => {
            const nodeRow = screen.getByRole('row', {name: /Node node1 heartbeat row/i});
            const nodeCell = within(nodeRow).getByRole('cell', {name: /Node node1 name/i});
            expect(nodeCell).toHaveTextContent('node1');
        }, {timeout: 3000});
    });

    test('renders nodes and their statuses correctly', async () => {
        useEventStore.mockImplementation((selector) => selector({
            heartbeatStatus: {
                node1: {
                    streams: [
                        {id: 'hb#1.rx', state: 'running', peers: {peer1: {is_beating: true}}},
                        {id: 'hb#1.tx', state: 'running', peers: {peer1: {is_beating: false}}}
                    ]
                },
                node2: {
                    streams: [
                        {id: 'hb#1.rx', state: 'stopped'},
                        {id: 'hb#1.tx', state: 'running', peers: {}}
                    ]
                }
            }
        }));

        renderWithTheme(<Heartbeats/>);

        await waitFor(() => {
            const node1Row = screen.getByRole('row', {name: /Node node1 heartbeat row/i});
            const node2Row = screen.getByRole('row', {name: /Node node2 heartbeat row/i});

            const node1RxCell = within(node1Row).getByRole('cell', {name: /RX status: Beating/i});
            const node1TxCell = within(node1Row).getByRole('cell', {name: /TX status: Idle/i});
            const node2RxCell = within(node2Row).getByRole('cell', {name: /RX status: Stopped/i});
            const node2TxCell = within(node2Row).getByRole('cell', {name: /TX status: Idle/i});

            expect(node1RxCell).toHaveAttribute('title', 'Beating');
            expect(node1TxCell).toHaveAttribute('title', 'Idle');
            expect(node2RxCell).toHaveAttribute('title', 'Stopped');
            expect(node2TxCell).toHaveAttribute('title', 'Idle');
        }, {timeout: 3000});
    });

    test('renders unknown status for missing streams', async () => {
        useEventStore.mockImplementation((selector) => selector({
            heartbeatStatus: {
                node1: {
                    streams: []
                }
            }
        }));

        renderWithTheme(<Heartbeats/>);

        await waitFor(() => {
            const nodeRow = screen.getByRole('row', {name: /Node node1 heartbeat row/i});
            const rxCell = within(nodeRow).getByRole('cell', {name: /RX status: Unknown/i});
            const txCell = within(nodeRow).getByRole('cell', {name: /TX status: Unknown/i});

            expect(rxCell).toHaveAttribute('title', 'Unknown');
            expect(txCell).toHaveAttribute('title', 'Unknown');
        }, {timeout: 3000});
    });

    test('calls fetchNodes and startEventReception with token on mount', async () => {
        useEventStore.mockReturnValue({
            heartbeatStatus: {},
        });

        renderWithTheme(<Heartbeats/>);

        await waitFor(() => {
            expect(mockLocalStorage.getItem).toHaveBeenCalledWith('authToken');
            expect(mockFetchNodes).toHaveBeenCalledWith('valid-token');
            expect(mockStartEventReception).toHaveBeenCalledWith('valid-token');
        }, {timeout: 5000});
    });

    test('does not call fetchNodes or startEventReception if no token', async () => {
        mockLocalStorage.getItem.mockReturnValue(null);
        useEventStore.mockReturnValue({
            heartbeatStatus: {},
        });

        renderWithTheme(<Heartbeats/>);

        await waitFor(() => {
            expect(mockLocalStorage.getItem).toHaveBeenCalledWith('authToken');
            expect(mockFetchNodes).not.toHaveBeenCalled();
            expect(mockStartEventReception).not.toHaveBeenCalled();
        }, {timeout: 5000});
    });

    test('closes event source on unmount', () => {
        useEventStore.mockReturnValue({
            heartbeatStatus: {},
        });

        const {unmount} = renderWithTheme(<Heartbeats/>);
        unmount();

        expect(mockCloseEventSource).toHaveBeenCalled();
    });

    test('getStreamStatus returns correct status and icon for beating stream', () => {
        const stream = {
            state: 'running',
            peers: {peer1: {is_beating: true}},
        };
        const {state, icon} = getStreamStatus(stream);
        expect(state).toBe('Beating');
        expect(icon.props['aria-label']).toBe('Beating stream');
        expect(icon.props.color).toBe('error');
    });

    test('getStreamStatus returns correct status and icon for idle stream', () => {
        const stream = {
            state: 'running',
            peers: {peer1: {is_beating: false}},
        };
        const {state, icon} = getStreamStatus(stream);
        expect(state).toBe('Idle');
        expect(icon.props['aria-label']).toBe('Idle stream');
        expect(icon.props.color).toBe('disabled');
    });

    test('getStreamStatus returns correct status and icon for stopped stream', () => {
        const stream = {
            state: 'stopped',
        };
        const {state, icon} = getStreamStatus(stream);
        expect(state).toBe('Stopped');
        expect(icon.props['aria-label']).toBe('Stopped stream');
        expect(icon.props.color).toBe('action');
    });

    test('getStreamStatus returns correct status and icon for unknown stream', () => {
        const stream = null;
        const {state, icon} = getStreamStatus(stream);
        expect(state).toBe('Unknown');
        expect(icon.props['aria-label']).toBe('Unknown stream status');
        expect(icon.props.color).toBe('disabled');
    });

    test('renders tooltips with correct stream status', async () => {
        const mockHeartbeatStatus = {
            node1: {
                streams: [
                    {id: 'hb#1.rx', state: 'running', peers: {peer1: {is_beating: true}}},
                    {id: 'hb#1.tx', state: 'stopped'},
                ],
            },
        };

        useEventStore.mockImplementation((selector) => selector({
            heartbeatStatus: mockHeartbeatStatus
        }));

        renderWithTheme(<Heartbeats/>);

        await waitFor(() => {
            const nodeRow = screen.getByRole('row', {name: /Node node1 heartbeat row/i});
            const rxCell = within(nodeRow).getByRole('cell', {name: /RX status: Beating/i});
            const txCell = within(nodeRow).getByRole('cell', {name: /TX status: Stopped/i});

            expect(rxCell).toHaveAttribute('title', 'Beating');
            expect(txCell).toHaveAttribute('title', 'Stopped');
        }, {timeout: 5000});
    });
});