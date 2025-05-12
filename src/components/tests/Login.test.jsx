import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import Login, {decodeToken, refreshToken} from '../Login';
import {SetAccessToken, SetAuthChoice, useAuthDispatch} from '../../context/AuthProvider.jsx';
import {URL_TOKEN} from '../../config/apiPath';

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
}));

// Global fetch mock
global.fetch = jest.fn();

// Utility function to create a mock token
const createMockToken = (payload) => {
    const header = {alg: 'HS256', typ: 'JWT'};
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64').replace(/=/g, '');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/=/g, '');
    const signature = 'mock-signature'; // Fake signature, not validated by decodeToken
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

    test('submits form with Enter key', () => {
        render(<Login/>);

        const usernameInput = screen.getByLabelText('Username');
        const passwordInput = screen.getByLabelText('Password');

        fireEvent.change(usernameInput, {target: {value: 'testuser'}});
        fireEvent.change(passwordInput, {target: {value: 'testpass'}});
        fireEvent.keyDown(passwordInput, {key: 'Enter'});

        expect(fetch).toHaveBeenCalled();
    });

    test('handles successful login', async () => {
        const payload = {
            sub: '1234567890',
            name: 'John Doe',
            iat: 1516239022,
            exp: Math.floor(Date.now() / 1000) + 3600,
        };
        const mockToken = createMockToken(payload);
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({token: mockToken}),
        });

        render(<Login/>);

        fireEvent.change(screen.getByLabelText('Username'), {target: {value: 'testuser'}});
        fireEvent.change(screen.getByLabelText('Password'), {target: {value: 'testpass'}});
        fireEvent.click(screen.getByText('Submit'));

        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith(URL_TOKEN, {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + btoa('testuser:testpass'),
                },
            });
            expect(localStorage.getItem('authToken')).toBe(mockToken);
            expect(mockDispatch).toHaveBeenCalledWith({
                type: SetAccessToken,
                data: mockToken,
            });
            expect(mockNavigate).toHaveBeenCalledWith('/');
        });
    });

    test('handles login error', async () => {
        fetch.mockRejectedValueOnce(new Error('Incorrect username or password'));

        render(<Login/>);

        fireEvent.change(screen.getByLabelText('Username'), {target: {value: 'wronguser'}});
        fireEvent.change(screen.getByLabelText('Password'), {target: {value: 'wrongpass'}});
        fireEvent.click(screen.getByText('Submit'));

        await waitFor(() => {
            expect(screen.getByText('Incorrect username or password')).toBeInTheDocument();
        });
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
        const mockToken = createMockToken(payload);
        jest.spyOn(Date, 'now').mockImplementation(() => 1000000);
        localStorage.setItem('authToken', 'old.token.123');
        localStorage.setItem('tokenExpiration', '2000000'); // Future expiration

        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({token: mockToken}),
        });

        await refreshToken(mockDispatch);

        expect(fetch).toHaveBeenCalledWith(URL_TOKEN, {
            method: 'POST',
            headers: {'Authorization': 'Bearer old.token.123'},
        });
        expect(localStorage.getItem('authToken')).toBe(mockToken);
        expect(mockDispatch).toHaveBeenCalledWith({
            type: SetAccessToken,
            data: mockToken,
        });
    });
});
