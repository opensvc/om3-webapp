import React from 'react';
import {render, screen, fireEvent, waitFor, within} from '@testing-library/react';
import '@testing-library/jest-dom';
import {vi, describe, test, expect, beforeEach, afterEach} from 'vitest';
import {MemoryRouter, useLocation} from 'react-router-dom';
import {PoolConfig, PoolOverview, PoolVolumes} from '../PoolPanel';

// The grants of the user: root edits and deletes a pool.
const mockGrants = vi.hoisted(() => ({value: {}}));
vi.mock('../../hooks/useGrants', () => ({useGrants: () => mockGrants.value}));
// The help of the keywords is tested with the file view: here, the section given it.
vi.mock('../ConfigText', () => ({
    ConfigText: ({text, label}) => <pre aria-label={label}>{text}</pre>,
}));
// The wizard, on its own tested elsewhere: here, what it is seeded with.
const mockWizard = vi.hoisted(() => ({props: null}));
vi.mock('../PoolWizard', () => ({
    PoolWizard: (props) => {
        mockWizard.props = props;
        return <div role="dialog" aria-label="wizard"><button onClick={() => props.onSaved(props.edit.name)}>saved</button></div>;
    },
}));

const Location = () => <div data-testid="search">{useLocation().search}</div>;
const renderIn = (ui) => render(<MemoryRouter initialEntries={['/pools']}>{ui}<Location/></MemoryRouter>);

const GiB = 2 ** 30;
const FILE = `[cluster]
name = dev2

[pool#drbdz]
type = drbd
vg = data
`;
const POOL = {name: 'drbdz', type: 'drbd', head: 'tank', size: 12 * GiB, used: 3 * GiB, free: 9 * GiB, volume_count: 2, capabilities: ['blk', 'shared']};
const VOLUMES = [
    {path: 'ns/vol/data', pool: 'drbdz', size: GiB, children: ['ns/svc/db@n1', 'ns/svc/db@n2'], is_orphan: false},
    {path: 'ns/vol/logs', pool: 'drbdz', size: 64 * 2 ** 20, children: ['ns/svc/web@n2'], is_orphan: false},
    {path: 'ns/vol/old', pool: 'drbdz', size: 16 * 2 ** 20, children: [], is_orphan: true},
];

