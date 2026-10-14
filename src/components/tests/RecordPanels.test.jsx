import React from 'react';
import {act, fireEvent, render, screen, within} from '@testing-library/react';
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
vi.mock('../ObjectTabs', () => ({
    ObjectResources: ({path}) => <div data-testid="object-resources">{path}</div>,
    ObjectSchedules: ({path}) => <div data-testid="object-schedules">{path}</div>,
}));
vi.mock('../NetworkDetails', () => ({default: ({name}) => <div data-testid="network-details">{name}</div>}));
vi.mock('../NamespaceMetrics', () => ({default: ({namespace}) => <div data-testid="namespace-metrics">{namespace}</div>}));
vi.mock('../LogsViewer', () => ({
    default: ({nodename, type, namespace, kind, instanceName}) => (
        <div data-testid="logs">{`${type} ${namespace}/${kind}/${instanceName} on ${nodename}`}</div>
    ),
}));
/** The event store, as small as the panels need: a state, changed by the tests. */
const store = vi.hoisted(() => {
    const initial = {objectInstanceStatus: {'ns1/svc/web': {node1: {}, node2: {}}}, objectStatus: {}};
    let state = initial;
    const listeners = new Set();
    return {
        get: () => state,
        set: (next) => {
            state = {...state, ...next};
            listeners.forEach((listener) => listener());
        },
        reset: () => {
            state = initial;
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
});
vi.mock('../../hooks/useEventStore.js', async () => {
    const {useSyncExternalStore} = await import('react');
    return {default: (selector) => selector(useSyncExternalStore(store.subscribe, store.get))};
});

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
        store.reset();
    });

    test('an object deleted or purged closes its panel', () => {
        store.set({objectStatus: {'ns1/svc/web': {avail: 'up'}}});
        renderPeek('/nodes?peek=object:ns1/svc/web');
        expect(openDialogs()).toHaveLength(1);
        act(() => store.set({objectStatus: {}}));
        expect(openDialogs()).toHaveLength(0);
        expect(screen.getByTestId('search')).toHaveTextContent(/^$/);
    });

    test('an object the store does not hold yet keeps its panel', () => {
        renderPeek('/nodes?peek=object:ns1/svc/web');
        act(() => store.set({objectStatus: {'ns1/svc/other': {avail: 'up'}}}));
        expect(openDialogs()).toHaveLength(1);
    });

    test('a service opens on its status board, its resources, schedules, logs and configuration on tabs of their own', () => {
        renderPeek('/nodes?peek=object:ns1/svc/web');
        const panel = screen.getByRole('dialog', {name: 'ns1/svc/web'});
        expect(within(panel).getAllByRole('tab').map((tab) => tab.textContent))
            .toEqual(['Status', 'Resources', 'Schedules', 'Logs', 'Configuration']);
        expect(within(panel).getByRole('tab', {name: 'Status'})).toHaveAttribute('aria-selected', 'true');
        expect(within(panel).getByTestId('object-status')).toBeVisible();
        expect(within(panel).queryByTestId('object-details')).not.toBeInTheDocument();
        expect(openDialogs()).toEqual([panel]);

        fireEvent.click(within(panel).getByRole('tab', {name: 'Configuration'}));
        expect(screen.getByTestId('search')).toHaveTextContent('peektab=config');
        expect(within(panel).getByTestId('object-config')).toHaveTextContent('ns1/svc/web');
        expect(within(panel).getByTestId('object-status')).not.toBeVisible();
    });

    test('the resources and the schedules of the object, a tab each', () => {
        renderPeek('/nodes?peek=object:ns1/svc/web');
        const panel = screen.getByRole('dialog', {name: 'ns1/svc/web'});
        fireEvent.click(within(panel).getByRole('tab', {name: 'Resources'}));
        expect(screen.getByTestId('search')).toHaveTextContent('peektab=resources');
        expect(within(panel).getByTestId('object-resources')).toHaveTextContent('ns1/svc/web');
        fireEvent.click(within(panel).getByRole('tab', {name: 'Schedules'}));
        expect(within(panel).getByTestId('object-schedules')).toHaveTextContent('ns1/svc/web');
        expect(within(panel).queryByTestId('object-resources')).not.toBeInTheDocument();
    });

    test('the logs tab reads the logs of an instance, on the node chosen', () => {
        renderPeek('/nodes?peek=object:ns1/svc/web&peektab=logs');
        expect(screen.getByTestId('logs')).toHaveTextContent('instance ns1/svc/web on node1');
        fireEvent.change(screen.getByRole('combobox'), {target: {value: 'node2'}});
        expect(screen.getByTestId('logs')).toHaveTextContent('on node2');
        // The status stays mounted under the logs: its stream holds.
        expect(screen.getByTestId('object-status')).not.toBeVisible();
    });

    test.each(['ns1/sec/key', 'ns1/cfg/settings'])('%s, which om shows no status of, shows its keys, its configuration on a tab', (path) => {
        renderPeek(`/nodes?peek=object:${path}`);
        const panel = screen.getByRole('dialog', {name: path});
        expect(within(panel).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Keys', 'Configuration']);
        expect(within(panel).getByRole('tab', {name: 'Keys'})).toHaveAttribute('aria-selected', 'true');
        expect(within(panel).queryByTestId('object-status')).not.toBeInTheDocument();
        expect(within(panel).getByTestId('object-details')).toHaveAttribute('data-embedded', 'true');

        fireEvent.click(within(panel).getByRole('tab', {name: 'Configuration'}));
        expect(screen.getByTestId('search')).toHaveTextContent('peektab=config');
        expect(within(panel).getByTestId('object-config')).toHaveTextContent(path);
        // Kept mounted under the configuration: its stream holds.
        expect(within(panel).getByTestId('object-details')).not.toBeVisible();
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
