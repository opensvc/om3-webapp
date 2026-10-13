import React from 'react';
import {fireEvent, render, screen, within} from '@testing-library/react';
import {MemoryRouter, useLocation} from 'react-router-dom';
import {vi} from 'vitest';
import {PeekPanel} from '../PeekPanel';

// The record contents, tested on their own: here, what each panel hands them.
vi.mock('../ObjectDetails', () => ({
    default: ({path, embedded}) => (
        <div data-testid="object-details" data-embedded={String(embedded)}>{path}</div>
    ),
}));
vi.mock('../ObjectStatus', () => ({default: ({path}) => <div data-testid="object-status">{path}</div>}));
vi.mock('../ObjectConfig', () => ({default: ({path}) => <div data-testid="object-config">{path}</div>}));
vi.mock('../NetworkDetails', () => ({default: ({name}) => <div data-testid="network-details">{name}</div>}));
vi.mock('../NamespaceMetrics', () => ({default: ({namespace}) => <div data-testid="namespace-metrics">{namespace}</div>}));
vi.mock('../LogsViewer', () => ({
    default: ({nodename, type, namespace, kind, instanceName}) => (
        <div data-testid="logs">{`${type} ${namespace}/${kind}/${instanceName} on ${nodename}`}</div>
    ),
}));
vi.mock('../../hooks/useEventStore.js', () => ({
    default: (selector) => selector({
        objectInstanceStatus: {'ns1/svc/web': {node1: {}, node2: {}}},
    }),
}));

/** The panels open: a closed one stays mounted for its animation, inert. */
const openDialogs = () => screen.queryAllByRole('dialog').filter((d) => !d.hasAttribute('inert'));

function Search() {
    return <output data-testid="search">{decodeURIComponent(useLocation().search)}</output>;
}

const renderPeek = (url) => render(
    <MemoryRouter initialEntries={[url]}>
        <PeekPanel/>
        <Search/>
    </MemoryRouter>
);

describe('record panels', () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    test('a service opens on its status board, its logs and its configuration on tabs of their own', () => {
        renderPeek('/nodes?peek=object:ns1/svc/web');
        const panel = screen.getByRole('dialog', {name: 'ns1/svc/web'});
        expect(within(panel).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Status', 'Logs', 'Configuration']);
        expect(within(panel).getByRole('tab', {name: 'Status'})).toHaveAttribute('aria-selected', 'true');
        expect(within(panel).getByTestId('object-status')).toBeVisible();
        expect(within(panel).queryByTestId('object-details')).not.toBeInTheDocument();
        expect(openDialogs()).toEqual([panel]);

        fireEvent.click(within(panel).getByRole('tab', {name: 'Configuration'}));
        expect(screen.getByTestId('search')).toHaveTextContent('peektab=config');
        expect(within(panel).getByTestId('object-config')).toHaveTextContent('ns1/svc/web');
        expect(within(panel).getByTestId('object-status')).not.toBeVisible();
    });

    test('the logs tab reads the logs of an instance, on the node chosen', () => {
        renderPeek('/nodes?peek=object:ns1/svc/web&peektab=logs');
        expect(screen.getByTestId('logs')).toHaveTextContent('instance ns1/svc/web on node1');
        fireEvent.change(screen.getByRole('combobox'), {target: {value: 'node2'}});
        expect(screen.getByTestId('logs')).toHaveTextContent('on node2');
        // The status stays mounted under the logs: its stream holds.
        expect(screen.getByTestId('object-status')).not.toBeVisible();
    });

    test('a secret, which om shows no status of, shows its keys alone', () => {
        renderPeek('/nodes?peek=object:ns1/sec/key');
        expect(screen.queryByRole('tab')).not.toBeInTheDocument();
        expect(screen.queryByTestId('object-status')).not.toBeInTheDocument();
        expect(screen.getByTestId('object-details')).toHaveAttribute('data-embedded', 'true');
    });

    test.each([
        ['network:lo', 'lo', 'network-details', 'lo'],
        ['namespace:ns1', 'Metrics of ns1', 'namespace-metrics', 'ns1'],
    ])('%s opens its panel', (peek, title, testId, content) => {
        renderPeek(`/objects?peek=${peek}`);
        const panel = screen.getByRole('dialog', {name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))});
        expect(within(panel).getByTestId(testId)).toHaveTextContent(content);
    });

    test('closing the panel leaves the view as it was', () => {
        renderPeek('/objects?kind=svc&peek=network:lo');
        fireEvent.click(screen.getAllByRole('button', {name: 'Close'})[0]);
        expect(screen.getByTestId('search')).toHaveTextContent('?kind=svc');
        expect(openDialogs()).toHaveLength(0);
    });
});
