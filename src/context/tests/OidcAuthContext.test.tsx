import {renderHook, act} from '@testing-library/react';
import {OidcProvider, useOidc, cleanupUserManager} from '../OidcAuthContext';
import {UserManager} from 'oidc-client-ts';

jest.mock('oidc-client-ts', () => ({
    UserManager: jest.fn().mockImplementation(() => ({
        events: {
            removeUserLoaded: jest.fn(),
            removeUserUnloaded: jest.fn(),
            removeAccessTokenExpired: jest.fn(),
            removeAccessTokenExpiring: jest.fn(),
            removeSilentRenewError: jest.fn(),
        },
        clearStaleState: jest.fn(),
    })),
}));

describe('OidcAuthContext', () => {
    const wrapper = ({children}: { children: React.ReactNode }) => (
        <OidcProvider>{children}</OidcProvider>
    );

    // Clear mocks before each test to ensure isolation
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('provides userManager context', () => {
        const {result} = renderHook(() => useOidc(), {wrapper});
        expect(result.current.userManager).toBeDefined();
    });

    test('throws when used outside provider', () => {
        expect(() => {
            renderHook(() => useOidc());
        }).toThrow('useOidc must be used within an OidcProvider');
    });

    test('recreateUserManager updates userManager with new settings', () => {
        const settings = {authority: 'https://example.com', client_id: 'test-client'};
        const {result} = renderHook(() => useOidc(), {wrapper});
        act(() => {
            result.current.recreateUserManager(settings);
        });
        expect(result.current.userManager).toBeDefined();
        expect(UserManager).toHaveBeenCalledWith(settings);
    });

    test('cleanupUserManager removes event listeners and clears stale state', () => {
        const mockUserManager = {
            events: {
                removeUserLoaded: jest.fn(),
                removeUserUnloaded: jest.fn(),
                removeAccessTokenExpired: jest.fn(),
                removeAccessTokenExpiring: jest.fn(),
                removeSilentRenewError: jest.fn(),
            },
            clearStaleState: jest.fn(),
        };
        cleanupUserManager(mockUserManager);
        expect(mockUserManager.events.removeUserLoaded).toHaveBeenCalled();
        expect(mockUserManager.events.removeUserUnloaded).toHaveBeenCalled();
        expect(mockUserManager.events.removeAccessTokenExpired).toHaveBeenCalled();
        expect(mockUserManager.events.removeAccessTokenExpiring).toHaveBeenCalled();
        expect(mockUserManager.events.removeSilentRenewError).toHaveBeenCalled();
        expect(mockUserManager.clearStaleState).toHaveBeenCalled();
    });

    test('cleanupUserManager does nothing if userManager is null', () => {
        cleanupUserManager(null);
        expect(UserManager).not.toHaveBeenCalled();
    });
});
