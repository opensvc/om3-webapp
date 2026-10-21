import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {vi} from 'vitest';
import {EnrollDialog, EvictDialog, RegisterDialog, notDrainedReason} from '../NodeMembership';
import useEventStore from '../../hooks/useEventStore.js';
import {onClusterStatusReread} from '../../hooks/clusterStatusOnce';
import {useActionTracker} from '../../app/action-tracker';

/** What the actions tray holds, the latest first: action, subject, state, reason. */
const tray = () => useActionTracker.getState().tracked.map((e) => [e.action, e.subject, e.state, e.error ?? null]);

const FROZEN = '2026-10-20T10:00:00Z';
const ZERO = '0001-01-01T00:00:00Z';

describe('notDrainedReason', () => {
    const store = (status, monitor = {state: 'idle'}, instances = {}) => ({
        nodeStatus: status === undefined ? {} : {n2: status},
        nodeMonitor: {n2: monitor},
        objectInstanceStatus: instances,
    });

    test('drained: frozen, no drain in progress nor failed, no svc running', () => {
        expect(notDrainedReason('n2', store({frozen_at: FROZEN}, {state: 'idle'}, {
            'root/svc/web': {n2: {avail: 'down'}, n1: {avail: 'up'}},
            // A volume or a datastore up is no reason: the daemon counts the svc alone.
            'root/vol/data': {n2: {avail: 'up'}},
        }))).toBeNull();
    });

    test('not drained, why: unknown, not frozen, draining, drain failed, svc still up or warn', () => {
        expect(notDrainedReason('n2', store(undefined))).toEqual({key: 'unknown'});
        expect(notDrainedReason('n2', store({frozen_at: ZERO}))).toEqual({key: 'notFrozen'});
        expect(notDrainedReason('n2', store({frozen_at: FROZEN}, {state: 'draining'}))).toEqual({key: 'draining'});
        expect(notDrainedReason('n2', store({frozen_at: FROZEN}, {state: 'idle', local_expect: 'drained'}))).toEqual({key: 'draining'});
        expect(notDrainedReason('n2', store({frozen_at: FROZEN}, {state: 'drain failed'}))).toEqual({key: 'drainFailed'});
        expect(notDrainedReason('n2', store({frozen_at: FROZEN}, {state: 'idle'}, {
            'root/svc/web': {n2: {avail: 'warn'}},
            'ns1/svc/db': {n2: {avail: 'up'}},
        }))).toEqual({key: 'running', paths: ['ns1/svc/db', 'root/svc/web']});
    });
});

