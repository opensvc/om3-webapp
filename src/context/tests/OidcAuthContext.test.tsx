import { renderHook } from '@testing-library/react';
import { OidcProvider, useOidc } from '../OidcAuthContext';

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
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <OidcProvider>{children}</OidcProvider>
    );

    test('provides userManager context', () => {
        const { result } = renderHook(() => useOidc(), { wrapper });
        expect(result.current.userManager).toBeDefined();
    });

    test('throws when used outside provider', () => {
        expect(() => {
            renderHook(() => useOidc());
        }).toThrow('useOidc must be used within an OidcProvider');
    });
});