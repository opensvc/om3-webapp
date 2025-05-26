import React from 'react';
import {render, screen, fireEvent, waitFor, act, within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import Namespaces from '../Namespaces';
import useEventStore from '../../hooks/useEventStore.js';
import useFetchDaemonStatus from '../../hooks/useFetchDaemonStatus.jsx';
import {closeEventSource} from '../../eventSourceManager.jsx';

// Mock dependencies
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: jest.fn(),
}));
jest.mock('../../hooks/useEventStore.js');
jest.mock('../../hooks/useFetchDaemonStatus.jsx');
jest.mock('../../eventSourceManager.jsx', () => ({
    closeEventSource: jest.fn(),
    startEventReception: jest.fn(),
}));

// Mock Material-UI components to add data-testid
jest.mock('@mui/material', () => ({
    ...jest.requireActual('@mui/material'),
    Box: ({children, ...props}) => (
        <div data-testid="box" {...props}>{children}</div>
    ),
    Table: ({children, ...props}) => (
        <table data-testid="table" {...props}>{children}</table>
    ),
    TableHead: ({children, ...props}) => (
        <thead data-testid="table-head" {...props}>{children}</thead>
    ),
    TableBody: ({children, ...props}) => (
        <tbody data-testid="table-body" {...props}>{children}</tbody>
    ),
    TableRow: ({children, onClick, ...props}) => (
        <tr data-testid="table-row" onClick={onClick} {...props}>{children}</tr>
    ),
    TableCell: ({children, ...props}) => (
        <td data-testid="table-cell" {...props}>{children}</td>
    ),
    TableContainer: ({children, ...props}) => (
        <div data-testid="table-container" {...props}>{children}</div>
    ),
    Typography: ({children, ...props}) => (
        <div data-testid="typography" {...props}>{children}</div>
    ),
    Paper: ({children, ...props}) => (
        <div data-testid="paper" {...props}>{children}</div>
    ),
}));

// Mock FiberManualRecordIcon separately
jest.mock('@mui/icons-material/FiberManualRecord', () => ({
    __esModule: true,
    default: ({sx = {}, ...props}) => {
        const color = typeof sx.color === 'string' ? sx.color : 'inherit';
        return <span data-testid="status-icon" style={{color}} {...props} />;
    },
}));

