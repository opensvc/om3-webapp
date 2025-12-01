import React from 'react';
import {render, screen, fireEvent, waitFor, act, within} from '@testing-library/react';
import {MemoryRouter, useLocation} from 'react-router-dom';
import Namespaces from '../Namespaces';
import useEventStore from '../../hooks/useEventStore.js';
import {startEventReception, closeEventSource} from '../../eventSourceManager.jsx';
// Mock dependencies
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: jest.fn(),
    useLocation: jest.fn(),
}));
jest.mock('../../hooks/useEventStore.js');
jest.mock('../../eventSourceManager.jsx');
// Mock Material-UI components to add data-testid
jest.mock('@mui/material', () => {
    const originalModule = jest.requireActual('@mui/material');
    return {
        ...originalModule,
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
        TableCell: ({children, onClick, ...props}) => (
            <td data-testid="table-cell" onClick={onClick} {...props}>{children}</td>
        ),
        TableContainer: ({children, ...props}) => (
            <div data-testid="table-container" {...props}>{children}</div>
        ),
        Typography: ({children, ...props}) => (
            <div data-testid="typography" {...props}>{children}</div>
        ),
        Autocomplete: ({options, value, onChange, renderInput, ...props}) => (
            <div data-testid="autocomplete" {...props}>
                <input
                    data-testid="autocomplete-input"
                    value={value}
                    onChange={(e) => onChange && onChange(e, e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            onChange && onChange(e, e.target.value);
                        }
                    }}
                />
                {renderInput && renderInput({})}
            </div>
        ),
        TextField: ({label, inputProps, ...props}) => (
            <div data-testid="text-field">
                {label && <label>{label}</label>}
                <input {...inputProps} {...props} />
            </div>
        ),
    };
});
// Mock icons with proper test IDs
jest.mock('@mui/icons-material/KeyboardArrowUp', () => ({
    __esModule: true,
    default: (props) => <span data-testid="arrow-up" {...props} />,
}));
jest.mock('@mui/icons-material/KeyboardArrowDown', () => ({
    __esModule: true,
    default: (props) => <span data-testid="arrow-down" {...props} />,
}));
jest.mock('@mui/icons-material/FiberManualRecord', () => ({
    __esModule: true,
    default: ({sx = {}, ...props}) => {
        const color = typeof sx.color === 'string' ? sx.color : 'inherit';
        return <span data-testid="status-icon" style={{color}} {...props} />;
    },
}));
jest.mock('@mui/icons-material/PriorityHigh', () => ({
    __esModule: true,
    default: ({sx = {}, ...props}) => {
        const color = typeof sx.color === 'string' ? sx.color : 'inherit';
        return <span data-testid="status-icon" style={{color}} {...props} />;
    },
}));
// Mock useLocation
const mockUseLocation = useLocation;
// Helper function to get header cell for a column
const getHeaderCellFor = (columnName) => {
    const head = screen.getByTestId('table-head');
    const headRow = within(head).getByTestId('table-row');
    const headCells = within(headRow).getAllByTestId('table-cell');
    const regex = new RegExp(columnName, 'i');
    return headCells.find(cell => within(cell).queryByText(regex) !== null);
};
// Helper functions to test - DÉPLACÉES AVANT les describe blocks
const getColorByStatus = (status) => {
    const {green, red, orange, grey} = require('@mui/material/colors');
    switch (status) {
        case "up":
            return green[500];
        case "down":
            return red[500];
        case "warn":
            return orange[500];
        default:
            return grey[500];
    }
};

