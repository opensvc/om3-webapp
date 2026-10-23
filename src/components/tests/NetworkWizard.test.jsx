import React from 'react';
import {render, screen, fireEvent, waitFor, within} from '@testing-library/react';
import '@testing-library/jest-dom';
import {vi, describe, test, expect, beforeEach, afterEach} from 'vitest';
import {NetworkWizard} from '../NetworkWizard';
import KEYWORDS from '../../app/tests/network-keywords.fixture.json';

const NETWORKS = [
    {name: 'lo', type: 'lo', network: '127.0.0.1/32'},
    {name: 'default', type: 'bridge', network: '10.22.0.0/16'},
];

describe('NetworkWizard', () => {
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

    const renderWizard = (props = {}) => {
        const onSaved = vi.fn();
        render(<NetworkWizard networks={NETWORKS} nodes={['n1', 'n2']} onClose={() => {}} onSaved={onSaved} {...props}/>);
        return {onSaved, dialog: () => screen.getByRole('dialog')};
    };
    const next = () => fireEvent.click(screen.getByRole('button', {name: 'Next'}));

    test('a name and a type, then the fields of the type, a value a node for those of each node, then the section written in one write', async () => {
        const {onSaved} = renderWizard();
        // The types the daemon declares, each described; its default chosen.
        const bridge = await screen.findByRole('radio', {name: /^bridge/});
        expect(bridge).toBeChecked();
        expect(screen.getByRole('radio', {name: /^routed_bridge a subnet cut into one range per node/})).toBeInTheDocument();
        expect(screen.getByRole('radio', {name: /^lan/})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Next'})).toBeDisabled();

        const name = screen.getByRole('textbox', {name: 'Name'});
        fireEvent.change(name, {target: {value: 'default'}});
        expect(screen.getByText('A network default exists already.')).toBeInTheDocument();
        fireEvent.change(name, {target: {value: 'back.end'}});
        expect(screen.getByText('Letters, digits, dash or underscore only.')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Next'})).toBeDisabled();
        fireEvent.change(name, {target: {value: 'backend'}});
        fireEvent.click(screen.getByRole('radio', {name: /^routed_bridge/}));
        next();

        // The network required, an address range; one overlapping another said so.
        const settings = document.querySelector('[data-step=settings]');
        const network = within(settings).getByRole('textbox', {name: 'network (required)'});
        expect(screen.getByRole('button', {name: 'Next'})).toBeDisabled();
        fireEvent.change(network, {target: {value: '10.40.0.0'}});
        expect(within(settings).getByText('An address range, as 10.30.0.0/16 or fd00::/64.')).toBeInTheDocument();
        fireEvent.change(network, {target: {value: '10.22.0.0/15'}});
        expect(within(settings).getByRole('alert')).toHaveTextContent(/overlaps that of default/);
        fireEvent.change(network, {target: {value: '10.40.0.0/16'}});
        expect(settings).not.toHaveTextContent(/overlaps/);
        // A subnet a node; a choice of the daemon's candidates.
        fireEvent.change(within(settings).getByRole('textbox', {name: 'subnet on n1'}), {target: {value: '10.40.0.0/24'}});
        fireEvent.change(within(settings).getByRole('textbox', {name: 'subnet on n2'}), {target: {value: '10.40.1.0/24'}});
        fireEvent.change(within(settings).getByRole('combobox', {name: 'tunnel'}), {target: {value: 'always'}});
        next();

        expect(screen.getByTestId('network-preview')).toHaveTextContent(
            '[network#backend] type = routed_bridge network = 10.40.0.0/16 subnet@n1 = 10.40.0.0/24 subnet@n2 = 10.40.1.0/24 tunnel = always'
        );
        expect(requests.filter((r) => r.method === 'PATCH')).toEqual([]);
        fireEvent.click(screen.getByRole('button', {name: 'Add the network'}));
        await waitFor(() => expect(onSaved).toHaveBeenCalledWith('backend'));
        expect(requests.filter((r) => r.method === 'PATCH')).toEqual([{
            method: 'PATCH',
            url: '/api/cluster/config?set=network%23backend.type%3Drouted_bridge&set=network%23backend.network%3D10.40.0.0%2F16'
                + '&set=network%23backend.subnet%40n1%3D10.40.0.0%2F24&set=network%23backend.subnet%40n2%3D10.40.1.0%2F24'
                + '&set=network%23backend.tunnel%3Dalways',
        }]);
    });

    test('the values typed for another type not written', async () => {
        renderWizard();
        fireEvent.change(await screen.findByRole('textbox', {name: 'Name'}), {target: {value: 'seg'}});
        fireEvent.click(screen.getByRole('radio', {name: /^lan/}));
        next();
        fireEvent.change(screen.getByRole('textbox', {name: 'network (required)'}), {target: {value: '192.168.10.0/24'}});
        fireEvent.change(screen.getByRole('textbox', {name: 'vlan_tag'}), {target: {value: '44'}});
        fireEvent.click(screen.getByRole('button', {name: 'Back'}));
        fireEvent.click(screen.getByRole('radio', {name: /^bridge/}));
        next();
        next();
        expect(screen.getByTestId('network-preview')).toHaveTextContent('[network#seg] type = bridge network = 192.168.10.0/24');
        expect(screen.getByTestId('network-preview')).not.toHaveTextContent('vlan_tag');
    });

    test('a network modified: seeded with its section, its name kept, what changed written', async () => {
        const edit = {name: 'backend3', values: {type: 'routed_bridge', network: '10.100.0.0/22', 'subnet@n1': '10.100.0.0/24', tunnel: 'auto'}};
        const {onSaved} = renderWizard({edit, networks: [...NETWORKS, {name: 'backend3', network: '10.100.0.0/22'}]});
        expect(await screen.findByRole('dialog', {name: 'Modify the network backend3'})).toBeInTheDocument();
        const name = screen.getByRole('textbox', {name: 'Name'});
        expect(name).toHaveValue('backend3');
        expect(name).toHaveAttribute('readonly');
        // Its own name is no name taken.
        expect(screen.queryByText(/exists already/)).toBeNull();
        expect(screen.getByRole('radio', {name: /^routed_bridge/})).toBeChecked();
        next();
        const settings = document.querySelector('[data-step=settings]');
        expect(within(settings).getByRole('textbox', {name: 'network (required)'})).toHaveValue('10.100.0.0/22');
        expect(within(settings).getByRole('textbox', {name: 'subnet on n1'})).toHaveValue('10.100.0.0/24');
        expect(within(settings).getByRole('combobox', {name: 'tunnel'})).toHaveValue('auto');
        // Its own range overlaps none.
        expect(within(settings).queryByRole('alert')).toBeNull();
        next();
        // Nothing changed: nothing to write.
        expect(screen.getByText('Nothing changed.')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Modify the network'})).toBeDisabled();
        fireEvent.click(screen.getByRole('button', {name: 'Back'}));
        fireEvent.change(within(document.querySelector('[data-step=settings]')).getByRole('textbox', {name: 'subnet on n2'}), {target: {value: '10.100.1.0/24'}});
        fireEvent.change(within(document.querySelector('[data-step=settings]')).getByRole('combobox', {name: 'tunnel'}), {target: {value: ''}});
        next();
        expect(screen.getByTestId('network-preview')).toHaveTextContent(
            '[network#backend3] type = routed_bridge network = 10.100.0.0/22 subnet@n1 = 10.100.0.0/24 subnet@n2 = 10.100.1.0/24'
        );
        fireEvent.click(screen.getByRole('button', {name: 'Modify the network'}));
        await waitFor(() => expect(onSaved).toHaveBeenCalledWith('backend3'));
        expect(requests.filter((r) => r.method === 'PATCH')).toEqual([{
            method: 'PATCH',
            url: '/api/cluster/config?set=network%23backend3.subnet%40n2%3D10.100.1.0%2F24&unset=network%23backend3.tunnel',
        }]);
    });

    test('a network modified to another type: warned, its section deleted then written anew', async () => {
        const edit = {name: 'seg', values: {type: 'lan', network: '192.168.10.0/24', ranges: '192.168.10.128/25'}};
        const {onSaved} = renderWizard({edit});
        fireEvent.click(await screen.findByRole('radio', {name: /^bridge/}));
        next();
        next();
        expect(screen.getByText(/Its type changes from lan to bridge/)).toBeInTheDocument();
        expect(screen.getByTestId('network-preview')).toHaveTextContent('[network#seg] type = bridge network = 192.168.10.0/24');
        fireEvent.click(screen.getByRole('button', {name: 'Modify the network'}));
        await waitFor(() => expect(onSaved).toHaveBeenCalledWith('seg'));
        expect(requests.filter((r) => r.method === 'PATCH').map((r) => r.url)).toEqual([
            '/api/cluster/config?delete=network%23seg',
            '/api/cluster/config?set=network%23seg.type%3Dbridge&set=network%23seg.network%3D192.168.10.0%2F24',
        ]);
    });

    test('a write refused said, the wizard kept open', async () => {
        global.fetch.mockImplementation(async (url, options = {}) => {
            if (String(url).endsWith('/config/keywords')) {
                return new Response(JSON.stringify({items: KEYWORDS}), {status: 200, headers: {'Content-Type': 'application/json'}});
            }
            return new Response(JSON.stringify({detail: 'invalid network'}), {status: 400, headers: {'Content-Type': 'application/json'}});
        });
        const {onSaved} = renderWizard();
        fireEvent.change(await screen.findByRole('textbox', {name: 'Name'}), {target: {value: 'b2'}});
        next();
        fireEvent.change(screen.getByRole('textbox', {name: 'network (required)'}), {target: {value: '10.50.0.0/16'}});
        next();
        fireEvent.click(screen.getByRole('button', {name: 'Add the network'}));
        expect(await screen.findByText(/^Not added: /)).toBeInTheDocument();
        expect(onSaved).not.toHaveBeenCalled();
        expect(screen.getByRole('button', {name: 'Add the network'})).toBeEnabled();
    });
});
