import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
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
];

describe('Pools Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockLocalStorage.getItem.mockReturnValue('mock-token');
    });

    test('renders the Pools title', () => {
        render(<Pools/>);
        expect(screen.getByText('Pools')).toBeInTheDocument();
    });

    test('renders table headers correctly', async () => {
        // Mock API to resolve immediately with empty data
        axios.get.mockResolvedValueOnce({data: {items: []}});

        render(<Pools/>);

        // Wait for the loading state to resolve
        await waitFor(() => {
            expect(screen.getByText('Name')).toBeInTheDocument();
        });

        expect(screen.getByText('Type')).toBeInTheDocument();
        expect(screen.getByText('Volume Count')).toBeInTheDocument();
        expect(screen.getByText('Usage')).toBeInTheDocument();
        expect(screen.getByText('Head')).toBeInTheDocument();
    });

    test('displays pool data correctly when API call succeeds', async () => {
        axios.get.mockResolvedValueOnce({data: {items: mockPools}});

        render(<Pools/>);

        await waitFor(() => {
            expect(screen.getByText('pool1')).toBeInTheDocument();
        });

        // Check pool1 data
        expect(screen.getByText('zfs')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText('50.0%')).toBeInTheDocument();
        expect(screen.getByText('node1')).toBeInTheDocument();

        // Check pool2 data
        expect(screen.getByText('pool2')).toBeInTheDocument();
        expect(screen.getByText('lvm')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('0.0%')).toBeInTheDocument();
        expect(screen.getByText('node2')).toBeInTheDocument();

        expect(axios.get).toHaveBeenCalledWith(URL_POOL, {
            headers: {Authorization: 'Bearer mock-token'},
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

        expect(screen.queryByText('pool1')).not.toBeInTheDocument();
        expect(screen.queryByText('pool2')).not.toBeInTheDocument();

        consoleErrorSpy.mockRestore();
    });

    test('displays N/A for usage when size is zero', async () => {
        const poolsWithZeroSize = [
            {name: 'pool3', type: 'zfs', volume_count: 2, used: 10, size: 0, head: 'node3'},
        ];
        axios.get.mockResolvedValueOnce({data: {items: poolsWithZeroSize}});

        render(<Pools/>);

        await waitFor(() => {
            expect(screen.getByText('pool3')).toBeInTheDocument();
        });

        const naElement = screen.getByText((content) => content.includes('N/A'));
        expect(naElement).toBeInTheDocument();
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
        // First call fails
        axios.get.mockRejectedValueOnce(new Error('API Error'));

        render(<Pools/>);

        await waitFor(() => {
            expect(screen.getByText('Failed to load pools. Please try again.')).toBeInTheDocument();
        });

        // Second call succeeds after retry
        axios.get.mockResolvedValueOnce({data: {items: mockPools}});

        const retryButton = screen.getByRole('button', {name: /retry/i});
        retryButton.click();

        await waitFor(() => {
            expect(screen.getByText('pool1')).toBeInTheDocument();
        });

        expect(screen.getByText('pool2')).toBeInTheDocument();
    });
});
