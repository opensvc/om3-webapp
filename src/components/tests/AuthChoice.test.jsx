import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import AuthChoice from '../AuthChoice';

// Mock dependencie
jest.mock('../../hooks/AuthInfo');
jest.mock('../../context/OidcAuthContext');
jest.mock('../../config/oidcConfiguration');

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

// Import des mocks
import useAuthInfo from '../../hooks/AuthInfo';
import {useOidc} from '../../context/OidcAuthContext';
import oidcConfiguration from '../../config/oidcConfiguration';

describe('AuthChoice Component', () => {
    const theme = createTheme();
    const mockRecreateUserManager = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock console.log et console.error
        jest.spyOn(console, 'log').mockImplementation(() => {
        });
        jest.spyOn(console, 'error').mockImplementation(() => {
        });

        // Initialiser les mocks avec des valeurs par défaut
        useOidc.mockReturnValue({
            userManager: null,
            recreateUserManager: mockRecreateUserManager,
        });

        useAuthInfo.mockReturnValue(null);

        oidcConfiguration.mockReturnValue({
            issuer: 'mock-issuer',
            client_id: 'mock-client'
        });
    });

    afterEach(() => {
        // Restaurer les mocks de console
        console.log.mockRestore();
        console.error.mockRestore();
    });

    const renderComponent = () => {
        return render(
            <MemoryRouter>
                <ThemeProvider theme={theme}>
                    <AuthChoice/>
                </ThemeProvider>
            </MemoryRouter>
        );
    };

    test('renders dialog with title and description', () => {
        renderComponent();

        expect(screen.getByText('Authentication Methods')).toBeInTheDocument();
        expect(screen.getByText('Please select one of the authentication methods the cluster advertises.')).toBeInTheDocument();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('renders no buttons when authInfo is null', () => {
        useAuthInfo.mockReturnValue(null);
        renderComponent();

        expect(screen.queryByText('OpenID')).not.toBeInTheDocument();
        expect(screen.queryByText('Login')).not.toBeInTheDocument();
    });

    test('renders OpenID button when openid.issuer is defined', () => {
        useAuthInfo.mockReturnValue({
            openid: {issuer: 'https://auth.example.com'},
            methods: [],
        });
        renderComponent();

        expect(screen.getByText('OpenID')).toBeInTheDocument();
        expect(screen.queryByText('Login')).not.toBeInTheDocument();
    });

    test('renders Login button when methods includes basic', () => {
        useAuthInfo.mockReturnValue({
            openid: null,
            methods: ['basic'],
        });
        renderComponent();

        expect(screen.queryByText('OpenID')).not.toBeInTheDocument();
        expect(screen.getByText('Login')).toBeInTheDocument();
    });

    test('renders both buttons when both methods are available', () => {
        useAuthInfo.mockReturnValue({
            openid: {issuer: 'https://auth.example.com'},
            methods: ['basic'],
        });
        renderComponent();

        expect(screen.getByText('OpenID')).toBeInTheDocument();
        expect(screen.getByText('Login')).toBeInTheDocument();
    });

    test('clicking OpenID button calls signinRedirect when userManager exists', () => {
        const mockSigninRedirect = jest.fn();
        const mockUserManager = {
            signinRedirect: mockSigninRedirect,
        };

        useAuthInfo.mockReturnValue({
            openid: {issuer: 'https://auth.example.com'},
            methods: [],
        });

        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });

        renderComponent();

        fireEvent.click(screen.getByText('OpenID'));

        expect(mockSigninRedirect).toHaveBeenCalled();
        expect(console.log).not.toHaveBeenCalled();
    });

    test('clicking OpenID button logs message when userManager is null', () => {
        jest.spyOn(console, 'info').mockImplementation(() => {
        });

        useAuthInfo.mockReturnValue({
            openid: {issuer: 'https://auth.example.com'},
            methods: [],
        });
        useOidc.mockReturnValue({
            userManager: null,
            recreateUserManager: mockRecreateUserManager,
        });

        renderComponent();

        fireEvent.click(screen.getByText('OpenID'));

        expect(console.info).toHaveBeenCalledWith(
            "handleAuthChoice openid skipped: can't create userManager"
        );
    });

    test('clicking Login button navigates to /auth/login', () => {
        useAuthInfo.mockReturnValue({
            openid: null,
            methods: ['basic'],
        });

        renderComponent();

        fireEvent.click(screen.getByText('Login'));

        expect(mockNavigate).toHaveBeenCalledWith('/auth/login');
    });

    test('useEffect calls recreateUserManager when authInfo.openid.issuer exists and userManager is null', async () => {
        useAuthInfo.mockReturnValue({
            openid: {issuer: 'https://auth.example.com'},
            methods: [],
        });

        useOidc.mockReturnValue({
            userManager: null,
            recreateUserManager: mockRecreateUserManager,
        });

        renderComponent();

        await waitFor(() => {
            expect(oidcConfiguration).toHaveBeenCalledWith({
                openid: {issuer: 'https://auth.example.com'},
                methods: [],
            });
        });

        await waitFor(() => {
            expect(mockRecreateUserManager).toHaveBeenCalledWith({
                issuer: 'mock-issuer',
                client_id: 'mock-client'
            });
        });
    });

    test('useEffect does not call recreateUserManager when userManager exists', () => {
        const mockSigninRedirect = jest.fn();
        const mockUserManager = {
            signinRedirect: mockSigninRedirect,
        };

        useAuthInfo.mockReturnValue({
            openid: {issuer: 'https://auth.example.com'},
            methods: [],
        });

        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });

        renderComponent();

        expect(mockRecreateUserManager).not.toHaveBeenCalled();
    });

    test('useEffect does not call recreateUserManager when authInfo.openid.issuer is undefined', () => {
        useAuthInfo.mockReturnValue({
            openid: null,
            methods: ['basic'],
        });

        useOidc.mockReturnValue({
            userManager: null,
            recreateUserManager: mockRecreateUserManager,
        });

        renderComponent();

        expect(mockRecreateUserManager).not.toHaveBeenCalled();
    });

    test('handles signinRedirect error', async () => {
        const mockSigninRedirect = jest.fn(() => Promise.reject(new Error('Signin failed')));
        const mockUserManager = {
            signinRedirect: mockSigninRedirect,
        };

        useAuthInfo.mockReturnValue({
            openid: {issuer: 'https://auth.example.com'},
            methods: [],
        });

        useOidc.mockReturnValue({
            userManager: mockUserManager,
            recreateUserManager: mockRecreateUserManager,
        });

        renderComponent();

        fireEvent.click(screen.getByText('OpenID'));

        await waitFor(() => {
            expect(mockSigninRedirect).toHaveBeenCalled();
        });

        await waitFor(() => {
            expect(console.error).toHaveBeenCalledWith('handleAuthChoice signinRedirect:', expect.any(Error));
        });

        await waitFor(() => {
            expect(console.error.mock.calls[0][1].message).toBe('Signin failed');
        });
    });
});
