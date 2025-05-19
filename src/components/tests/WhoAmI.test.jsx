import React from 'react';
import {render, screen, waitFor, within} from '@testing-library/react';
import WhoAmI from '../WhoAmI';
import {URL_AUTH_WHOAMI} from '../../config/apiPath';

// Mock the fetch API
global.fetch = jest.fn();

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {value: mockLocalStorage});

describe('WhoAmI Component', () => {
    const mockToken = 'mock-auth-token';
    const mockUserInfo = {
        auth: 'user',
        grant: {root: null},
        name: 'pjouvanceau',
        namespace: 'system',
        raw_grant: 'root',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockLocalStorage.getItem.mockReturnValue(mockToken);
    });

    test('renders loading state initially', () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockUserInfo),
        });

        render(<WhoAmI/>);

        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    test('displays error message on fetch failure', async () => {
        fetch.mockRejectedValueOnce(new Error('Failed to load user information'));

        render(<WhoAmI/>);

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('Failed to load user information');
        });
    });

    test('displays user information on successful fetch', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockUserInfo),
        });

        render(<WhoAmI/>);

        await waitFor(() => {
            // Check main title
            expect(screen.getByRole('heading', {name: /My Information/i})).toBeInTheDocument();

            // Check Identity section
            expect(screen.getByText('Identity')).toBeInTheDocument();
            expect(screen.getByText('Username')).toBeInTheDocument();
            expect(screen.getByText('pjouvanceau')).toBeInTheDocument();
            expect(screen.getByText('Authentication Method')).toBeInTheDocument();
            expect(screen.getByText('user')).toBeInTheDocument();

            // Check Access section
            expect(screen.getByText('Access')).toBeInTheDocument();
            expect(screen.getByText('Namespace')).toBeInTheDocument();
            expect(screen.getByText('system')).toBeInTheDocument();
            expect(screen.getByText('Raw Permissions')).toBeInTheDocument();
            expect(screen.getByText('root')).toBeInTheDocument();

            // Check Permission Details section
            expect(screen.getByText('Permission Details')).toBeInTheDocument();
            const permissionSection = screen.getByText('Permission Details').closest('div.space-y-3');
            const preElement = within(permissionSection).getByText(/root.*null/i, {selector: 'pre'});
            expect(preElement).toHaveTextContent(/"root": null/);
        });

        // Verify fetch call
        expect(fetch).toHaveBeenCalledWith(URL_AUTH_WHOAMI, {
            credentials: 'include',
            headers: {
                Authorization: `Bearer ${mockToken}`,
            },
        });
    });

    test('displays "None" for missing raw_grant', async () => {
        const userInfoNoRawGrant = {...mockUserInfo, raw_grant: null};
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(userInfoNoRawGrant),
        });

        render(<WhoAmI/>);

        await waitFor(() => {
            expect(screen.getByText('Raw Permissions')).toBeInTheDocument();
            expect(screen.getByText('None')).toBeInTheDocument();
        });
    });

    test('handles non-OK response with error message', async () => {
        fetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: () => Promise.resolve({}),
        });

        render(<WhoAmI/>);

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('Failed to load user information');
        });
    });

    test('uses authToken from localStorage', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockUserInfo),
        });

        render(<WhoAmI/>);

        await waitFor(() => {
            expect(mockLocalStorage.getItem).toHaveBeenCalledWith('authToken');
            expect(fetch).toHaveBeenCalledWith(
                URL_AUTH_WHOAMI,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: `Bearer ${mockToken}`,
                    }),
                })
            );
        });
    });
});