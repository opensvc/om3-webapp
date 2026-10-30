import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom';
import {vi, describe, test, expect, beforeEach, afterEach} from 'vitest';
import {PoolWizard} from '../PoolWizard';
import KEYWORDS from '../../app/tests/pool-keywords.fixture.json';

describe('PoolWizard', () => {
    let requests;

    beforeEach(() => {
        requests = [];
        vi.spyOn(global, 'fetch').mockImplementation(async (url, options = {}) => {
            requests.push({url: String(url), method: options.method ?? 'GET'});
            if (String(url).endsWith('/config/keywords')) {
                return new Response(JSON.stringify({items: KEYWORDS}), {status: 200, headers: {'Content-Type': 'application/json'}});
            }
            return new Response('{}', {status: 200, headers: {'Content-Type': 'application/json'}});
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('a pool of a volume group: its name, its type, the name of the group required, written in one write', async () => {
        const onSaved = vi.fn();
        render(<PoolWizard pools={[{name: 'default'}]} nodes={['n1', 'n2']} onClose={() => {}} onSaved={onSaved}/>);
        // The default type of the daemon chosen.
        expect(await screen.findByRole('radio', {name: 'directory'})).toBeChecked();
        fireEvent.change(screen.getByRole('textbox', {name: 'Name'}), {target: {value: 'default'}});
        expect(screen.getByText('A pool default exists already.')).toBeInTheDocument();
        fireEvent.change(screen.getByRole('textbox', {name: 'Name'}), {target: {value: 'fast'}});
        fireEvent.click(screen.getByRole('radio', {name: 'vg'}));
        fireEvent.click(screen.getByRole('button', {name: 'Next'}));
        // The name of the group required, asked first.
        const settings = document.querySelector('[data-step=settings]');
        expect(settings.querySelector('label')).toHaveTextContent('name (required)');
        expect(screen.getByRole('button', {name: 'Next'})).toBeDisabled();
        fireEvent.change(screen.getByRole('textbox', {name: 'name (required)'}), {target: {value: 'data'}});
        fireEvent.click(screen.getByRole('button', {name: 'Next'}));
        expect(screen.getByTestId('pool-preview')).toHaveTextContent('[pool#fast] type = vg name = data');
        fireEvent.click(screen.getByRole('button', {name: 'Add the pool'}));
        await waitFor(() => expect(onSaved).toHaveBeenCalledWith('fast'));
        expect(requests.filter((r) => r.method === 'PATCH').map((r) => r.url)).toEqual([
            '/api/cluster/config?set=pool%23fast.type%3Dvg&set=pool%23fast.name%3Ddata',
        ]);
    });

    test('a boolean whose default is true: shown checked, unchecked written false, checked again left to its default', async () => {
        const onSaved = vi.fn();
        render(<PoolWizard pools={[]} nodes={['n1']} onClose={() => {}} onSaved={onSaved}/>);
        fireEvent.change(await screen.findByRole('textbox', {name: 'Name'}), {target: {value: 'arr'}});
        fireEvent.click(screen.getByRole('radio', {name: 'pure'}));
        fireEvent.click(screen.getByRole('button', {name: 'Next'}));
        fireEvent.change(screen.getByRole('textbox', {name: 'array (required)'}), {target: {value: 'a1'}});
        fireEvent.change(screen.getByRole('textbox', {name: 'diskgroup (required)'}), {target: {value: 'dg1'}});
        const deleteNow = screen.getByRole('checkbox', {name: 'delete_now'});
        // Not written, its default true: checked.
        expect(deleteNow).toBeChecked();
        fireEvent.click(deleteNow);
        expect(deleteNow).not.toBeChecked();
        fireEvent.click(screen.getByRole('button', {name: 'Next'}));
        expect(screen.getByTestId('pool-preview')).toHaveTextContent('delete_now = false');
        fireEvent.click(screen.getByRole('button', {name: 'Add the pool'}));
        await waitFor(() => expect(onSaved).toHaveBeenCalledWith('arr'));
        expect(requests.filter((r) => r.method === 'PATCH').map((r) => decodeURIComponent(r.url))).toEqual([
            expect.stringContaining('set=pool#arr.delete_now=false'),
        ]);
    });

    test('a type a node cannot run, said by it from the capabilities of each node, not held back', async () => {
        const caps = {n1: ['drivers.pool.directory', 'drivers.pool.vg'], n2: ['drivers.pool.directory']};
        global.fetch.mockImplementation(async (url) => {
            const node = /\/api\/node\/name\/(\w+)\/capabilities$/.exec(String(url))?.[1];
            if (node) return new Response(JSON.stringify({items: caps[node].map((name) => ({kind: 'CapabilityItem', data: {name}}))}), {status: 200});
            if (String(url).endsWith('/config/keywords')) return new Response(JSON.stringify({items: KEYWORDS}), {status: 200});
            return new Response('{}', {status: 200});
        });
        render(<PoolWizard pools={[]} nodes={['n1', 'n2']} onClose={() => {}} onSaved={() => {}}/>);
        const vg = await screen.findByRole('radio', {name: 'vg'});
        await waitFor(() => expect(vg).toHaveAccessibleDescription('Not usable on n2: its driver is not among the capabilities of the node.'));
        expect(screen.getByRole('radio', {name: 'drbd'})).toHaveAccessibleDescription('Usable on no node of the cluster: its driver is not among their capabilities.');
        expect(screen.getByRole('radio', {name: 'directory'})).not.toHaveAttribute('aria-describedby');
        // Said, not held back: the daemon refuses it on the nodes lacking it.
        fireEvent.change(screen.getByRole('textbox', {name: 'Name'}), {target: {value: 'rep'}});
        fireEvent.click(screen.getByRole('radio', {name: 'drbd'}));
        expect(screen.getByRole('button', {name: 'Next'})).toBeEnabled();
    });

    test('a drbd pool: the address of each node asked apart', async () => {
        render(<PoolWizard pools={[]} nodes={['n1', 'n2']} onClose={() => {}} onSaved={() => {}}/>);
        fireEvent.change(await screen.findByRole('textbox', {name: 'Name'}), {target: {value: 'rep'}});
        fireEvent.click(screen.getByRole('radio', {name: 'drbd'}));
        fireEvent.click(screen.getByRole('button', {name: 'Next'}));
        expect(screen.getByRole('textbox', {name: 'addr on n1'})).toBeInTheDocument();
        expect(screen.getByRole('textbox', {name: 'addr on n2'})).toBeInTheDocument();
    });
});
