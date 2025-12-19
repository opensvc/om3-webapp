import oidcConfiguration from '../oidcConfiguration';

// Mock window.location
const mockLocation = {
    origin: 'https://example.com',
    pathname: '/app/subpath/index.html',
};
Object.defineProperty(window, 'location', {
    value: mockLocation,
    writable: true,
});

// Mock fetch globally
global.fetch = jest.fn();

// Mock WebStorageStateStore
jest.mock("oidc-client-ts", () => ({
    WebStorageStateStore: jest.fn().mockImplementation(() => ({})),
}));

describe('oidcConfiguration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        console.warn = jest.fn();
        console.error = jest.fn();
    });

    test('returns default configuration when authInfo is missing', async () => {
        const result = await oidcConfiguration(null);
        expect(result).toEqual({
            client_id: 'om3',
            response_type: 'code',
            accessTokenExpiringNotificationTimeInSeconds: 30,
            automaticSilentRenew: true,
            monitorSession: true,
        });
        expect(console.warn).toHaveBeenCalledWith(
            "OIDC Configuration fallback: 'authInfo.openid.issuer' is missing. Falling back to default configuration."
        );
    });

    test('returns default configuration when authInfo.openid.issuer is missing', async () => {
        const authInfo = {openid: {}};
        const result = await oidcConfiguration(authInfo);
        expect(result).toEqual({
            client_id: 'om3',
            response_type: 'code',
            accessTokenExpiringNotificationTimeInSeconds: 30,
            automaticSilentRenew: true,
            monitorSession: true,
        });
        expect(console.warn).toHaveBeenCalledWith(
            "OIDC Configuration fallback: 'authInfo.openid.issuer' is missing. Falling back to default configuration."
        );
    });

    test('handles malformed URI and returns default configuration', async () => {
        const authInfo = {openid: {issuer: 'invalid-url', client_id: 'om3'}};
        const result = await oidcConfiguration(authInfo);
        expect(result).toEqual({
            client_id: 'om3',
            response_type: 'code',
            accessTokenExpiringNotificationTimeInSeconds: 30,
            automaticSilentRenew: true,
            monitorSession: true,
        });
        expect(console.error).toHaveBeenCalledWith(
            'Well-formed URL required for openid.issuer',
            expect.objectContaining({message: 'Invalid URL: invalid-url'})
        );
    });

    test('fetches well-known configuration and builds config with filtered scopes', async () => {
        const authInfo = {openid: {issuer: 'https://auth.example.com', client_id: 'test-client'}};
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({scopes_supported: ['openid', 'profile']}),
        });

        const result = await oidcConfiguration(authInfo);
        expect(String(fetch.mock.calls[0][0])).toEqual('https://auth.example.com/.well-known/openid-configuration');
        expect(result).toEqual({
            client_id: 'test-client',
            response_type: 'code',
            accessTokenExpiringNotificationTimeInSeconds: 30,
            automaticSilentRenew: true,
            monitorSession: true,
            authority: 'https://auth.example.com',
            scope: 'openid profile',
            redirect_uri: 'https://example.com/app/subpath/auth-callback',
            silent_redirect_uri: 'https://example.com/app/subpath/silent-renew',
            useRefreshToken: true,
            post_logout_redirect_uri: 'https://example.com/app/subpath/',
            userStore: expect.any(Object),
        });
    });

    test('handles non-OK fetch response and uses default scopes', async () => {
        const authInfo = {openid: {issuer: 'https://auth.example.com', client_id: 'test-client'}};
        fetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
        });

        const result = await oidcConfiguration(authInfo);
        expect(String(fetch.mock.calls[0][0])).toEqual('https://auth.example.com/.well-known/openid-configuration');
        expect(console.warn).toHaveBeenCalledWith('Failed to fetch .well-known/openid-configuration:', 404);
        expect(result).toEqual({
            client_id: 'test-client',
            response_type: 'code',
            accessTokenExpiringNotificationTimeInSeconds: 30,
            automaticSilentRenew: true,
            monitorSession: true,
            authority: 'https://auth.example.com',
            scope: 'openid profile email offline_access opensvc:om3 opensvc:om3:root opensvc:om3:guest opensvc:badscope',
            redirect_uri: 'https://example.com/app/subpath/auth-callback',
            silent_redirect_uri: 'https://example.com/app/subpath/silent-renew',
            useRefreshToken: true,
            post_logout_redirect_uri: 'https://example.com/app/subpath/',
            userStore: expect.any(Object),
        });
    });

    test('appends trailing slash to issuer URL if missing', async () => {
        const authInfo = {openid: {issuer: 'https://auth.example.com/oidc', client_id: 'test-client'}};
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({scopes_supported: ['openid']}),
        });

        await oidcConfiguration(authInfo);
        expect(String(fetch.mock.calls[0][0])).toEqual('https://auth.example.com/oidc/.well-known/openid-configuration');
    });

    test('handles fetch error and returns default configuration', async () => {
        const authInfo = {openid: {issuer: 'https://auth.example.com', client_id: 'om3'}};
        fetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await oidcConfiguration(authInfo);
        expect(console.error).toHaveBeenCalledWith(
            'Well-formed URL required for openid.issuer',
            expect.objectContaining({message: 'Network error'})
        );
        expect(result).toEqual({
            client_id: 'om3',
            response_type: 'code',
            accessTokenExpiringNotificationTimeInSeconds: 30,
            automaticSilentRenew: true,
            monitorSession: true,
        });
    });
});
