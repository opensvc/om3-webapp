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

    test('a drbd pool: the address of each node asked apart', async () => {
        render(<PoolWizard pools={[]} nodes={['n1', 'n2']} onClose={() => {}} onSaved={() => {}}/>);
        fireEvent.change(await screen.findByRole('textbox', {name: 'Name'}), {target: {value: 'rep'}});
        fireEvent.click(screen.getByRole('radio', {name: 'drbd'}));
        fireEvent.click(screen.getByRole('button', {name: 'Next'}));
        expect(screen.getByRole('textbox', {name: 'addr on n1'})).toBeInTheDocument();
        expect(screen.getByRole('textbox', {name: 'addr on n2'})).toBeInTheDocument();
    });
});
