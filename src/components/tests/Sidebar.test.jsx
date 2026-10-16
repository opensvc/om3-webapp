import React from 'react';
import {render, screen, act, renderHook, within, fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {describe, test, expect, beforeEach, afterEach, vi} from 'vitest';
import {Sidebar, NAV_ROUTES, useSidebarOpen} from '../Sidebar';
import i18n from '../../i18n';

const {mockPills} = vi.hoisted(() => ({mockPills: {current: {}}}));
vi.mock('../../hooks/useSidebarAlerts', () => ({default: () => mockPills.current}));

function renderSidebar(open = true, path = '/cluster') {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Sidebar open={open}/>
        </MemoryRouter>
    );
}

describe('Sidebar', () => {
    beforeEach(() => {
        localStorage.clear();
        mockPills.current = {};
    });

    test.each([
        ['Heartbeats', 'text-icon-network'],
        ['Networks', 'text-icon-network'],
        ['Nodes', 'text-icon-node'],
        ['Objects', 'text-icon-service'],
        ['Pools', 'text-icon-disk'],
    ])('draws the %s entry with its oc3 icon, tinted %s', (name, tint) => {
        renderSidebar();
        const icon = screen.getByRole('link', {name: new RegExp(`^${name}`)}).querySelector('svg');
        expect(icon).toHaveClass(tint);
        expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    test('shows the details of an entry on mouseover', () => {
        mockPills.current = {'/nodes': {alert: null, details: ['2 nodes', 'frozen: 1']}};
        renderSidebar();
        expect(screen.getByRole('link', {name: /^Nodes/})).toHaveAttribute('title', '2 nodes\nfrozen: 1');
    });

    test('counts nothing: no badge while all is well, the details still on mouseover', () => {
        mockPills.current = {
            '/objects': {alert: null},
            '/pools': {alert: null, details: ['1 pool', 'full: 0']},
        };
        renderSidebar();
        expect(screen.queryByTestId(/^alert-/)).toBeNull();
        expect(screen.queryByTestId(/^counts-/)).toBeNull();
        expect(screen.getByRole('link', {name: /^Pools/})).toHaveAttribute('title', '1 pool\nfull: 0');
    });

    test.each([
        ['/objects', 'down', 'bg-state-down', '1 object down'],
        ['/objects', 'warn', 'bg-state-warn', '2 objects in warn'],
        ['/heartbeats', 'warn', 'bg-state-warn', '1 of 4 heartbeat links down'],
        ['/nodes', 'down', 'bg-state-down', '2 of 2 nodes overloaded'],
    ])('%s: a %s badge in %s, what it is about in its tooltip and for screen readers', (path, level, tint, text) => {
        mockPills.current = {[path]: {alert: {level, text}}};
        renderSidebar();
        const badge = screen.getByTestId(`alert-${path.slice(1)}`);
        expect(badge).toHaveAttribute('data-level', level);
        expect(badge).toHaveClass(tint, 'rounded-full');
        expect(badge).toHaveAttribute('title', text);
        expect(screen.getByRole('img', {name: text})).toBe(badge);
        // A badge, no count: its "!" is out of the accessible name.
        expect(badge).toHaveTextContent('!');
    });

    test('keeps the badge out of the menu link, which holds the name only', () => {
        mockPills.current = {'/objects': {alert: {level: 'down', text: '12 objects down'}}};
        renderSidebar();
        const entry = screen.getByRole('link', {name: 'Objects'});
        expect(entry).toHaveAttribute('href', '/objects');
        expect(entry).not.toContainElement(screen.getByTestId('alert-objects'));
    });

    test('leaves the cluster overview and the user page to the top bar', () => {
        renderSidebar();
        expect(screen.queryByRole('link', {name: /^Cluster/})).toBeNull();
        expect(screen.queryByRole('link', {name: /^Who Am I/})).toBeNull();
    });

    test('lists the views in alphabetical order: kinds and namespaces are tabs of the Objects page', () => {
        renderSidebar();
        const names = screen.getAllByRole('link').map((link) => link.textContent);
        expect(names.map((name) => name.replace(/(all up|warn|down|no status|frozen|a .* is .*)$/, '')))
            .toEqual(['Heartbeats', 'Networks', 'Nodes', 'Objects', 'Pools']);
        expect(within(screen.getByRole('link', {name: /^Objects/}).closest('li')).queryByRole('list')).not.toBeInTheDocument();
    });

    test('lists every view', () => {
        renderSidebar();
        const nav = screen.getByRole('navigation', {name: 'Main'});
        expect(nav).toBeInTheDocument();
        for (const {path, labelKey} of NAV_ROUTES.flatMap((route) => [route, ...(route.children ?? [])])) {
            expect(screen.getByRole('link', {name: new RegExp(`^${i18n.t(labelKey)}`)})).toHaveAttribute('href', path);
        }
    });

    test('marks the view on display', () => {
        renderSidebar(true, '/nodes');
        expect(screen.getByRole('link', {name: /^Nodes/})).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('link', {name: /^Objects/})).not.toHaveAttribute('aria-current');
    });

    test('marks the parent view on a detail page', () => {
        renderSidebar(true, '/network/default');
        expect(screen.getByRole('link', {name: /^Networks/})).toHaveAttribute('aria-current', 'page');
    });

    test('is taken out of the keyboard path when folded', () => {
        const {container} = renderSidebar(false);
        const aside = container.querySelector('#app-sidebar');
        expect(aside).toHaveAttribute('inert');
        expect(aside).toHaveClass('w-0');
    });

    test('is open and reachable when unfolded', () => {
        const {container} = renderSidebar(true);
        const aside = container.querySelector('#app-sidebar');
        expect(aside).not.toHaveAttribute('inert');
        expect(aside).toHaveClass('w-60');
    });
});

describe('useSidebarOpen', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('is open by default and remembers the folded state', () => {
        const {result} = renderHook(() => useSidebarOpen());
        expect(result.current[0]).toBe(true);
        act(() => result.current[1]());
        expect(result.current[0]).toBe(false);
        expect(localStorage.getItem('om3.sidebar')).toBe('closed');

        const {result: reloaded} = renderHook(() => useSidebarOpen());
        expect(reloaded.current[0]).toBe(false);
    });

    test('opens when storage is refused', () => {
        const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('denied');
        });
        try {
            const {result} = renderHook(() => useSidebarOpen());
            expect(result.current[0]).toBe(true);
        } finally {
            spy.mockRestore();
        }
    });
});

