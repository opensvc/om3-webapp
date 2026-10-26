import React from 'react';
import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {Glossary} from '../Glossary';
import {PageIntro} from '../PageIntro';
import {Term} from '../../app/Term';
import {reloadHiddenIntros} from '../../app/page-intro';

const renderAt = (url, ui) => render(<MemoryRouter initialEntries={[url]}>{ui}</MemoryRouter>);

beforeEach(() => {
    localStorage.clear();
    reloadHiddenIntros();
});

describe('Term', () => {
    test('a word of OpenSVC underlined, its definition in a card hovered or focused', () => {
        render(<Term term="avail">Avail</Term>);
        const word = screen.getByText('Avail');
        expect(word).toHaveAttribute('data-term', 'avail');
        expect(document.querySelector('[data-term-card]')).toBeNull();
        fireEvent.focus(word.parentElement);
        const card = document.querySelector('[data-term-card="avail"]');
        expect(card).toHaveTextContent(/^Avail/);
        expect(card.textContent.length).toBeGreaterThan(40);
        // Reached by the keyboard, described by the card while it shows.
        expect(word.parentElement).toHaveAttribute('tabindex', '0');
        expect(word.parentElement).toHaveAccessibleDescription(/^Avail Is it running\? Only the resources it needs count\./);
        fireEvent.blur(word.parentElement);
        expect(document.querySelector('[data-term-card]')).toBeNull();
    });

    test('its name when no label; a key the glossary does not hold, the label alone', () => {
        const {unmount} = render(<Term term="frozen"/>);
        expect(screen.getByText('Frozen')).toHaveAttribute('data-term', 'frozen');
        unmount();
        render(<Term term="nope">Plain</Term>);
        expect(screen.getByText('Plain')).not.toHaveAttribute('data-term');
    });
});

describe('PageIntro', () => {
    test('what the page is about, the glossary a click away; hidden for the browser, page by page', () => {
        const {unmount} = renderAt('/objects?list=secrets', <PageIntro/>);
        const intro = screen.getByRole('complementary', {name: 'About this page'});
        expect(intro).toHaveTextContent(/^Secrets \(sec\)/);
        expect(within(intro).getByRole('link', {name: 'What the words mean'})).toHaveAttribute('href', '/glossary');
        fireEvent.click(within(intro).getByRole('button', {name: 'Hide this introduction'}));
        expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
        expect(JSON.parse(localStorage.getItem('om3-webapp.hiddenIntros'))).toEqual(['objects-secrets']);
        unmount();
        // Another page keeps its own.
        renderAt('/nodes', <PageIntro/>);
        expect(screen.getByRole('complementary', {name: 'About this page'})).toHaveTextContent(/^These are the servers in your cluster\./);
    });

    test('none on a page without one', () => {
        const {container} = renderAt('/whoami', <PageIntro/>);
        expect(container).toBeEmptyDOMElement();
    });
});

describe('Glossary', () => {
    test('every term by group, searched by name or definition', () => {
        renderAt('/glossary', <Glossary/>);
        expect(screen.getByRole('heading', {level: 1, name: 'Glossary'})).toBeInTheDocument();
        expect(screen.getAllByRole('heading', {level: 2}).map((h) => h.textContent))
            .toEqual(['Symbols', 'What a cluster is made of', 'Kinds of objects', 'States and flags', 'How objects are run', 'Actions']);
        // The symbols first, each drawn as the status board draws it, then said.
        const symbols = screen.getByRole('region', {name: 'Symbols'});
        expect(within(symbols).getAllByRole('heading', {level: 3}).map((h) => h.textContent))
            .toEqual(['Status', 'Marks on an instance', 'Flags on a resource']);
        const frozen = symbols.querySelector('[data-legend="marks-frozen"]');
        // Said beside it: no tooltip of its own, as on the board, where the card of the cell says it.
        expect(within(frozen).getByRole('img', {name: 'frozen'})).not.toHaveAttribute('title');
        expect(frozen.nextElementSibling).toHaveTextContent('Frozen: the cluster will not start, stop or move it automatically.');
        expect(symbols.querySelector('[data-legend="states-downQuiet"] [data-state="down"]')).toHaveClass('text-ink-muted');
        expect(symbols.querySelector('[data-legend="flags-M"]')).toHaveTextContent('M');
        fireEvent.change(screen.getByRole('searchbox', {name: 'Search the glossary'}), {target: {value: 'giveback'}});
        // Searching, the terms alone.
        expect(screen.queryByRole('region', {name: 'Symbols'})).not.toBeInTheDocument();
        expect(screen.getAllByRole('term').map((dt) => dt.textContent)).toContain('Giveback');
        expect(screen.getAllByRole('term').map((dt) => dt.textContent)).not.toContain('Namespace');
        fireEvent.change(screen.getByRole('searchbox', {name: 'Search the glossary'}), {target: {value: 'zzzz'}});
        expect(screen.getByText('No term matches.')).toBeInTheDocument();
    });

    test('a term linked to marked; the hidden intros shown again from here', () => {
        localStorage.setItem('om3-webapp.hiddenIntros', JSON.stringify(['nodes', 'pools']));
        act(() => reloadHiddenIntros());
        renderAt('/glossary#term-frozen', <Glossary/>);
        expect(document.getElementById('term-frozen')).toHaveAttribute('data-target');
        expect(document.getElementById('term-avail')).not.toHaveAttribute('data-target');
        fireEvent.click(screen.getByRole('button', {name: 'Show the 2 hidden page introductions again'}));
        expect(localStorage.getItem('om3-webapp.hiddenIntros')).toBeNull();
        expect(screen.queryByRole('button', {name: /hidden page introduction/})).not.toBeInTheDocument();
    });
});