describe('Namespaces Component', () => {
    const mockFetchNodes = jest.fn(() => {
    });
    const mockStartEventReception = jest.fn(() => {
    });
    const mockCloseEventSource = jest.fn(() => {
    });
    const mockNavigate = jest.fn();

    beforeEach(() => {
        jest.setTimeout(10000);
        jest.clearAllMocks();

        Storage.prototype.getItem = jest.fn(() => 'mock-token');
        Storage.prototype.setItem = jest.fn();
        Storage.prototype.removeItem = jest.fn();

        require('react-router-dom').useNavigate.mockReturnValue(mockNavigate);

        useFetchDaemonStatus.mockReturnValue({
            fetchNodes: mockFetchNodes,
            startEventReception: mockStartEventReception,
        });

        const mockState = {
            objectStatus: {
                'root/svc/service1': {avail: 'up'},
                'root/svc/service2': {avail: 'down'},
                'prod/svc/service3': {avail: 'warn'},
                'prod/svc/service4': {avail: 'up'},
            },
        };
        useEventStore.mockImplementation((selector) => selector(mockState));

        require('../../eventSourceManager.jsx').closeEventSource.mockImplementation(mockCloseEventSource);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('renders title and table structure', async () => {
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Namespaces Status Overview')).toBeInTheDocument();
            expect(screen.getByTestId('table')).toBeInTheDocument();
            expect(screen.getByTestId('table-head')).toBeInTheDocument();
            expect(screen.getByTestId('table-body')).toBeInTheDocument();
        });
    });

    test('renders namespaces with correct status counts', async () => {
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );

        await waitFor(() => {
            const rootRow = screen.getByText('root').closest('tr');
            const rootCells = within(rootRow).getAllByTestId('table-cell');
            expect(rootCells[1]).toHaveTextContent('1'); // Up
            expect(rootCells[2]).toHaveTextContent('1'); // Down
            expect(rootCells[3]).toHaveTextContent('0'); // Warn
            expect(rootCells[4]).toHaveTextContent('0'); // Unknown
            expect(rootCells[5]).toHaveTextContent('2'); // Total

            const prodRow = screen.getByText('prod').closest('tr');
            const prodCells = within(prodRow).getAllByTestId('table-cell');
            expect(prodCells[1]).toHaveTextContent('1'); // Up
            expect(prodCells[2]).toHaveTextContent('0'); // Down
            expect(prodCells[3]).toHaveTextContent('1'); // Warn
            expect(prodCells[4]).toHaveTextContent('0'); // Unknown
            expect(prodCells[5]).toHaveTextContent('2'); // Total
        });
    });

    test('displays correct status icons with colors', async () => {
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );

        await waitFor(() => {
            const rootRow = screen.getByText('root').closest('tr');
            const rootIcons = within(rootRow).getAllByTestId('status-icon');
            expect(rootIcons).toHaveLength(4);
            expect(rootIcons[0]).toHaveStyle({color: '#4caf50'}); // Up
            expect(rootIcons[1]).toHaveStyle({color: '#f44336'}); // Down
            expect(rootIcons[2]).toHaveStyle({color: '#ff9800'}); // Warn
            expect(rootIcons[3]).toHaveStyle({color: '#9e9e9e'}); // Unknown

            const prodRow = screen.getByText('prod').closest('tr');
            const prodIcons = within(prodRow).getAllByTestId('status-icon');
            expect(prodIcons).toHaveLength(4);
            expect(prodIcons[0]).toHaveStyle({color: '#4caf50'}); // Up
            expect(prodIcons[1]).toHaveStyle({color: '#f44336'}); // Down
            expect(prodIcons[2]).toHaveStyle({color: '#ff9800'}); // Warn
            expect(prodIcons[3]).toHaveStyle({color: '#9e9e9e'}); // Unknown
        });
    });

    test('navigates to objects page with namespace on row click', async () => {
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );

        await waitFor(() => {
            const row = screen.getByText('root').closest('tr');
            fireEvent.click(row);
            expect(mockNavigate).toHaveBeenCalledWith('/objects?namespace=root');
        });
    });

    test('navigates to objects page with namespace and status on status cell click', async () => {
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );

        await waitFor(() => {
            const rootRow = screen.getByText('root').closest('tr');
            const statusCells = within(rootRow).getAllByTestId('table-cell');
            const unknownCell = statusCells[4]; // Unknown status cell
            fireEvent.click(unknownCell);
            expect(mockNavigate).toHaveBeenCalledWith('/objects?namespace=root&globalState=unknown');
        });
    });

    test('calls fetchNodes and startEventReception on mount with auth token', async () => {
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockFetchNodes).toHaveBeenCalledWith('mock-token');
            expect(mockStartEventReception).toHaveBeenCalledWith('mock-token');
        });
    });

    test('calls closeEventSource on unmount', async () => {
        const {unmount} = render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );

        await act(async () => {
            unmount();
        });

        await waitFor(() => {
            expect(mockCloseEventSource).toHaveBeenCalled();
        });
    });

    test('does not call fetchNodes or startEventReception without auth token', async () => {
        Storage.prototype.getItem = jest.fn(() => null);

        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockFetchNodes).not.toHaveBeenCalled();
            expect(mockStartEventReception).not.toHaveBeenCalled();
        });
    });

    test('displays no namespaces message when no data is available', async () => {
        useEventStore.mockImplementation((selector) => selector({objectStatus: {}}));

        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Namespaces Status Overview')).toBeInTheDocument();
            expect(screen.getByText(/No namespaces available/i)).toBeInTheDocument();
            expect(screen.getByTestId('table-body').children).toHaveLength(1);
        });
    });

    test('handles malformed objectStatus data', async () => {
        useEventStore.mockImplementation((selector) =>
            selector({
                objectStatus: {
                    'invalid': { avail: 'error' }, // Invalid key, assigned to 'root' with 'unknown'
                    'prod/svc/valid': { avail: 'up' },
                },
            })
        );

        render(
            <MemoryRouter>
                <Namespaces />
            </MemoryRouter>
        );

        await waitFor(() => {
            // Vérifier le namespace 'prod'
            const prodRow = screen.getByText('prod').closest('tr');
            const prodCells = within(prodRow).getAllByTestId('table-cell');
            expect(prodCells[1]).toHaveTextContent('1'); // Up
            expect(prodCells[2]).toHaveTextContent('0'); // Down
            expect(prodCells[3]).toHaveTextContent('0'); // Warn
            expect(prodCells[4]).toHaveTextContent('0'); // Unknown
            expect(prodCells[5]).toHaveTextContent('1'); // Total

            // Vérifier le namespace 'root' pour la clé 'invalid'
            const rootRow = screen.getByText('root').closest('tr');
            const rootCells = within(rootRow).getAllByTestId('table-cell');
            expect(rootCells[1]).toHaveTextContent('0'); // Up
            expect(rootCells[2]).toHaveTextContent('0'); // Down
            expect(rootCells[3]).toHaveTextContent('0'); // Warn
            expect(rootCells[4]).toHaveTextContent('1'); // Unknown (from 'error')
            expect(rootCells[5]).toHaveTextContent('1'); // Total
        });
    });
});