describe('the pool panel', () => {
    let requests;
    let file;

    beforeEach(() => {
        requests = [];
        file = FILE;
        mockGrants.value = {};
        vi.spyOn(global, 'fetch').mockImplementation(async (url, options = {}) => {
            const u = String(url);
            requests.push({url: u, method: options.method ?? 'GET'});
            const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
            if (options.method === 'PATCH') return json({});
            if (u.startsWith('/api/cluster/config/file')) return new Response(file, {status: 200});
            if (u.startsWith('/api/pool/volume')) return json({items: VOLUMES});
            if (u === '/api/node') return json({items: [{meta: {node: 'n1'}}, {meta: {node: 'n2'}}]});
            if (u.startsWith('/api/pool?name=drbdz&node=')) {
                return json({items: [{...POOL, node: 'n1', size: 4 * GiB, used: GiB}, {...POOL, node: 'n2', head: 'tank2', size: 4 * GiB, used: 2 * GiB}]});
            }
            if (u.startsWith('/api/pool')) return json({items: [POOL, {name: 'shm', type: 'shm'}]});
            return json({}, 404);
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('the overview: its usage a ring in bytes; its sketch, each node its own use, the volumes by the nodes of their consumers', async () => {
        renderIn(<PoolOverview name="drbdz"/>);
        const usage = await screen.findByRole('region', {name: 'Usage'});
        expect(within(usage).getByRole('group', {name: 'Usage of drbdz'})).toHaveTextContent('25.0%3 GiB used9 GiB free');
        const sketch = await screen.findByRole('group', {name: 'Sketch of the pool drbdz over 2 nodes'});
        expect(sketch.querySelector('[data-band]')).toHaveTextContent('drbdz · drbd');
        expect(sketch.querySelector('[data-band]')).toHaveTextContent('head tank');
        expect(sketch.querySelector('[data-band]')).toHaveTextContent('vg data');
        expect(sketch.querySelector('[data-node=n1]')).toHaveTextContent('used 1 GiB / 4 GiB');
        expect(sketch.querySelector('[data-node=n2]')).toHaveTextContent('head tank2');
        // Used on both nodes: a pill; used by none: a pill dashed all along; used on one: a chip under it.
        const pills = within(sketch.querySelector('[data-shared]')).getAllByRole('button');
        expect(pills.map((p) => p.getAttribute('aria-label'))).toEqual([
            'ns/vol/data, 1 GiB, on n1, n2',
            'ns/vol/old, 16 MiB, used by no service',
        ]);
        expect(pills[1].querySelectorAll('[data-present]')).toHaveLength(0);
        expect(within(sketch).getByRole('button', {name: 'ns/vol/logs, 64 MiB, on n2'})).toBeInTheDocument();
        fireEvent.click(pills[0]);
        expect(decodeURIComponent(screen.getByTestId('search').textContent)).toContain('peek=object:ns/vol/data');
    });

    test('the volumes: each its object, its size, the instances using it; an orphan said so', async () => {
        renderIn(<PoolVolumes name="drbdz"/>);
        const table = await screen.findByRole('table', {name: 'Volumes of the pool drbdz'});
        const rows = within(table).getAllByRole('row').slice(1);
        expect(rows.map((r) => r.getAttribute('data-volume'))).toEqual(['ns/vol/data', 'ns/vol/logs', 'ns/vol/old']);
        expect(rows[0]).toHaveTextContent('ns/vol/data1 GiBns/svc/db@n1ns/svc/db@n2');
        expect(rows[2]).toHaveTextContent('orphan');
        fireEvent.click(within(rows[0]).getByRole('button', {name: 'ns/svc/db@n2'}));
        expect(decodeURIComponent(screen.getByTestId('search').textContent)).toContain('peek=instance:ns/svc/db@n2');
    });

    test('the configuration: its section; root edits it, written as the keys changed', async () => {
        const {unmount} = renderIn(<PoolConfig name="drbdz"/>);
        expect(await screen.findByLabelText('Configuration of the pool drbdz')).toHaveTextContent('[pool#drbdz] type = drbd vg = data');
        expect(screen.queryByRole('button', {name: 'Edit the configuration of the pool drbdz'})).toBeNull();
        unmount();

        mockGrants.value = {root: null};
        renderIn(<PoolConfig name="drbdz"/>);
        fireEvent.click(await screen.findByRole('button', {name: 'Edit the configuration of the pool drbdz'}));
        const editor = await screen.findByRole('textbox', {name: 'Configuration of the pool drbdz'});
        expect(editor).toHaveValue('type = drbd\nvg = data');
        fireEvent.change(editor, {target: {value: 'type = drbd\nvg = data2\nfs_type = ext4'}});
        fireEvent.click(screen.getByRole('button', {name: 'Save'}));
        await waitFor(() => expect(requests.filter((r) => r.method === 'PATCH')).toEqual([{
            method: 'PATCH', url: '/api/cluster/config?set=pool%23drbdz.fs_type%3Dext4&set=pool%23drbdz.vg%3Ddata2',
        }]));
    });

    test('root deletes it: said how many volumes remain, its section deleted', async () => {
        mockGrants.value = {root: null};
        const onDeleted = vi.fn();
        renderIn(<PoolConfig name="drbdz" onDeleted={onDeleted}/>);
        fireEvent.click(await screen.findByRole('button', {name: 'Delete the pool'}));
        const dialog = screen.getByRole('dialog', {name: 'Delete the pool drbdz?'});
        expect(await within(dialog).findByText('2 volumes of it remain: no pool makes them any more.')).toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole('button', {name: 'Delete the pool'}));
        await waitFor(() => expect(onDeleted).toHaveBeenCalledWith('drbdz'));
        expect(requests.filter((r) => r.method === 'PATCH')).toEqual([{method: 'PATCH', url: '/api/cluster/config?delete=pool%23drbdz'}]);
    });

    test('root modifies it in the wizard, seeded with its section, the pools and the nodes', async () => {
        mockGrants.value = {root: null};
        renderIn(<PoolConfig name="drbdz"/>);
        fireEvent.click(await screen.findByRole('button', {name: 'Modify the pool drbdz in the wizard'}));
        await screen.findByRole('dialog', {name: 'wizard'});
        expect(mockWizard.props.edit).toEqual({name: 'drbdz', values: {type: 'drbd', vg: 'data'}});
        expect(mockWizard.props.pools.map((p) => p.name)).toEqual(['drbdz', 'shm']);
        expect(mockWizard.props.nodes).toEqual(['n1', 'n2']);
    });

    test('a built-in pool: said so, nothing to delete nor to seed the wizard with', async () => {
        mockGrants.value = {root: null};
        renderIn(<PoolConfig name="shm"/>);
        expect(await screen.findByText('shm is built in: no section of the cluster configuration defines it.')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Delete the pool'})).toBeNull();
        expect(screen.queryByRole('button', {name: 'Modify the pool shm in the wizard'})).toBeNull();
    });
});