describe('Sidebar in French', () => {
    afterEach(async () => {
        await i18n.changeLanguage('en');
    });

    test('names the entries in French', async () => {
        await i18n.changeLanguage('fr');
        renderSidebar();
        expect(screen.getByRole('navigation', {name: 'Principal'})).toBeInTheDocument();
        expect(screen.getByRole('link', {name: /^Nœuds/})).toHaveAttribute('href', '/nodes');
        expect(screen.getByRole('link', {name: /^Objets/})).toHaveAttribute('href', '/objects');
    });

    test('the arrows, Home and End walk the menu entries, not their badges; Escape leaves it', () => {
        mockPills.current = {'/objects': {alert: {level: 'warn', text: '2 objects in warn'}}};
        renderSidebar(true, '/nodes');
        const menu = screen.getByRole('navigation', {name: 'Main'});
        expect(menu).toHaveAttribute('aria-keyshortcuts', 'n');
        const links = within(menu).getAllByRole('link');
        const objects = links.find((l) => l.textContent === 'Objects');
        act(() => objects.focus());
        fireEvent.keyDown(objects, {key: 'ArrowDown'});
        expect(links[links.indexOf(objects) + 1]).toHaveFocus();
        act(() => links[0].focus());
        fireEvent.keyDown(links[0], {key: 'ArrowDown'});
        expect(links[1]).toHaveFocus();
        fireEvent.keyDown(links[1], {key: 'ArrowUp'});
        expect(links[0]).toHaveFocus();
        fireEvent.keyDown(links[0], {key: 'End'});
        expect(links[links.length - 1]).toHaveFocus();
        fireEvent.keyDown(links[links.length - 1], {key: 'Home'});
        expect(links[0]).toHaveFocus();
        fireEvent.keyDown(links[0], {key: 'Escape'});
        expect(links[0]).not.toHaveFocus();
    });
});
