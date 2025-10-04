import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {useNavigate} from 'react-router-dom';
import Login, {decodeToken, refreshToken} from '../Login';
import {SetAccessToken, SetAuthChoice, useAuthDispatch} from '../../context/AuthProvider.jsx';
import {URL_TOKEN, URL_REFRESH} from '../../config/apiPath';

// Mock dependencies
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: jest.fn(),
}));

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key) => key,
    }),
}));

jest.mock('../../context/AuthProvider.jsx', () => ({
    SetAccessToken: 'SET_ACCESS_TOKEN',
    SetAuthChoice: 'SET_AUTH_CHOICE',
    useAuthDispatch: jest.fn(),
}));

jest.mock('../../config/apiPath.js', () => ({
    URL_TOKEN: 'http://mock-api/token',
    URL_REFRESH: 'http://mock-api/refresh',
}));

// Global fetch mock
global.fetch = jest.fn();

// Utility function to create a mock token
const createMockToken = (payload) => {
    const header = {alg: 'HS256', typ: 'JWT'};
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64').replace(/=/g, '');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/=/g, '');
    const signature = 'mock-signature';
    return `${encodedHeader}.${encodedPayload}.${signature}`;
};

describe('Login Component', () => {
    const mockNavigate = jest.fn();
    const mockDispatch = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        useNavigate.mockReturnValue(mockNavigate);
        useAuthDispatch.mockReturnValue(mockDispatch);
        localStorage.clear();
    });

    test('renders login form correctly', () => {
        render(<Login/>);

        expect(screen.getByText('Login')).toBeInTheDocument();
        expect(screen.getByLabelText('Username')).toBeInTheDocument();
        expect(screen.getByLabelText('Password')).toBeInTheDocument();
        expect(screen.getByText('Submit')).toBeInTheDocument();
        expect(screen.getByText('Change Method')).toBeInTheDocument();
    });

    test('handles form input changes', () => {
        render(<Login/>);
        const usernameInput = screen.getByLabelText('Username');
        const passwordInput = screen.getByLabelText('Password');
        fireEvent.change(usernameInput, {target: {value: 'testuser'}});
        fireEvent.change(passwordInput, {target: {value: 'testpass'}});
        expect(usernameInput.value).toBe('testuser');
        expect(passwordInput.value).toBe('testpass');
    });

    test('submits form with Enter key', async () => {
        render(<Login/>);

        const usernameInput = screen.getByLabelText('Username');
        const passwordInput = screen.getByLabelText('Password');

        fireEvent.change(usernameInput, {target: {value: 'testuser'}});
        fireEvent.change(passwordInput, {target: {value: 'testpass'}});
        fireEvent.keyDown(passwordInput, {key: 'Enter'});
        await waitFor(() => expect(fetch).toHaveBeenCalled());
    });

    test('handles successful login', async () => {
        const payload = {
            sub: '1234567890',
            name: 'John Doe',
            iat: 1516239022,
            exp: Math.floor(Date.now() / 1000) + 3600,
        };
        const mockAccessToken = createMockToken(payload);
        const mockRefreshToken = createMockToken({...payload, token_use: 'refresh'});
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                access_token: mockAccessToken,
                refresh_token: mockRefreshToken,
                access_expired_at: new Date(Date.now() + 3600 * 1000).toISOString(),
                refresh_expired_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
            }),
        });

        render(<Login/>);

        fireEvent.change(screen.getByLabelText('Username'), {target: {value: 'testuser'}});
        fireEvent.change(screen.getByLabelText('Password'), {target: {value: 'testpass'}});
        fireEvent.click(screen.getByText('Submit'));

        await waitFor(() =>
            expect(fetch).toHaveBeenCalledWith(`${URL_TOKEN}?refresh=true`, {
                method: 'POST',
                headers: {
                    Authorization: 'Basic ' + btoa('testuser:testpass'),
                },
            })
        );

        expect(localStorage.getItem('authToken')).toBe(mockAccessToken);
        expect(localStorage.getItem('refreshToken')).toBe(mockRefreshToken);
        expect(localStorage.getItem('tokenExpiration')).toBeDefined();
        expect(localStorage.getItem('refreshTokenExpiration')).toBeDefined();
        expect(mockDispatch).toHaveBeenCalledWith({
            type: SetAccessToken,
            data: mockAccessToken,
        });
        expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    test('handles login error', async () => {
        fetch.mockResolvedValueOnce({ok: false});

        render(<Login/>);

        fireEvent.change(screen.getByLabelText('Username'), {target: {value: 'wronguser'}});
        fireEvent.change(screen.getByLabelText('Password'), {target: {value: 'wrongpass'}});
        fireEvent.click(screen.getByText('Submit'));

        await waitFor(() => {
            expect(screen.getByText('Incorrect username or password')).toBeInTheDocument();
        }, {timeout: 2000});
    });

    test('disables submit button when fields are empty', () => {
        render(<Login/>);

        expect(screen.getByText('Submit')).toBeDisabled();

        fireEvent.change(screen.getByLabelText('Username'), {target: {value: 'testuser'}});
        expect(screen.getByText('Submit')).toBeDisabled();

        fireEvent.change(screen.getByLabelText('Password'), {target: {value: 'testpass'}});
        expect(screen.getByText('Submit')).not.toBeDisabled();
    });

    test('handles change method button click', () => {
        render(<Login/>);

        fireEvent.click(screen.getByText('Change Method'));

        expect(mockDispatch).toHaveBeenCalledWith({
            type: SetAuthChoice,
            data: '',
        });
        expect(mockNavigate).toHaveBeenCalledWith('/auth-choice');
    });

    test('decodes token correctly', () => {
        const payload = {sub: '1234567890', name: 'John Doe', iat: 1516239022};
        const mockToken = createMockToken(payload);
        const decoded = decodeToken(mockToken);
        expect(decoded).toEqual(payload);
    });

    test('handles token refresh', async () => {
        const payload = {
            sub: '1234567890',
            name: 'John Doe',
            iat: 1516239022,
            exp: Math.floor(Date.now() / 1000) + 3600,
        };
        const mockAccessToken = createMockToken(payload);
        jest.spyOn(Date, 'now').mockImplementation(() => 1000000);
        localStorage.setItem('refreshToken', 'mock.refresh.token');
        localStorage.setItem('refreshTokenExpiration', '2000000');

        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({access_token: mockAccessToken}),
        });

        await refreshToken(mockDispatch);

        expect(fetch).toHaveBeenCalledWith(URL_REFRESH, {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'Authorization': 'Bearer mock.refresh.token',
            },
        });
        expect(localStorage.getItem('authToken')).toBe(mockAccessToken);
        expect(mockDispatch).toHaveBeenCalledWith({
            type: SetAccessToken,
            data: mockAccessToken,
        });
    });

    test('decodeToken returns null when no token is provided', () => {
        expect(decodeToken(null)).toBeNull();
        expect(decodeToken(undefined)).toBeNull();
        expect(decodeToken('')).toBeNull();
    });

    test('decodeToken returns null and logs error on invalid token', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        const invalidToken = 'invalid.token.string';
        const result = decodeToken(invalidToken);
        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith('Error decoding token:', expect.any(Error));
        consoleSpy.mockRestore();
    });

    test('refreshToken returns null when no refresh token is stored', async () => {
        localStorage.removeItem('refreshToken');
        const result = await refreshToken(mockDispatch);
        expect(result).toBeNull();
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    test('refreshToken handles failed response (response.ok = false)', async () => {
        localStorage.setItem('refreshToken', 'mock.refresh.token');
        localStorage.setItem('refreshTokenExpiration', (Date.now() + 3600 * 1000).toString());
        fetch.mockResolvedValueOnce({ok: false});

        const result = await refreshToken(mockDispatch);

        expect(fetch).toHaveBeenCalledWith(URL_REFRESH, {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'Authorization': 'Bearer mock.refresh.token',
            },
        });
        expect(result).toBeNull();
        expect(mockDispatch).toHaveBeenCalledWith({type: SetAccessToken, data: null});
    });

    test('handleLogin sets error message when credentials are incorrect (401)', async () => {
        fetch.mockResolvedValueOnce({ok: false});

        render(<Login/>);

        fireEvent.change(screen.getByLabelText('Username'), {target: {value: 'wronguser'}});
        fireEvent.change(screen.getByLabelText('Password'), {target: {value: 'wrongpass'}});
        fireEvent.click(screen.getByText('Submit'));

        expect(fetch).toHaveBeenCalledWith(`${URL_TOKEN}?refresh=true`, {
            method: 'POST',
            headers: {
                Authorization: 'Basic ' + btoa('wronguser:wrongpass'),
            },
        });

        await waitFor(() => {
            expect(screen.getByText('Incorrect username or password')).toBeInTheDocument();
        }, {timeout: 2000});
    });
});
