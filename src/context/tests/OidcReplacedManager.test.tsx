import {renderHook, act} from '@testing-library/react';
import {InMemoryWebStorage, User, UserManager, WebStorageStateStore} from 'oidc-client-ts';
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';
import {OidcProvider, useOidc} from '../OidcAuthContext';

// The real oidc-client-ts: its automatic renewal is what a replaced manager must stop.
const AUTHORITY = 'https://idp.example';
const CLIENT_ID = 'om3';

/** The settings the webapp builds, its user stored where both managers read it. */
const settings = (store: InMemoryWebStorage) => ({
    authority: AUTHORITY,
    client_id: CLIENT_ID,
    redirect_uri: 'https://node/auth-callback',
    automaticSilentRenew: true,
    userStore: new WebStorageStateStore({store}),
});

describe('a replaced UserManager', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    /** Renewals counted, none sent: the bound method each manager wraps (serialRenewal). */
    const countRenewals = () => {
        const renewals: UserManager[] = [];
        vi.spyOn(UserManager.prototype, 'signinSilent').mockImplementation(async function (this: UserManager) {
            renewals.push(this);
            return null;
        });
        return renewals;
    };

    /** A user signed in, its access token expiring in 2 minutes. */
    const signedIn = () => {
        const store = new InMemoryWebStorage();
        const user = new User({
            access_token: 'at', token_type: 'Bearer', refresh_token: 'rt',
            profile: {sub: 'u', iss: AUTHORITY, aud: CLIENT_ID, exp: 0, iat: 0},
            expires_at: Math.floor(Date.now() / 1000) + 120,
        });
        // WebStorageStateStore keys its entries under its "oidc." prefix.
        store.setItem(`oidc.user:${AUTHORITY}:${CLIENT_ID}`, user.toStorageString());
        return store;
    };

    test('asked again with the same settings, the manager is kept: one renewal as the token expires', async () => {
        const renewals = countRenewals();
        const store = signedIn();
        const {result} = renderHook(() => useOidc(), {wrapper: OidcProvider});
        // Built when none is there, by App, AuthChoice and OidcCallback each.
        act(() => result.current.recreateUserManager(settings(store)));
        const first = result.current.userManager;
        act(() => result.current.recreateUserManager(settings(store)));
        expect(result.current.userManager).toBe(first);

        // Past the expiring notice (60 s before the end).
        await act(() => vi.advanceTimersByTimeAsync(70_000));
        expect(renewals).toEqual([first]);
    });

    test('replaced, it renews no more: one renewal as the token expires, by the current manager', async () => {
        const renewals = countRenewals();
        const store = signedIn();
        const {result} = renderHook(() => useOidc(), {wrapper: OidcProvider});
        act(() => result.current.recreateUserManager(settings(store)));
        const first = result.current.userManager;
        // Other settings, the same user stored: a manager of its own.
        act(() => result.current.recreateUserManager({...settings(store), redirect_uri: 'https://other/auth-callback'}));
        const current = result.current.userManager;
        expect(current).not.toBe(first);

        await act(() => vi.advanceTimersByTimeAsync(70_000));
        expect(renewals).toEqual([current]);
    });
});
