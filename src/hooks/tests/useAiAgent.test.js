import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {renderHook} from '@testing-library/react';
import useAiAgent from '../useAiAgent.js';

const state = vi.hoisted(() => ({auth: null}));
vi.mock('../../context/AuthProvider.jsx', () => ({useAuth: () => state.auth}));
// The cluster ID and the agent URL, as the cluster status gives them.
const target = {clusterId: 'cluster-id', agentUrl: 'https://agent.example.com:8090'};

describe('useAiAgent', () => {
    beforeEach(() => {
        state.auth = {authChoice: 'openid', accessToken: 'token', user: 'hugo'};
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.resolve(Response.json({conversations: []})))
        );
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });
    it('calls the agent the cluster names, with the token and the cluster ID', async () => {
        const {result} = renderHook(() => useAiAgent(target));
        expect(result.current).toMatchObject({enabled: true, openid: true, ready: true});
        await result.current.client.listConversations();
        expect(fetch.mock.calls[0][0]).toBe('https://agent.example.com:8090/v1/om3/conversations');
        expect(fetch.mock.calls[0][1]).toMatchObject({
            credentials: 'omit',
            headers: {Authorization: 'Bearer token', 'X-OpenSVC-Cluster-ID': 'cluster-id'},
        });
    });
    it.each([undefined, ''])('disables the client for a cluster without agent URL (%s)', (agentUrl) => {
        const {result} = renderHook(() => useAiAgent({...target, agentUrl}));
        expect(result.current).toMatchObject({enabled: false, ready: false, client: null});
        expect(fetch).not.toHaveBeenCalled();
    });
    it('isolates an invalid agent URL from the rest of the webapp', () => {
        const {result} = renderHook(() => useAiAgent({...target, agentUrl: 'http://agent.example.com'}));
        expect(result.current.enabled).toBe(false);
        expect(result.current.configurationError).toContain('HTTPS');
    });
    it('follows a change of the agent URL of the cluster', () => {
        const {result, rerender} = renderHook((props) => useAiAgent(props), {initialProps: target});
        const client = result.current.client;
        rerender({...target, agentUrl: 'https://other.example.com'});
        expect(result.current.client).not.toBe(client);
    });
    it.each([{...target, clusterId: ''}, {agentUrl: target.agentUrl}])('waits for a fresh cluster ID', async (value) => {
        const {result} = renderHook(() => useAiAgent(value));
        expect(result.current.ready).toBe(false);
        await expect(result.current.client.listConversations()).rejects.toMatchObject({
            code: 'not_ready',
        });
        expect(fetch).not.toHaveBeenCalled();
    });
    it.each(['basic', null, ''])(
        'is not ready for a session not OpenID (authChoice %s), which the agent does not take',
        async (authChoice) => {
            state.auth.authChoice = authChoice;
            const {result} = renderHook(() => useAiAgent(target));
            expect(result.current).toMatchObject({openid: false, ready: false});
            await expect(result.current.client.listConversations()).rejects.toMatchObject({code: 'not_ready'});
            expect(fetch).not.toHaveBeenCalled();
        }
    );
    it('rejects a missing token', async () => {
        state.auth = {...state.auth, accessToken: null};
        const {result} = renderHook(() => useAiAgent(target));
        expect(result.current.ready).toBe(false);
        await expect(result.current.client.listConversations()).rejects.toMatchObject({
            code: 'not_ready',
        });
        expect(fetch).not.toHaveBeenCalled();
    });
    it('keeps the client stable with a renewed token', async () => {
        const {result, rerender} = renderHook(() => useAiAgent(target));
        const client = result.current.client;
        const cancel = vi.spyOn(client, 'cancelAll');
        await client.listConversations();
        state.auth = {...state.auth, accessToken: 'renewed-token'};
        rerender();
        expect(result.current.client).toBe(client);
        expect(cancel).not.toHaveBeenCalled();
        await client.listConversations();
        expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer renewed-token');
    });
    it.each(['logout', 'user', 'cluster', 'unmount'])(
        'cancels outstanding requests on %s',
        (change) => {
            const {result, rerender, unmount} = renderHook((props) => useAiAgent(props), {
                initialProps: target,
            });
            const cancel = vi.spyOn(result.current.client, 'cancelAll');
            if (change === 'logout') {
                state.auth = {...state.auth, accessToken: null};
                rerender(target);
            }
            if (change === 'user') {
                state.auth = {...state.auth, user: 'someone-else'};
                rerender(target);
            }
            if (change === 'cluster') rerender({...target, clusterId: 'another-cluster'});
            if (change === 'unmount') unmount();
            expect(cancel).toHaveBeenCalledTimes(1);
        }
    );
});
