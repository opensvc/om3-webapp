import React from 'react';
import {render, screen, waitFor, fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import App from '../App';
import NavBar from '../NavBar';
import ClusterOverview from '../Cluster';
import NodesTable from '../NodesTable';
import Namespaces from '../Namespaces';
import Heartbeats from '../Heartbeats';
import Pools from '../Pools';
import Objects from '../Objects';
import ObjectDetails from '../ObjectDetails';
import AuthChoice from '../Authchoice';
import Login from '../Login';
import OidcCallback from '../OidcCallback';
import {AuthProvider} from '../../context/AuthProvider';
import {OidcProvider} from '../../context/OidcAuthContext.tsx';

// Mock CSS imports
jest.mock('../../styles/main.css', () => ({}));

// Mock dependencies
jest.mock('../NavBar', () => () => <div data-testid="navbar">NavBar</div>);
jest.mock('../Cluster', () => () => <div data-testid="cluster">ClusterOverview</div>);
jest.mock('../NodesTable', () => () => <div data-testid="nodes">NodesTable</div>);
jest.mock('../Namespaces', () => () => <div data-testid="namespaces">Namespaces</div>);
jest.mock('../Heartbeats', () => () => <div data-testid="heartbeats">Heartbeats</div>);
jest.mock('../Pools', () => () => <div data-testid="pools">Pools</div>);
jest.mock('../Objects', () => () => <div data-testid="objects">Objects</div>);
jest.mock('../ObjectDetails', () => () => <div data-testid="object-details">ObjectDetails</div>);
jest.mock('../Authchoice', () => () => <div data-testid="auth-choice">AuthChoice</div>);
jest.mock('../Login', () => () => <div data-testid="login">Login</div>);
jest.mock('../OidcCallback', () => () => <div data-testid="auth-callback">OidcCallback</div>);
jest.mock('../../context/AuthProvider', () => ({
    AuthProvider: ({children}) => <div>{children}</div>,
}));
jest.mock('../../context/OidcAuthContext.tsx', () => ({
    OidcProvider: ({children}) => <div>{children}</div>,
}));

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {value: mockLocalStorage});

// Mock console.log and console.error to suppress logs
jest.spyOn(console, 'log').mockImplementation(() => {
});
jest.spyOn(console, 'error').mockImplementation(() => {
});

describe('App Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockLocalStorage.getItem.mockReturnValue(null);
    });

    test('renders NavBar and redirects from / to /cluster', async () => {
        const validToken = 'header.' + btoa(JSON.stringify({exp: Date.now() / 1000 + 3600})) + '.signature';
        mockLocalStorage.getItem.mockReturnValue(validToken);

        render(
            <MemoryRouter initialEntries={['/']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('navbar')).toBeInTheDocument();
            expect(screen.getByTestId('cluster')).toBeInTheDocument();
        }, {timeout: 2000});
    });

    test('renders protected route /cluster with valid token', async () => {
        const validToken = 'header.' + btoa(JSON.stringify({exp: Date.now() / 1000 + 3600})) + '.signature';
        mockLocalStorage.getItem.mockReturnValue(validToken);

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('cluster')).toBeInTheDocument();
        }, {timeout: 2000});
    });

    test('redirects from protected route /cluster to /auth-choice with invalid token', async () => {
        const invalidToken = 'header.' + btoa(JSON.stringify({exp: Date.now() / 1000 - 3600})) + '.signature';
        mockLocalStorage.getItem.mockReturnValue(invalidToken);

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('auth-choice')).toBeInTheDocument();
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
        }, {timeout: 2000});
    });

    test('redirects from protected route /cluster to /auth-choice with no token', async () => {
        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('auth-choice')).toBeInTheDocument();
        }, {timeout: 2000});
    });

    test('renders public route /auth-choice without token', async () => {
        render(
            <MemoryRouter initialEntries={['/auth-choice']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('auth-choice')).toBeInTheDocument();
        }, {timeout: 2000});
    });

    test('renders public route /auth/login without token', async () => {
        render(
            <MemoryRouter initialEntries={['/auth/login']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('login')).toBeInTheDocument();
        }, {timeout: 2000});
    });

    test('renders public route /auth-callback without token', async () => {
        render(
            <MemoryRouter initialEntries={['/auth-callback']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('auth-callback')).toBeInTheDocument();
        }, {timeout: 2000});
    });

    test('renders protected route /nodes with valid token', async () => {
        const validToken = 'header.' + btoa(JSON.stringify({exp: Date.now() / 1000 + 3600})) + '.signature';
        mockLocalStorage.getItem.mockReturnValue(validToken);

        render(
            <MemoryRouter initialEntries={['/nodes']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('nodes')).toBeInTheDocument();
        }, {timeout: 2000});
    });

    test('renders protected route /objects/:objectName with valid token', async () => {
        const validToken = 'header.' + btoa(JSON.stringify({exp: Date.now() / 1000 + 3600})) + '.signature';
        mockLocalStorage.getItem.mockReturnValue(validToken);

        render(
            <MemoryRouter initialEntries={['/objects/test-object']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('object-details')).toBeInTheDocument();
        }, {timeout: 2000});
    });

    test('updates token state on localStorage change', async () => {
        const validToken = 'header.' + btoa(JSON.stringify({exp: Date.now() / 1000 + 3600})) + '.signature';
        mockLocalStorage.getItem.mockReturnValue(null);

        render(
            <MemoryRouter initialEntries={['/auth-choice']}>
                <App/>
            </MemoryRouter>
        );

        // Simulate storage event
        window.dispatchEvent(
            new StorageEvent('storage', {
                key: 'authToken',
                newValue: validToken,
                bubbles: true,
                cancelable: false,
            })
        );

        await waitFor(() => {
            expect(mockLocalStorage.getItem).toHaveBeenCalledWith('authToken');
        }, {timeout: 2000});
    });

    test('handles invalid token format gracefully', async () => {
        mockLocalStorage.getItem.mockReturnValue('invalid-token');

        render(
            <MemoryRouter initialEntries={['/cluster']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('auth-choice')).toBeInTheDocument();
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
        }, {timeout: 2000});
    });

    test('redirects unknown routes to /', async () => {
        const validToken = 'header.' + btoa(JSON.stringify({exp: Date.now() / 1000 + 3600})) + '.signature';
        mockLocalStorage.getItem.mockReturnValue(validToken);

        render(
            <MemoryRouter initialEntries={['/unknown']}>
                <App/>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByTestId('cluster')).toBeInTheDocument();
        }, {timeout: 2000});
    });
});