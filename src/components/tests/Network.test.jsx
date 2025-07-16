import React from 'react';
import {render, screen, waitFor, fireEvent, within} from '@testing-library/react';
import '@testing-library/jest-dom';
import {MemoryRouter} from 'react-router-dom';
import axios from 'axios';
import Network from '../Network';
import {URL_NETWORK} from '../../config/apiPath.js';

// Mock axios
jest.mock('axios');

// Mock useNavigate from react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
});

// Sample network data for testing
const mockNetworks = [
    {name: 'lo', type: 'loopback', network: '127.0.0.0/8', size: 100, used: 50, free: 50},
    {name: 'default', type: 'bridge', network: '192.168.1.0/24', size: 200, used: 100, free: 100},
];

describe('Network Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockLocalStorage.getItem.mockReturnValue('mock-token');
    });

    test('renders the Networks title', () => {
        render(<Network/>, {wrapper: MemoryRouter});
        expect(screen.getByText('Networks')).toBeInTheDocument();
    });

    test('renders table headers correctly', () => {
        render(<Network/>, {wrapper: MemoryRouter});
        const headers = ['Name', 'Type', 'Network', 'Usage'];
        headers.forEach((header) => {
            expect(screen.getByText(header)).toBeInTheDocument();
        });
    });

    test('displays network data correctly when API call succeeds', async () => {
        axios.get.mockResolvedValueOnce({data: {items: mockNetworks}});

        render(<Network/>, {wrapper: MemoryRouter});

        await waitFor(() => {
            // Check lo data (sorted first)
            const loRow = screen.getByText('lo').closest('tr');
            expect(loRow).toHaveTextContent('lo');
            expect(loRow).toHaveTextContent('loopback');
            expect(loRow).toHaveTextContent('127.0.0.0/8');
            expect(loRow).toHaveTextContent('50.0%');
            expect(loRow.querySelector('[role="progressbar"]')).toBeInTheDocument();

            // Check default data
            const defaultRow = screen.getByText('default').closest('tr');
            expect(defaultRow).toHaveTextContent('default');
            expect(defaultRow).toHaveTextContent('bridge');
            expect(defaultRow).toHaveTextContent('192.168.1.0/24');
            expect(defaultRow).toHaveTextContent('50.0%');
            expect(defaultRow.querySelector('[role="progressbar"]')).toBeInTheDocument();
        });

        expect(axios.get).toHaveBeenCalledWith(URL_NETWORK, {
            headers: {Authorization: 'Bearer mock-token'},
        });
    });

    test('displays tooltip with used/size on percentage or progress bar hover', async () => {
        axios.get.mockResolvedValueOnce({data: {items: mockNetworks}});

        render(<Network/>, {wrapper: MemoryRouter});

        await waitFor(() => {
            expect(screen.getByText('lo')).toBeInTheDocument();
        });

        // First row (lo)
        const loRow = screen.getByText('lo').closest('tr');
        const loPercentage = within(loRow).getByText('50.0%');

        // Hover over percentage
        fireEvent.mouseOver(loPercentage);
        expect(await screen.findByText('50/100')).toBeInTheDocument(); // Using findByText to wait for tooltip

        // Hover over progress bar
        const loProgressBar = within(loRow).getByRole('progressbar');
        fireEvent.mouseOver(loProgressBar);
        expect(await screen.findByText('50/100')).toBeInTheDocument();

        // Second row (default)
        const defaultRow = screen.getByText('default').closest('tr');
        const defaultPercentage = within(defaultRow).getByText('50.0%');

        fireEvent.mouseOver(defaultPercentage);
        expect(await screen.findByText('100/200')).toBeInTheDocument();

        const defaultProgressBar = within(defaultRow).getByRole('progressbar');
        fireEvent.mouseOver(defaultProgressBar);
        expect(await screen.findByText('100/200')).toBeInTheDocument();
    });

    test('handles API error gracefully', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        axios.get.mockRejectedValueOnce(new Error('API Error'));

        render(<Network/>, {wrapper: MemoryRouter});

        await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error retrieving networks', expect.any(Error));
            expect(screen.getByText('No networks available.')).toBeInTheDocument();
            expect(screen.queryByText('lo')).not.toBeInTheDocument();
            expect(screen.queryByText('default')).not.toBeInTheDocument();
        });

        consoleErrorSpy.mockRestore();
    });

    test('displays N/A for usage when size is zero', async () => {
        const networksWithZeroSize = [
            {name: 'test', type: 'bridge', network: '10.0.0.0/24', size: 0, used: 10, free: 0},
        ];
        axios.get.mockResolvedValueOnce({data: {items: networksWithZeroSize}});

        render(<Network/>, {wrapper: MemoryRouter});

        await waitFor(() => {
            expect(screen.getByText('test')).toBeInTheDocument();
            const testRow = screen.getByText('test').closest('tr');
            const usageCell = testRow.querySelector('td:last-child');
            expect(usageCell).toHaveTextContent('N/A');
            expect(usageCell.querySelector('[role="progressbar"]')).not.toBeInTheDocument();
        });
    });

    test('calls API with correct authorization token', async () => {
        axios.get.mockResolvedValueOnce({data: {items: []}});

        render(<Network/>, {wrapper: MemoryRouter});

        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith(URL_NETWORK, {
                headers: {Authorization: 'Bearer mock-token'},
            });
        });
    });

    test('sorts networks alphabetically by name', async () => {
        const unsortedNetworks = [
            {name: 'zebra', type: 'bridge', network: '10.0.0.0/24', size: 100, used: 50, free: 50},
            {name: 'apple', type: 'loopback', network: '127.0.0.0/8', size: 100, used: 50, free: 50},
        ];
        axios.get.mockResolvedValueOnce({data: {items: unsortedNetworks}});

        render(<Network/>, {wrapper: MemoryRouter});

        await waitFor(() => {
            const rows = screen.getAllByRole('row');
            // Skip header row, check data rows
            expect(rows[1]).toHaveTextContent('apple');
            expect(rows[2]).toHaveTextContent('zebra');
        });
    });

    test('navigates to network details on row click', async () => {
        axios.get.mockResolvedValueOnce({data: {items: mockNetworks}});

        render(<Network/>, {wrapper: MemoryRouter});

        await waitFor(() => {
            const loRow = screen.getByText('lo').closest('tr');
            fireEvent.click(loRow);
            expect(mockNavigate).toHaveBeenCalledWith('/network/lo');

            const defaultRow = screen.getByText('default').closest('tr');
            fireEvent.click(defaultRow);
            expect(mockNavigate).toHaveBeenCalledWith('/network/default');
        });
    });
});
