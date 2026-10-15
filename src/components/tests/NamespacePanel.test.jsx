import React from 'react';
import {render, screen, fireEvent, waitFor, within} from '@testing-library/react';
import {vi} from 'vitest';
import {NamespaceConfig, NamespaceUsage} from '../NamespacePanel';
import useEventStore from '../../hooks/useEventStore';

vi.mock('../NamespaceMetrics', () => ({
    default: ({namespace}) => <div data-testid="namespace-metrics">{namespace}</div>,
}));
vi.mock('../ObjectConfig', () => ({
    default: ({path, statusPath}) => <div data-testid="object-config">{`${path} ${statusPath}`}</div>,
}));

const GiB = 1024 ** 3;

const NSCFG = `[DEFAULT]
id = 1

[claim#1]
type = pool
name = default
limit = 20g

[claim#2]
type = network
name = default
limit = 10

[claim#3]
type = memory
limit = 4g

[claim#4]
type = cpu
limit = 400%
`;

const API = {
    '/api/pool': {items: [{name: 'default', size: 100 * GiB}, {name: 'shm', size: 4 * GiB}]},
    '/api/pool/volume': {items: [
        {path: 'prod/vol/data', pool: 'default', size: 10 * GiB},
        {path: 'prod/vol/cache', pool: 'shm', size: GiB},
    ]},
    '/api/network': {items: [{name: 'default', size: 65536}]},
    '/api/network/ip': {items: [{ip: '10.0.0.1', path: 'prod/svc/web', network: {name: 'default'}}]},
};

let requests;

beforeEach(() => {
    localStorage.setItem('authToken', 'tok');
    requests = [];
    useEventStore.setState({objectStatus: {}, objectInstanceStatus: {}});
    global.fetch = vi.fn(async (url, options = {}) => {
        requests.push({url, method: options.method ?? 'GET', body: options.body});
        if (url === '/metrics/pg') {
            return new Response(`opensvc_pg_cgroup_memory_current_bytes{namespace="prod",path="prod/svc/web"} ${GiB}`, {status: 200});
        }
        if (url === '/api/object/path/prod/nscfg/namespace/config/file') {
            return options.method === 'POST' ? new Response(null, {status: 204}) : new Response(NSCFG, {status: 200});
        }
        if (url.endsWith('/nscfg/namespace/config/file')) {
            return options.method === 'POST' ? new Response(null, {status: 204}) : new Response('{}', {status: 404});
        }
        const body = API[url];
        return body ? new Response(JSON.stringify(body), {status: 200}) : new Response('{}', {status: 404});
    });
});

afterEach(() => localStorage.clear());

const claimsTable = () => screen.getByRole('table', {name: 'Claims and usage'});
const line = (text) => within(claimsTable()).getAllByRole('row').find((r) => r.textContent.startsWith(text));
const cells = (text) => within(line(text)).getAllByRole('cell').map((c) => c.textContent);

describe('NamespaceUsage', () => {
    test('each claim: what is used of it, its limit, the share and what is left', async () => {
        render(<NamespaceUsage namespace="prod"/>);
        await waitFor(() => expect(line('Pooldefault')).toBeDefined());
        expect(cells('Pooldefault').slice(0, 3)).toEqual(['Pooldefault', '10 GiB', '20 GiB']);
        expect(cells('Pooldefault')[4]).toBe('10 GiB');
        expect(within(line('Pooldefault')).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
        expect(cells('Networkdefault').slice(0, 3)).toEqual(['Networkdefault', '1', '10']);
        await waitFor(() => expect(cells('Memory').slice(0, 3)).toEqual(['Memory', '1 GiB', '4 GiB']));
        expect(cells('Memory')[4]).toBe('3 GiB');
    });

    test('the cpu claim in cpu, as the table shows it', async () => {
        render(<NamespaceUsage namespace="prod"/>);
        await waitFor(() => expect(line('CPU')).toBeDefined());
        expect(cells('CPU')[2]).toBe('4 cpu');
    });

    test('a pool used without a claim: out of its size, said so', async () => {
        render(<NamespaceUsage namespace="prod"/>);
        await waitFor(() => expect(line('Poolshm')).toBeDefined());
        expect(cells('Poolshm').slice(0, 3)).toEqual(['Poolshm', '1 GiB', '4 GiB (pool size, no claim)']);
    });

    test('a namespace claiming nothing is told it is capped by nothing but the pools and networks', async () => {
        render(<NamespaceUsage namespace="dev"/>);
        expect(await screen.findByText(/claims nothing/)).toBeInTheDocument();
        expect(within(claimsTable()).getByText('No pool, network, cpu or memory used.')).toBeInTheDocument();
    });

    test('the usage of its objects, one by one, follows', async () => {
        render(<NamespaceUsage namespace="prod"/>);
        expect(screen.getByRole('region', {name: 'CPU and memory by object'})).toContainElement(screen.getByTestId('namespace-metrics'));
        await waitFor(() => expect(line('Pooldefault')).toBeDefined());
    });
});

describe('NamespaceConfig', () => {
    test('the configuration object, as the cluster lists it: "<namespace>/"', () => {
        useEventStore.setState({objectStatus: {'prod/': {avail: 'n/a'}}});
        render(<NamespaceConfig namespace="prod"/>);
        expect(screen.getByTestId('object-config')).toHaveTextContent('prod/nscfg/namespace prod/');
    });

    test('the root namespace configuration is listed as "/"', () => {
        useEventStore.setState({objectInstanceStatus: {'/': {n1: {}}}});
        render(<NamespaceConfig namespace="root"/>);
        expect(screen.getByTestId('object-config')).toHaveTextContent('root/nscfg/namespace /');
    });

    test('none yet: offered to create it, with an id of its own', async () => {
        render(<NamespaceConfig namespace="dev"/>);
        expect(screen.getByText(/has no configuration object yet/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', {name: 'Create its configuration'}));
        await waitFor(() => expect(requests).toContainEqual(expect.objectContaining({
            url: '/api/object/path/dev/nscfg/namespace/config/file', method: 'POST',
        })));
        const {body} = requests.find((r) => r.method === 'POST');
        expect(body).toMatch(/^\[DEFAULT\]\nid = [0-9a-f-]{36}\n/);
    });

    test('a refused creation says why', async () => {
        global.fetch = vi.fn(async () => new Response(JSON.stringify({detail: 'forbidden'}), {status: 403}));
        render(<NamespaceConfig namespace="dev"/>);
        fireEvent.click(screen.getByRole('button', {name: 'Create its configuration'}));
        expect(await screen.findByText(/could not be created: .*forbidden/)).toBeInTheDocument();
    });
});
