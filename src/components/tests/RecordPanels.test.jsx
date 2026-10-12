import React from 'react';
import {fireEvent, render, screen, within} from '@testing-library/react';
import {MemoryRouter, useLocation} from 'react-router-dom';
import {vi} from 'vitest';
import {PeekPanel} from '../PeekPanel';

// The record contents, tested on their own: here, what each panel hands them.
vi.mock('../ObjectDetails', () => ({
    default: ({path, embedded, onOpenLogs, onViewInstance}) => (
        <div data-testid="object-details" data-embedded={String(embedded)}>
            {path}
            <button onClick={() => onOpenLogs('node2')}>logs of node2</button>
            <button onClick={() => onViewInstance('node1')}>instance on node1</button>
        </div>
    ),
}));
vi.mock('../ObjectInstanceView', () => ({
    default: ({node, path, onOpenLogs}) => (
        <div data-testid="instance-view">
            {path}@{node}
            <button onClick={() => onOpenLogs()}>instance logs</button>
        </div>
    ),
}));
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

    test('an object opens embedded, on its status tab', () => {
        renderPeek('/nodes?peek=object:ns1/svc/web');
        const panel = screen.getByRole('dialog', {name: 'ns1/svc/web'});
        expect(within(panel).getByTestId('object-details')).toHaveAttribute('data-embedded', 'true');
        expect(within(panel).getByRole('tab', {name: 'Status'})).toHaveAttribute('aria-selected', 'true');
        expect(openDialogs()).toEqual([panel]);
    });

    test('the logs of an instance open in the logs tab, on the node asked for', () => {
        renderPeek('/nodes?peek=object:ns1/svc/web');
        fireEvent.click(screen.getByRole('button', {name: 'logs of node2'}));
        expect(screen.getByTestId('search')).toHaveTextContent('peektab=logs');
        expect(screen.getByTestId('logs')).toHaveTextContent('instance ns1/svc/web on node2');
        fireEvent.change(screen.getByRole('combobox'), {target: {value: 'node1'}});
        expect(screen.getByTestId('logs')).toHaveTextContent('on node1');
        // The status stays mounted under the logs: its stream holds.
        expect(screen.getByTestId('object-details')).not.toBeVisible();
    });

    test('an instance opens in its own panel', () => {
        renderPeek('/nodes?peek=object:ns1/svc/web');
        fireEvent.click(screen.getByRole('button', {name: 'instance on node1'}));
        expect(screen.getByTestId('search')).toHaveTextContent('?peek=instance:node1/ns1/svc/web');
        const panel = screen.getByRole('dialog', {name: 'ns1/svc/web on node1'});
        expect(within(panel).getByTestId('instance-view')).toHaveTextContent('ns1/svc/web@node1');
        fireEvent.click(within(panel).getByRole('button', {name: 'instance logs'}));
        expect(within(panel).getByTestId('logs')).toHaveTextContent('instance ns1/svc/web on node1');
    });

    test('keys objects have no logs tab', () => {
        renderPeek('/nodes?peek=object:ns1/sec/key');
        expect(screen.queryByRole('tab')).not.toBeInTheDocument();
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
