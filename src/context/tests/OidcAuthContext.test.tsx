import {renderHook, act} from '@testing-library/react';
import {OidcProvider, useOidc, cleanupUserManager} from '../OidcAuthContext';
import {UserManager, UserManagerSettings} from 'oidc-client-ts';
import logger from '../../utils/logger';

// Mock logger
jest.mock('../../utils/logger', () => ({
    info: jest.fn(),
    debug: jest.fn(),
}));

// Mock UserManager
const mockUserManagerInstance = {
    events: {
        removeUserLoaded: jest.fn().mockImplementation((cb) => cb()),
        removeUserUnloaded: jest.fn().mockImplementation((cb) => cb()),
        removeAccessTokenExpired: jest.fn().mockImplementation((cb) => cb()),
        removeAccessTokenExpiring: jest.fn().mockImplementation((cb) => cb()),
        removeSilentRenewError: jest.fn().mockImplementation((cb) => cb()),
    },
    clearStaleState: jest.fn().mockResolvedValue(undefined),
};

jest.mock('oidc-client-ts', () => ({
    UserManager: jest.fn().mockImplementation(() => mockUserManagerInstance),
    Log: {
        logger: console,
        level: 0,
        DEBUG: 3,
    },
}));

describe('OidcAuthContext', () => {
    const wrapper = ({children}: { children: React.ReactNode }) => (
        <OidcProvider>{children}</OidcProvider>
    );

    beforeEach(() => {
        jest.clearAllMocks();
        delete (window as any).oidcUserManager;
    });

    test('provides userManager context', () => {
        const {result} = renderHook(() => useOidc(), {wrapper});
        expect(result.current.userManager).toBeDefined();
        expect(result.current.recreateUserManager).toBeInstanceOf(Function);
        expect(result.current.isInitialized).toBe(false);
    });

    test('throws when used outside provider', () => {
        expect(() => {
            renderHook(() => useOidc());
        }).toThrow('useOidc must be used within an OidcProvider');
    });

    test('recreateUserManager updates userManager with new settings and sets global reference', () => {
        const settings: UserManagerSettings = {
            authority: 'https://example.com',
            client_id: 'test-client',
            redirect_uri: 'https://example.com/callback',
        };
        const {result} = renderHook(() => useOidc(), {wrapper});
        act(() => {
            result.current.recreateUserManager(settings);
        });
        expect(result.current.userManager).toBeDefined();
        expect(UserManager).toHaveBeenCalledWith(settings);
        expect((window as any).oidcUserManager).toBe(mockUserManagerInstance);
    });

    test('cleanupUserManager removes event listeners and clears stale state', () => {
        const mockUserManager = {
            events: {
                removeUserLoaded: jest.fn().mockImplementation((cb) => cb()),
                removeUserUnloaded: jest.fn().mockImplementation((cb) => cb()),
                removeAccessTokenExpired: jest.fn().mockImplementation((cb) => cb()),
                removeAccessTokenExpiring: jest.fn().mockImplementation((cb) => cb()),
                removeSilentRenewError: jest.fn().mockImplementation((cb) => cb()),
            },
            clearStaleState: jest.fn().mockResolvedValue(undefined),
        };
        cleanupUserManager(mockUserManager as unknown as UserManager);
        expect(mockUserManager.events.removeUserLoaded).toHaveBeenCalledWith(expect.any(Function));
        expect(mockUserManager.events.removeUserUnloaded).toHaveBeenCalledWith(expect.any(Function));
        expect(mockUserManager.events.removeAccessTokenExpired).toHaveBeenCalledWith(expect.any(Function));
        expect(mockUserManager.events.removeAccessTokenExpiring).toHaveBeenCalledWith(expect.any(Function));
        expect(mockUserManager.events.removeSilentRenewError).toHaveBeenCalledWith(expect.any(Function));
        expect(mockUserManager.clearStaleState).toHaveBeenCalled();
    });

    test('cleanupUserManager does nothing if userManager is null', () => {
        cleanupUserManager(null);
        expect(UserManager).not.toHaveBeenCalled();
        expect(mockUserManagerInstance.events.removeUserLoaded).not.toHaveBeenCalled();
        expect(mockUserManagerInstance.clearStaleState).not.toHaveBeenCalled();
    });

    test('cleanupUserManager handles missing event methods gracefully', () => {
        const userManagerWithMissingEvents = {
            events: {
                removeUserUnloaded: jest.fn(),
                removeAccessTokenExpired: jest.fn(),
                removeAccessTokenExpiring: jest.fn(),
                removeSilentRenewError: jest.fn(),
            },
            clearStaleState: jest.fn().mockResolvedValue(undefined),
        };
        expect(() => {
            cleanupUserManager(userManagerWithMissingEvents as unknown as UserManager);
        }).not.toThrow();
        expect(userManagerWithMissingEvents.events.removeUserUnloaded).toHaveBeenCalled();
        expect(userManagerWithMissingEvents.clearStaleState).toHaveBeenCalled();
    });

    test('cleanupUserManager catches errors from event removal', () => {
        const mockError = new Error('Removal failed');
        const userManagerWithFailingEvents = {
            events: {
                removeUserLoaded: jest.fn().mockImplementation(() => {
                    throw mockError;
                }),
                removeUserUnloaded: jest.fn(),
                removeAccessTokenExpired: jest.fn(),
                removeAccessTokenExpiring: jest.fn(),
                removeSilentRenewError: jest.fn(),
            },
            clearStaleState: jest.fn().mockResolvedValue(undefined),
        };
        cleanupUserManager(userManagerWithFailingEvents as unknown as UserManager);
        expect(logger.debug).toHaveBeenCalledWith(
            'Error removing UserManager listener:',
            mockError
        );
        expect(userManagerWithFailingEvents.clearStaleState).toHaveBeenCalled();
    });

    test('cleanupUserManager logs error when clearStaleState rejects', async () => {
        const mockError = new Error('Clear stale state failed');
        const userManagerWithFailingClear = {
            events: {
                removeUserLoaded: jest.fn(),
                removeUserUnloaded: jest.fn(),
                removeAccessTokenExpired: jest.fn(),
                removeAccessTokenExpiring: jest.fn(),
                removeSilentRenewError: jest.fn(),
            },
            clearStaleState: jest.fn().mockRejectedValue(mockError),
        };
        cleanupUserManager(userManagerWithFailingClear as unknown as UserManager);
        await new Promise(process.nextTick);
        expect(logger.debug).toHaveBeenCalledWith(
            'Error during clearStaleState:',
            mockError
        );
    });

    test('useEffect cleanup is called on unmount with userManager and deletes global reference', () => {
        const settings: UserManagerSettings = {
            authority: 'https://example.com',
            client_id: 'test-client',
            redirect_uri: 'https://example.com/callback',
        };
        const {result, unmount} = renderHook(() => useOidc(), {wrapper});
        act(() => {
            result.current.recreateUserManager(settings);
        });
        expect(result.current.userManager).toBe(mockUserManagerInstance);
        expect((window as any).oidcUserManager).toBe(mockUserManagerInstance);
        unmount();
        expect(mockUserManagerInstance.events.removeUserLoaded).toHaveBeenCalledWith(expect.any(Function));
        expect(mockUserManagerInstance.events.removeUserUnloaded).toHaveBeenCalledWith(expect.any(Function));
        expect(mockUserManagerInstance.events.removeAccessTokenExpired).toHaveBeenCalledWith(expect.any(Function));
        expect(mockUserManagerInstance.events.removeAccessTokenExpiring).toHaveBeenCalledWith(expect.any(Function));
        expect(mockUserManagerInstance.events.removeSilentRenewError).toHaveBeenCalledWith(expect.any(Function));
        expect(mockUserManagerInstance.clearStaleState).toHaveBeenCalled();
        expect((window as any).oidcUserManager).toBeUndefined();
    });

    test('useEffect cleanup handles null userManager on unmount', () => {
        const {unmount} = renderHook(() => useOidc(), {wrapper});
        unmount();
        expect(mockUserManagerInstance.events.removeUserLoaded).not.toHaveBeenCalled();
        expect(mockUserManagerInstance.clearStaleState).not.toHaveBeenCalled();
        expect((window as any).oidcUserManager).toBeUndefined();
    });
});
