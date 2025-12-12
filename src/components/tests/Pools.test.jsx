import React from 'react';
import {render, screen, waitFor, fireEvent, within} from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import Pools from '../Pools';
import {URL_POOL} from '../../config/apiPath.js';

// Mock axios
jest.mock('axios');

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
});

// Sample pool data for testing
const mockPools = [
    {name: 'pool1', type: 'zfs', volume_count: 5, used: 50, size: 100, head: 'node1'},
    {name: 'pool2', type: 'lvm', volume_count: 3, used: 0, size: 200, head: 'node2'},
    {name: 'pool3', type: 'ext4', volume_count: 10, used: 75, size: 100, head: 'node3'},
];

describe('Pools Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockLocalStorage.getItem.mockReturnValue('mock-token');
    });

    test('renders table headers correctly', async () => {
        axios.get.mockResolvedValueOnce({data: {items: []}});

        render(<Pools/>);

        await waitFor(() => {
            expect(screen.getByText('Name')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('Type')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('Volume Count')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('Usage')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('Head')).toBeInTheDocument();
        });
    });

    test('displays pool data correctly when API call succeeds', async () => {
        axios.get.mockResolvedValueOnce({data: {items: mockPools}});

        render(<Pools/>);

        await waitFor(() => {
            expect(screen.getByText('pool1')).toBeInTheDocument();
        });

        // Check pool1 data
        await waitFor(() => {
            expect(screen.getByText('zfs')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('5')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('50.0%')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('node1')).toBeInTheDocument();
        });

        // Check pool2 data
        await waitFor(() => {
            expect(screen.getByText('pool2')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('lvm')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('3')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('0.0%')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('node2')).toBeInTheDocument();
        });

        // Check pool3 data
        await waitFor(() => {
            expect(screen.getByText('pool3')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('ext4')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('10')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('75.0%')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('node3')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith(URL_POOL, {
                headers: {Authorization: 'Bearer mock-token'},
            });
        });
    });

    test('handles API error gracefully', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        axios.get.mockRejectedValueOnce(new Error('API Error'));

        render(<Pools/>);

        await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error retrieving pools', expect.any(Error));
        });
        await waitFor(() => {
            expect(screen.queryByText('pool1')).not.toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.queryByText('pool2')).not.toBeInTheDocument();
        });
        await waitFor(() => {
            const alert = screen.getByRole('alert');
            expect(alert).toHaveClass('MuiAlert-standardError');
        });
        await waitFor(() => {
            expect(within(screen.getByRole('alert')).getByText('Failed to load pools. Please try again.')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(within(screen.getByRole('alert')).getByRole('button', {name: /retry/i})).toBeInTheDocument();
        });

        consoleErrorSpy.mockRestore();
    });

    test('does not update state when component is unmounted during API error', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        // Mock a delayed API error response
        axios.get.mockImplementationOnce(() =>
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error('API Error')), 100);
            })
        );

        const {unmount} = render(<Pools/>);

        // Unmount before the API resolves
        unmount();

        // Wait for the API to reject
        await new Promise((resolve) => setTimeout(resolve, 150));

        // Verify that console.error was called, but state updates were skipped
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error retrieving pools', expect.any(Error));
        expect(screen.queryByText('Failed to load pools. Please try again.')).not.toBeInTheDocument();

        consoleErrorSpy.mockRestore();
    });

    test('displays N/A for usage when used is negative', async () => {
        const poolsWithNegativeUsed = [
            {name: 'pool4', type: 'zfs', volume_count: 2, used: -10, size: 100, head: 'node4'},
        ];
        axios.get.mockResolvedValueOnce({data: {items: poolsWithNegativeUsed}});

        render(<Pools/>);

        await waitFor(() => {
            expect(screen.getByText('pool4')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByText((content, element) => content.includes('N/A') && element.tagName === 'TD')).toBeInTheDocument();
        });
    });

    test('handles pools with missing properties', async () => {
        const poolsWithMissingProps = [
            {name: null, type: undefined, volume_count: null, used: undefined, size: null, head: undefined},
        ];
        axios.get.mockResolvedValueOnce({data: {items: poolsWithMissingProps}});

        render(<Pools/>);

        await waitFor(() => {
            const naElements = screen.getAllByText((content, element) => content.includes('N/A') && element.tagName === 'TD');
            expect(naElements.length).toBe(5); // Expect N/A for name, type, volume_count, usage, head
        });
    });

    test('handles API response with null items', async () => {
        axios.get.mockResolvedValueOnce({data: {items: null}});

        render(<Pools/>);

        await waitFor(() => {
            expect(screen.getByText('No pools available.')).toBeInTheDocument();
        });
    });

    test('calls API with correct authorization token', async () => {
        axios.get.mockResolvedValueOnce({data: {items: []}});

        render(<Pools/>);

        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith(URL_POOL, {
                headers: {Authorization: 'Bearer mock-token'},
            });
        });
    });

    test('displays "No pools available." when API returns an empty list', async () => {
        axios.get.mockResolvedValueOnce({data: {items: []}});

        render(<Pools/>);

        await waitFor(() => {
            expect(screen.getByText('No pools available.')).toBeInTheDocument();
        });
    });

    test('displays error and allows retry on failure', async () => {
        axios.get.mockRejectedValueOnce(new Error('API Error'));

        render(<Pools/>);

        await waitFor(() => {
            expect(screen.getByText('Failed to load pools. Please try again.')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByRole('button', {name: /retry/i})).toBeInTheDocument();
        });

        // Second call succeeds after retry
        axios.get.mockResolvedValueOnce({data: {items: mockPools}});

        const retryButton = screen.getByRole('button', {name: /retry/i});
        fireEvent.click(retryButton);

        await waitFor(() => {
            expect(screen.getByText('pool1')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('pool2')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('pool3')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.queryByText('Failed to load pools. Please try again.')).not.toBeInTheDocument();
        });
        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledTimes(2);
        });
    });

    test('handles retry with missing auth token', async () => {
        axios.get.mockRejectedValueOnce(new Error('API Error'));

        render(<Pools/>);

        await waitFor(() => {
            expect(screen.getByText('Failed to load pools. Please try again.')).toBeInTheDocument();
        });

        // Mock missing auth token
        mockLocalStorage.getItem.mockReturnValue(null);
        axios.get.mockRejectedValueOnce(new Error('No Token'));

        const retryButton = screen.getByRole('button', {name: /retry/i});
        fireEvent.click(retryButton);

        await waitFor(() => {
            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('Failed to load pools. Please try again.')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith(URL_POOL, {
                headers: {Authorization: 'Bearer null'},
            });
        });
        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledTimes(2);
        });
    });

    test('sorts table by different columns', async () => {
        axios.get.mockResolvedValueOnce({data: {items: mockPools}});

        render(<Pools/>);

        await waitFor(() => {
            expect(screen.getByText('pool1')).toBeInTheDocument();
        });

        // Get table rows for comparison
        const getRows = () => screen.getAllByRole('row', {name: /pool[1-3]/}); // Filter rows with pool names

        // Check initial sort by name (asc)
        await waitFor(() => {
            const rows = getRows();
            expect(within(rows[0]).getByText('pool1')).toBeInTheDocument();
        });
        await waitFor(() => {
            const rows = getRows();
            expect(within(rows[1]).getByText('pool2')).toBeInTheDocument();
        });
        await waitFor(() => {
            const rows = getRows();
            expect(within(rows[2]).getByText('pool3')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByTestId('KeyboardArrowUpIcon')).toBeInTheDocument();
        });

        // Test sorting by name (desc)
        const nameHeader = screen.getByText('Name');
        fireEvent.click(nameHeader);
        await waitFor(() => {
            const rows = getRows();
            expect(within(rows[0]).getByText('pool3')).toBeInTheDocument();
        });
        await waitFor(() => {
            const rows = getRows();
            expect(within(rows[1]).getByText('pool2')).toBeInTheDocument();
        });
        await waitFor(() => {
            const rows = getRows();
            expect(within(rows[2]).getByText('pool1')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByTestId('KeyboardArrowDownIcon')).toBeInTheDocument();
        });

        // Test sorting by name (asc again)
        fireEvent.click(nameHeader);
        await waitFor(() => {
            const rows = getRows();
            expect(within(rows[0]).getByText('pool1')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByTestId('KeyboardArrowUpIcon')).toBeInTheDocument();
        });

        // Test sorting by type (asc)
        const typeHeader = screen.getByText('Type');
        fireEvent.click(typeHeader);
        await waitFor(() => {
            const rows = getRows();
            expect(within(rows[0]).getByText('pool3')).toBeInTheDocument(); // ext4
        });
        await waitFor(() => {
            const rows = getRows();
            expect(within(rows[1]).getByText('pool2')).toBeInTheDocument(); // lvm
        });
        await waitFor(() => {
            const rows = getRows();
            expect(within(rows[2]).getByText('pool1')).toBeInTheDocument(); // zfs
        });
        await waitFor(() => {
            expect(screen.getByTestId('KeyboardArrowUpIcon')).toBeInTheDocument();
        });

        // Test sorting by type (desc)
        fireEvent.click(typeHeader);
        await waitFor(() => {
            const rows = getRows();
            expect(within(rows[0]).getByText('pool1')).toBeInTheDocument(); // zfs
        });
        await waitFor(() => {
            expect(screen.getByTestId('KeyboardArrowDownIcon')).toBeInTheDocument();
        });

        // Test sorting by volume_count (asc)
        const volumeHeader = screen.getByText('Volume Count');
        fireEvent.click(volumeHeader);
        await waitFor(() => {
            const rows = getRows();
            expect(within(rows[0]).getByText('pool2')).toBeInTheDocument(); // 3
        });
        await waitFor(() => {
            const rows = getRows();
            expect(within(rows[1]).getByText('pool1')).toBeInTheDocument(); // 5
        });
        await waitFor(() => {
            const rows = getRows();
            expect(within(rows[2]).getByText('pool3')).toBeInTheDocument(); // 10
        });
        await waitFor(() => {
            expect(screen.getByTestId('KeyboardArrowUpIcon')).toBeInTheDocument();
        });

        // Test sorting by volume_count (desc)
        fireEvent.click(volumeHeader);
        await waitFor(() => {
            const rows = getRows();
            expect(within(rows[0]).getByText('pool3')).toBeInTheDocument(); // 10
        });
        await waitFor(() => {
            expect(screen.getByTestId('KeyboardArrowDownIcon')).toBeInTheDocument();
        });

        // Test sorting by usage (asc)
        const usageHeader = screen.getByText('Usage');
        fireEvent.click(usageHeader);
        await waitFor(() => {
            const rows = getRows();
            expect(within(rows[0]).getByText('pool2')).toBeInTheDocument(); // 0.0%
        });
        await waitFor(() => {
            const rows = getRows();
            expect(within(rows[1]).getByText('pool1')).toBeInTheDocument(); // 50.0%
        });
        await waitFor(() => {
            const rows = getRows();
            expect(within(rows[2]).getByText('pool3')).toBeInTheDocument(); // 75.0%
        });
        await waitFor(() => {
            expect(screen.getByTestId('KeyboardArrowUpIcon')).toBeInTheDocument();
        });

        // Test sorting by usage (desc)
        fireEvent.click(usageHeader);
        await waitFor(() => {
            const rows = getRows();
            expect(within(rows[0]).getByText('pool3')).toBeInTheDocument(); // 75.0%
        });
        await waitFor(() => {
            expect(screen.getByTestId('KeyboardArrowDownIcon')).toBeInTheDocument();
        });

        // Test sorting by head (asc)
        const headHeader = screen.getByText('Head');
        fireEvent.click(headHeader);
        await waitFor(() => {
            const rows = getRows();
            expect(within(rows[0]).getByText('pool1')).toBeInTheDocument(); // node1
        });
        await waitFor(() => {
            const rows = getRows();
            expect(within(rows[1]).getByText('pool2')).toBeInTheDocument(); // node2
        });
        await waitFor(() => {
            const rows = getRows();
            expect(within(rows[2]).getByText('pool3')).toBeInTheDocument(); // node3
        });
        await waitFor(() => {
            expect(screen.getByTestId('KeyboardArrowUpIcon')).toBeInTheDocument();
        });

        // Test sorting by head (desc)
        fireEvent.click(headHeader);
        await waitFor(() => {
            const rows = getRows();
            expect(within(rows[0]).getByText('pool3')).toBeInTheDocument(); // node3
        });
        await waitFor(() => {
            expect(screen.getByTestId('KeyboardArrowDownIcon')).toBeInTheDocument();
        });
    });

    test('handles usage calculation with zero size', async () => {
        const poolsWithZeroSize = [
            {name: 'pool5', type: 'zfs', volume_count: 2, used: 10, size: 0, head: 'node5'},
        ];
        axios.get.mockResolvedValueOnce({data: {items: poolsWithZeroSize}});

        render(<Pools/>);

        await waitFor(() => {
            expect(screen.getByText('pool5')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByText((content, element) => content.includes('N/A') && element.tagName === 'TD')).toBeInTheDocument();
        });
    });

    test('renders Alert component with correct properties on API error', async () => {
        axios.get.mockRejectedValueOnce(new Error('API Error'));

        render(<Pools/>);

        await waitFor(() => {
            const alert = screen.getByRole('alert');
            expect(alert).toHaveClass('MuiAlert-standardError');
        });
        await waitFor(() => {
            expect(within(screen.getByRole('alert')).getByText('Failed to load pools. Please try again.')).toBeInTheDocument();
        });
        await waitFor(() => {
            const retryButton = within(screen.getByRole('alert')).getByRole('button', {name: /retry/i});
            expect(retryButton).toHaveClass('MuiButton-colorInherit');
        });
        await waitFor(() => {
            const retryButton = within(screen.getByRole('alert')).getByRole('button', {name: /retry/i});
            expect(retryButton).toHaveClass('MuiButton-sizeSmall');
        });

        // Simulate retry with failure to test error state persistence
        axios.get.mockRejectedValueOnce(new Error('Retry Failed'));

        const retryButton = screen.getByRole('button', {name: /retry/i});
        fireEvent.click(retryButton);

        await waitFor(() => {
            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText('Failed to load pools. Please try again.')).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByRole('button', {name: /retry/i})).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledTimes(2);
        });
    });
});