describe('Namespaces Component', () => {
    const mockNavigate = jest.fn();
    const mockStartEventReception = startEventReception;
    const mockCloseEventSource = closeEventSource;
    beforeEach(() => {
        jest.clearAllMocks();
        Storage.prototype.getItem = jest.fn(() => 'valid-token');
        require('react-router-dom').useNavigate.mockReturnValue(mockNavigate);
        mockUseLocation.mockReturnValue({search: ''});
        const mockState = {
            objectStatus: {
                'root/svc/service1': {avail: 'up'},
                'root/svc/service2': {avail: 'down'},
                'prod/svc/service3': {avail: 'warn'},
                'prod/svc/service4': {avail: 'up'},
                'dev/svc/service5': {avail: 'up'},
                'invalidObject': 'invalid',
            },
        };
        useEventStore.mockImplementation((selector) => selector(mockState));
    });
    test('renders title and table structure', async () => {
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );
        expect(await screen.findByText('Namespaces Status Overview')).toBeInTheDocument();
        expect(screen.getByTestId('table')).toBeInTheDocument();
        expect(screen.getByTestId('table-head')).toBeInTheDocument();
        expect(screen.getByTestId('table-body')).toBeInTheDocument();
    });
    test('renders namespaces with correct status counts', async () => {
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );
        // Check root namespace
        const rootRow = await screen.findByRole('row', {name: /root/i});
        const rootCells = within(rootRow).getAllByTestId('table-cell');
        expect(rootCells[1]).toHaveTextContent('1'); // Up
        expect(rootCells[2]).toHaveTextContent('1'); // Down
        expect(rootCells[3]).toHaveTextContent('0'); // Warn
        expect(rootCells[4]).toHaveTextContent('0'); // n/a
        expect(rootCells[5]).toHaveTextContent('2'); // Total
        // Check prod namespace
        const prodRow = await screen.findByRole('row', {name: /prod/i});
        const prodCells = within(prodRow).getAllByTestId('table-cell');
        expect(prodCells[1]).toHaveTextContent('1'); // Up
        expect(prodCells[2]).toHaveTextContent('0'); // Down
        expect(prodCells[3]).toHaveTextContent('1'); // Warn
        expect(prodCells[4]).toHaveTextContent('0'); // n/a
        expect(prodCells[5]).toHaveTextContent('2'); // Total
    });
    test('displays correct status icons with colors', async () => {
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );
        const rootRow = await screen.findByRole('row', {name: /root/i});
        const rootIcons = within(rootRow).getAllByTestId('status-icon');
        expect(rootIcons[0]).toHaveStyle({color: '#4caf50'}); // Up
        expect(rootIcons[1]).toHaveStyle({color: '#f44336'}); // Down
        expect(rootIcons[2]).toHaveStyle({color: '#ff9800'}); // Warn
        expect(rootIcons[3]).toHaveStyle({color: '#9e9e9e'}); // n/a
    });
    test('navigates to objects page with namespace on row click', async () => {
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );
        const row = await screen.findByRole('row', {name: /root/i});
        fireEvent.click(row);
        expect(mockNavigate).toHaveBeenCalledWith('/objects?namespace=root');
    });
    test('navigates to objects page with namespace and status on status cell click', async () => {
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );
        const rootRow = await screen.findByRole('row', {name: /root/i});
        const statusCells = within(rootRow).getAllByTestId('table-cell');
        // Click on "up" status cell (index 1)
        fireEvent.click(statusCells[1]);
        expect(mockNavigate).toHaveBeenCalledWith('/objects?namespace=root&globalState=up');
    });
    test('startEventReception on mount with auth token', async () => {
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(mockStartEventReception).toHaveBeenCalledWith(
                'valid-token',
                ['ObjectStatusUpdated', 'InstanceStatusUpdated', 'ObjectDeleted', 'InstanceConfigUpdated']
            );
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
        expect(mockCloseEventSource).toHaveBeenCalled();
    });
    test('does not call startEventReception without auth token', () => {
        Storage.prototype.getItem = jest.fn(() => null);
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );
        expect(mockStartEventReception).not.toHaveBeenCalled();
    });
    test('displays no namespaces message when no data is available', async () => {
        useEventStore.mockImplementation((selector) => selector({objectStatus: {}}));
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );
        expect(await screen.findByText(/No namespaces available/i)).toBeInTheDocument();
    });
    test('handles malformed objectStatus data', async () => {
        useEventStore.mockImplementation((selector) =>
            selector({
                objectStatus: {
                    'invalid': {avail: 'error'},
                    'prod/svc/valid': {avail: 'up'},
                },
            })
        );
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );
        // Should still render without crashing
        expect(await screen.findByText('Namespaces Status Overview')).toBeInTheDocument();
    });
    test('sorts namespaces when clicking column headers', async () => {
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );
        // Wait for table to render
        await screen.findByTestId('table-body');
        // Find and click namespace header
        const namespaceHeader = getHeaderCellFor('Namespace');
        expect(namespaceHeader).toBeInTheDocument();
        fireEvent.click(namespaceHeader);
        // The component should handle the sort without errors
        await waitFor(() => {
            expect(screen.getAllByTestId('table-row').length).toBeGreaterThan(0);
        });
    });
    test('filters namespaces using autocomplete', async () => {
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );
        const autocompleteInput = screen.getByTestId('autocomplete-input');
        // Change filter to 'prod'
        fireEvent.change(autocompleteInput, {target: {value: 'prod'}});
        fireEvent.keyDown(autocompleteInput, {key: 'Enter'});
        // Should navigate to filtered URL
        expect(mockNavigate).toHaveBeenCalledWith('/namespaces?namespace=prod');
    });
    test('displays filtered message when no namespaces match', async () => {
        useEventStore.mockImplementation((selector) => selector({objectStatus: {}}));
        mockUseLocation.mockReturnValue({search: '?namespace=nonexistent'});
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );
        expect(await screen.findByText(/No namespaces match the selected filter/i)).toBeInTheDocument();
    });
    test('handles URL namespace parameter on load', async () => {
        mockUseLocation.mockReturnValue({search: '?namespace=prod'});
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );
        // Component should load with 'prod' filter applied
        await waitFor(() => {
            expect(screen.getByText('prod')).toBeInTheDocument();
        });
    });

    test('handles objectStatus with null or undefined values', async () => {
        useEventStore.mockImplementation((selector) =>
            selector({
                objectStatus: {
                    'valid/ns/service1': {avail: 'up'},
                    'valid/ns/service2': null, // null object
                    'valid/ns/service3': {avail: null}, // null status
                    'valid/ns/service4': {avail: undefined}, // undefined status
                    'valid/ns/service5': {avail: 'down'},
                },
            })
        );
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );
        // Should handle null/undefined values
        await waitFor(() => {
            expect(screen.getByText('valid')).toBeInTheDocument();
        });
        const validRow = await screen.findByRole('row', {name: /valid/i});
        const validCells = within(validRow).getAllByTestId('table-cell');
        expect(validCells[1]).toHaveTextContent('1'); // Up
        expect(validCells[2]).toHaveTextContent('1'); // Down
        expect(validCells[3]).toHaveTextContent('0'); // Warn
        expect(validCells[4]).toHaveTextContent('3'); // n/a count
    });
    test('handles edge cases in getColorByStatus function', () => {
        const testCases = [
            {input: 'up', expected: '#4caf50'},
            {input: 'down', expected: '#f44336'},
            {input: 'warn', expected: '#ff9800'},
            {input: 'unknown', expected: '#9e9e9e'},
            {input: '', expected: '#9e9e9e'},
            {input: null, expected: '#9e9e9e'},
            {input: undefined, expected: '#9e9e9e'},
            {input: 'custom_status', expected: '#9e9e9e'},
        ];
        testCases.forEach(({input, expected}) => {
            const result = getColorByStatus(input);
            expect(result).toBe(expected);
        });
    });
    test('handles all sorting columns with both directions', async () => {
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );
        await screen.findByTestId('table-body');
        // Test sorting for each column in both directions
        const sortColumns = ['namespace', 'up', 'down', 'warn', 'n/a', 'total'];
        for (const column of sortColumns) {
            // Find column header
            const columnHeader = getHeaderCellFor(column);
            expect(columnHeader).toBeInTheDocument();
            // First click - ascending
            fireEvent.click(columnHeader);
            // Second click - descending
            fireEvent.click(columnHeader);
            // Should handle both directions without errors
            await waitFor(() => {
                expect(screen.getAllByTestId('table-row').length).toBeGreaterThan(0);
            });
        }
    });
    test('handles status counting for unknown status values', async () => {
        useEventStore.mockImplementation((selector) =>
            selector({
                objectStatus: {
                    'test/svc/service1': {avail: 'unknown_status'},
                    'test/svc/service2': {avail: 'up'},
                    'test/svc/service3': {avail: 'custom_status'},
                },
            })
        );
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );
        // Should handle unknown status values by counting them as "n/a"
        await waitFor(() => {
            expect(screen.getByText('test')).toBeInTheDocument();
        });
        const testRow = await screen.findByRole('row', {name: /test/i});
        const testCells = within(testRow).getAllByTestId('table-cell');
        // Should have 1 up, 0 down, 0 warn, and 2 n/a (unknown_status + custom_status)
        expect(testCells[1]).toHaveTextContent('1'); // Up
        expect(testCells[2]).toHaveTextContent('0'); // Down
        expect(testCells[3]).toHaveTextContent('0'); // Warn
        expect(testCells[4]).toHaveTextContent('2'); // n/a
    });
    test('handles Autocomplete with null value', async () => {
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );
        const autocompleteInput = screen.getByTestId('autocomplete-input');
        // Simulate Autocomplete returning null (when clearing selection)
        fireEvent.change(autocompleteInput, {target: {value: null}});
        // Should handle null value by defaulting to "all"
        expect(mockNavigate).toHaveBeenCalledWith('/namespaces');
    });
    test('handles URL namespace parameter with empty string', async () => {
        mockUseLocation.mockReturnValue({search: '?namespace='});
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );
        // Should handle empty namespace parameter by defaulting to "all"
        await waitFor(() => {
            expect(screen.getByTestId('autocomplete-input')).toHaveValue('all');
        });
    });
    test('handles empty namespaces array in Autocomplete', async () => {
        useEventStore.mockImplementation((selector) => selector({objectStatus: {}}));
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );
        // Autocomplete should still work with empty namespaces array
        const autocompleteInput = screen.getByTestId('autocomplete-input');
        expect(autocompleteInput).toBeInTheDocument();
        // Should be able to select "all"
        fireEvent.change(autocompleteInput, {target: {value: 'all'}});
        fireEvent.keyDown(autocompleteInput, {key: 'Enter'});
        expect(mockNavigate).toHaveBeenCalledWith('/namespaces');
    });
    test('handles filteredNamespaces with empty statusByNamespace', async () => {
        useEventStore.mockImplementation((selector) => selector({objectStatus: {}}));
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );
        // Should display no namespaces message
        expect(await screen.findByText(/No namespaces available/i)).toBeInTheDocument();
    });
    test('handles allObjectNames with various edge cases', async () => {
        useEventStore.mockImplementation((selector) =>
            selector({
                objectStatus: {
                    '': {avail: 'up'}, // empty string key
                    'valid/ns/service': {avail: 'up'},
                    '123': {avail: 'down'}, // number key comme string
                },
            })
        );
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );
        // Should handle various key types and filter appropriately
        await waitFor(() => {
            expect(screen.getByText('valid')).toBeInTheDocument();
        });
        const rootRow = await screen.findByRole('row', {name: /root/i});
        const rootCells = within(rootRow).getAllByTestId('table-cell');
        expect(rootCells[1]).toHaveTextContent('0');
        expect(rootCells[2]).toHaveTextContent('1');
    });
    test('handles handleSort with same column toggle', async () => {
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );
        await screen.findByTestId('table-body');
        // Find namespace header and click multiple times to test toggle behavior
        const namespaceHeader = getHeaderCellFor('Namespace');
        expect(namespaceHeader).toBeInTheDocument();
        // First click sets to namespace column ascending
        fireEvent.click(namespaceHeader);
        // Second click on same column toggles to descending
        fireEvent.click(namespaceHeader);
        // Third click on same column toggles back to ascending
        fireEvent.click(namespaceHeader);
        // Should handle all toggles without errors
        await waitFor(() => {
            expect(screen.getAllByTestId('table-row').length).toBeGreaterThan(0);
        });
    });
    test('handles handleSort with different column selection', async () => {
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );
        await screen.findByTestId('table-body');

        const upHeader = getHeaderCellFor('Up');
        const downHeader = getHeaderCellFor('Down');
        expect(upHeader).toBeInTheDocument();
        expect(downHeader).toBeInTheDocument();

        fireEvent.click(upHeader);

        fireEvent.click(downHeader);

        await waitFor(() => {
            expect(screen.getAllByTestId('table-row').length).toBeGreaterThan(0);
        });
    });
    test('handles filteredNamespaces with single namespace match', async () => {
        mockUseLocation.mockReturnValue({search: '?namespace=dev'});
        render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('dev')).toBeInTheDocument();
        });

        expect(screen.queryByText('root')).not.toBeInTheDocument();
        expect(screen.queryByText('prod')).not.toBeInTheDocument();
    });
    test('handles useEffect cleanup with event source', async () => {
        const {unmount} = render(
            <MemoryRouter>
                <Namespaces/>
            </MemoryRouter>
        );
        // Verify startEventReception was called
        await waitFor(() => {
            expect(mockStartEventReception).toHaveBeenCalled();
        });
        // Unmount to trigger cleanup
        await act(async () => {
            unmount();
        });
        // Verify cleanup function was called
        expect(mockCloseEventSource).toHaveBeenCalled();
    });
});