describe('node membership dialogs', () => {
    let requests;
    /** What the cluster status says, a test changing it as the cluster changes. */
    let status;
    /** What the posts answer, by the end of their address. */
    let answers;

    beforeEach(() => {
        useActionTracker.setState({tracked: [], revealed: 0});
        localStorage.setItem('authToken', 'tok');
        requests = [];
        status = {daemon: {nodename: 'n1'}, cluster: {config: {nodes: ['n1', 'n2']}, node: {n1: {monitor: {state: 'idle'}}, n2: {monitor: {state: 'idle'}}}}};
        answers = {};
        global.fetch = vi.fn(async (url, options = {}) => {
            const method = options.method ?? 'GET';
            requests.push({method, url, body: options.body ? JSON.parse(options.body) : undefined});
            if (url === '/api/cluster/status') return new Response(JSON.stringify(status), {status: 200});
            // An exec followed: held, as the daemon holds it until it ends.
            if (url.includes('/daemon/exec/id/')) return new Promise(() => undefined);
            const answer = Object.entries(answers).find(([end]) => url.endsWith(end))?.[1] ?? {status: 200, body: {}};
            return new Response(JSON.stringify(answer.body), {status: answer.status});
        });
        useEventStore.setState({
            nodeStatus: {n1: {frozen_at: ZERO}, n2: {frozen_at: FROZEN}},
            nodeMonitor: {n1: {state: 'idle'}, n2: {state: 'idle'}},
            objectInstanceStatus: {},
        });
    });

    afterEach(() => {
        localStorage.clear();
        vi.useRealTimers();
    });

    const posts = () => requests.filter((r) => r.method === 'POST');
    const dialog = () => screen.getByRole('dialog');

    describe('enroll', () => {
        const fill = ({address = 'n3.example.com', token = 'eyJ.join.token', joinAddr} = {}) => {
            fireEvent.change(within(dialog()).getByLabelText('Address of the node'), {target: {value: address}});
            fireEvent.change(within(dialog()).getByLabelText('Join token'), {target: {value: token}});
            if (joinAddr) fireEvent.change(within(dialog()).getByLabelText('Address of this cluster (optional)'), {target: {value: joinAddr}});
        };

        test('asks the address and the join token, and the drain of the node acknowledged', async () => {
            render(<EnrollDialog open onClose={() => {}}/>);
            expect(dialog()).toHaveTextContent('Add a node to the cluster');
            expect(dialog()).toHaveTextContent('om daemon auth --role join');
            expect(within(dialog()).getByRole('alert')).toHaveTextContent(/its instances are stopped, stay down, and are removed/);
            const submit = within(dialog()).getByRole('button', {name: 'Add the node'});
            expect(submit).toBeDisabled();
            fireEvent.click(within(dialog()).getByLabelText('I understand the instances of the node are stopped and removed'));
            expect(submit).toBeEnabled();
            fireEvent.click(submit);
            expect(await within(dialog()).findByText('The address of the node is required')).toBeInTheDocument();
            expect(within(dialog()).getByText('The join token is required')).toBeInTheDocument();
            expect(posts()).toEqual([]);
        });

        test('posted, followed in the tray by the nodename it answers, until the node is in the cluster, beating', async () => {
            answers['/api/cluster/enroll'] = {status: 200, body: {node: 'n3'}};
            const onClose = vi.fn();
            const reread = vi.fn();
            const stop = onClusterStatusReread(reread);
            vi.useFakeTimers({shouldAdvanceTime: true});
            render(<EnrollDialog open onClose={onClose}/>);
            fill({address: ' n3.example.com:1215 ', token: 'eyJ.join.token\n', joinAddr: 'n1.example.com'});
            fireEvent.click(within(dialog()).getByLabelText('I understand the instances of the node are stopped and removed'));
            fireEvent.click(within(dialog()).getByRole('button', {name: 'Add the node'}));
            await waitFor(() => expect(onClose).toHaveBeenCalled());
            expect(posts()).toEqual([{
                method: 'POST',
                url: '/api/cluster/enroll',
                body: {node: 'n3.example.com:1215', token: 'eyJ.join.token', join_addr: 'n1.example.com'},
            }]);
            await waitFor(() => expect(tray()).toEqual([['enroll', 'n3', 'running', null]]));
            // In the cluster nodes, not yet beating: still running.
            status.cluster.config.nodes.push('n3');
            await act(async () => {
                await vi.advanceTimersByTimeAsync(3500);
            });
            expect(tray()).toEqual([['enroll', 'n3', 'running', null]]);
            status.cluster.node.n3 = {monitor: {state: 'idle'}};
            await act(async () => {
                await vi.advanceTimersByTimeAsync(3500);
            });
            await waitFor(() => expect(tray()).toEqual([['enroll', 'n3', 'succeeded', null]]));
            // The nodes of the cluster configuration read again, the nodes list with them.
            expect(reread).toHaveBeenCalled();
            stop();
        });

        test('refused, the dialog stays and says why, as the tray does', async () => {
            answers['/api/cluster/enroll'] = {status: 409, body: {detail: "node 'n3' is a member of a 2 nodes cluster"}};
            const onClose = vi.fn();
            render(<EnrollDialog open onClose={onClose}/>);
            fill();
            fireEvent.click(within(dialog()).getByLabelText('I understand the instances of the node are stopped and removed'));
            fireEvent.click(within(dialog()).getByRole('button', {name: 'Add the node'}));
            expect(await within(dialog()).findByText(/HTTP 409 .*member of a 2 nodes cluster/)).toBeInTheDocument();
            expect(onClose).not.toHaveBeenCalled();
            expect(tray()).toEqual([['enroll', 'n3.example.com', 'refused', expect.stringMatching(/^HTTP 409/)]]);
        });
    });

    describe('evict', () => {
        test('drained, posted with the user to create, followed until the node is out of the cluster nodes', async () => {
            const onClose = vi.fn();
            const reread = vi.fn();
            const stop = onClusterStatusReread(reread);
            vi.useFakeTimers({shouldAdvanceTime: true});
            render(<EvictDialog open node="n2" onClose={onClose}/>);
            expect(dialog()).toHaveTextContent('Evict node n2');
            expect(dialog()).toHaveTextContent(/restarts alone, in a cluster of its own/);
            const submit = within(dialog()).getByRole('button', {name: 'Evict'});
            expect(submit).toBeDisabled();
            fireEvent.change(within(dialog()).getByLabelText('User to create (optional)'), {target: {value: 'admin'}});
            fireEvent.change(within(dialog()).getByLabelText('Password'), {target: {value: 's3cret'}});
            fireEvent.click(within(dialog()).getByLabelText('I understand n2 leaves the cluster'));
            fireEvent.click(submit);
            await waitFor(() => expect(onClose).toHaveBeenCalled());
            expect(posts()).toEqual([{method: 'POST', url: '/api/cluster/evict', body: {nodename: 'n2', credential: 'admin:s3cret'}}]);
            await waitFor(() => expect(tray()).toEqual([['evict', 'n2', 'running', null]]));
            status.cluster.config.nodes = ['n1'];
            await act(async () => {
                await vi.advanceTimersByTimeAsync(3500);
            });
            await waitFor(() => expect(tray()).toEqual([['evict', 'n2', 'succeeded', null]]));
            expect(reread).toHaveBeenCalled();
            stop();
        });

        test('without a user, none is asked for; a user without its password is refused before it is posted', async () => {
            const onClose = vi.fn();
            render(<EvictDialog open node="n2" onClose={onClose}/>);
            fireEvent.click(within(dialog()).getByLabelText('I understand n2 leaves the cluster'));
            fireEvent.change(within(dialog()).getByLabelText('User to create (optional)'), {target: {value: 'admin'}});
            expect(within(dialog()).getByText('A user needs its password')).toBeInTheDocument();
            fireEvent.click(within(dialog()).getByRole('button', {name: 'Evict'}));
            expect(posts()).toEqual([]);
            fireEvent.change(within(dialog()).getByLabelText('User to create (optional)'), {target: {value: ''}});
            fireEvent.click(within(dialog()).getByRole('button', {name: 'Evict'}));
            await waitFor(() => expect(onClose).toHaveBeenCalled());
            expect(posts()).toEqual([{method: 'POST', url: '/api/cluster/evict', body: {nodename: 'n2'}}]);
        });

        test('not drained, it says why and asks nothing: drain it first', async () => {
            useEventStore.setState({objectInstanceStatus: {'root/svc/web': {n2: {avail: 'up'}}}});
            render(<EvictDialog open node="n2" onClose={() => {}}/>);
            expect(within(dialog()).getByRole('alert')).toHaveTextContent('Not drained: it still runs root/svc/web. Drain it first, from its actions.');
            expect(within(dialog()).getByLabelText('I understand n2 leaves the cluster')).toBeDisabled();
            expect(within(dialog()).getByRole('button', {name: 'Evict'})).toBeDisabled();
            // Drained meanwhile, the events tell it: it can be asked.
            act(() => useEventStore.setState({objectInstanceStatus: {'root/svc/web': {n2: {avail: 'down'}}}}));
            expect(within(dialog()).queryByRole('alert')).not.toBeInTheDocument();
            expect(within(dialog()).getByLabelText('I understand n2 leaves the cluster')).toBeEnabled();
        });

        test('the node serving this page can not evict itself: from a peer', async () => {
            useEventStore.setState({nodeStatus: {n1: {frozen_at: FROZEN}}});
            render(<EvictDialog open node="n1" onClose={() => {}}/>);
            expect(await within(dialog()).findByText('This page is served by n1, which can not evict itself: evict it from the page of one of its peers.')).toBeInTheDocument();
            expect(within(dialog()).getByRole('button', {name: 'Evict'})).toBeDisabled();
        });

        test('refused by the node, as it tells it is not drained, the dialog stays and says why', async () => {
            answers['/api/cluster/evict'] = {status: 409, body: {detail: "node 'n2' refused the leave order: it still runs root/svc/web"}};
            const onClose = vi.fn();
            render(<EvictDialog open node="n2" onClose={onClose}/>);
            fireEvent.click(within(dialog()).getByLabelText('I understand n2 leaves the cluster'));
            fireEvent.click(within(dialog()).getByRole('button', {name: 'Evict'}));
            expect(await within(dialog()).findByText(/HTTP 409 .*refused the leave order/)).toBeInTheDocument();
            expect(onClose).not.toHaveBeenCalled();
            expect(tray()).toEqual([['evict', 'n2', 'refused', expect.stringMatching(/refused the leave order/)]]);
        });
    });

    describe('register', () => {
        test('each node registers itself, its run followed in the tray', async () => {
            answers['/action/register'] = {status: 200, body: {exec_id: 'e1', session_id: 's1'}};
            const onClose = vi.fn();
            render(<RegisterDialog open nodes={['n1', 'n2']} onClose={onClose}/>);
            expect(within(dialog()).getByRole('list')).toHaveTextContent('n1n2');
            fireEvent.change(within(dialog()).getByLabelText('Collector user (optional)'), {target: {value: 'ops'}});
            fireEvent.change(within(dialog()).getByLabelText('Password'), {target: {value: 'pw'}});
            fireEvent.change(within(dialog()).getByLabelText('App (optional)'), {target: {value: ' MyApp '}});
            fireEvent.click(within(dialog()).getByRole('button', {name: 'Register'}));
            await waitFor(() => expect(onClose).toHaveBeenCalled());
            expect(posts()).toEqual(['n1', 'n2'].map((node) => ({
                method: 'POST',
                url: `/api/node/name/${node}/action/register`,
                body: {user: 'ops', password: 'pw', app: 'MyApp'},
            })));
            expect(tray()).toEqual(expect.arrayContaining([
                ['register', 'n1', 'running', null],
                ['register', 'n2', 'running', null],
            ]));
        });

        test('without credentials, each registers again with the id it holds', async () => {
            const onClose = vi.fn();
            render(<RegisterDialog open nodes={['n2']} onClose={onClose}/>);
            expect(dialog()).toHaveTextContent('Acts on node n2.');
            fireEvent.click(within(dialog()).getByRole('button', {name: 'Register'}));
            await waitFor(() => expect(onClose).toHaveBeenCalled());
            expect(posts()).toEqual([{method: 'POST', url: '/api/node/name/n2/action/register', body: {}}]);
        });

        test('a password without its user is refused before it is posted', () => {
            render(<RegisterDialog open nodes={['n2']} onClose={() => {}}/>);
            fireEvent.change(within(dialog()).getByLabelText('Password'), {target: {value: 'pw'}});
            expect(within(dialog()).getByText('A password needs its user')).toBeInTheDocument();
            fireEvent.click(within(dialog()).getByRole('button', {name: 'Register'}));
            expect(posts()).toEqual([]);
        });

        test('all refused, the dialog stays and says why; one accepted, it closes, the refusal in the tray', async () => {
            answers['/n1/action/register'] = {status: 403, body: {detail: 'root grant required'}};
            answers['/n2/action/register'] = {status: 403, body: {detail: 'root grant required'}};
            const onClose = vi.fn();
            const {unmount} = render(<RegisterDialog open nodes={['n1', 'n2']} onClose={onClose}/>);
            fireEvent.click(within(dialog()).getByRole('button', {name: 'Register'}));
            expect(await within(dialog()).findByText('HTTP 403 root grant required')).toBeInTheDocument();
            expect(onClose).not.toHaveBeenCalled();
            unmount();

            useActionTracker.setState({tracked: [], revealed: 0});
            answers['/n2/action/register'] = {status: 200, body: {exec_id: 'e2', session_id: 's2'}};
            render(<RegisterDialog open nodes={['n1', 'n2']} onClose={onClose}/>);
            fireEvent.click(within(dialog()).getByRole('button', {name: 'Register'}));
            await waitFor(() => expect(onClose).toHaveBeenCalled());
            expect(tray()).toEqual(expect.arrayContaining([
                ['register', 'n1', 'refused', 'HTTP 403 root grant required'],
                ['register', 'n2', 'running', null],
            ]));
        });
    });
});
