import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {vi} from 'vitest';
import '../../i18n';
import TokenPage from '../TokenPage';
import {tokenPageUrl} from '../EnrollNodeDialog';
import {rememberReturn, takeReturn} from '../../app/after-login';

// The grants of the user: none unless a test says.
const mockGrants = vi.hoisted(() => ({value: {}}));
vi.mock('../../hooks/useGrants', () => ({useGrants: () => mockGrants.value}));

const answer = (status, body) => ({
    ok: status < 300,
    status,
    json: async () => body,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
    clone() { return this; },
});

const show = (search = '?role=join') => render(
    <MemoryRouter initialEntries={[`/token${search}`]}>
        <TokenPage/>
    </MemoryRouter>,
);

describe('TokenPage', () => {
    beforeEach(() => {
        localStorage.clear();
        mockGrants.value = {};
    });

    test('an API token: short-lived, of the roles picked among those of the user, narrowed to a namespace; a request to try it, the token out of the history', async () => {
        localStorage.setItem('refreshToken', 'refresh-tok');
        mockGrants.value = {admin: ['ns2', 'ns1'], guest: ['ns3']};
        global.fetch = vi.fn().mockResolvedValue(answer(200, {access_token: 'eyJ.api.tok', access_expired_at: '2026-10-21T18:00:00Z'}));
        show('');
        // Short-lived by default; no role picked: all those of the user.
        expect(screen.getByRole('textbox', {name: 'Lifetime'})).toHaveValue('10m');
        expect(screen.getByText('None picked: the token carries all your grants.')).toBeInTheDocument();
        expect(screen.queryByRole('combobox', {name: 'Namespace'})).toBeNull();
        fireEvent.click(screen.getByRole('checkbox', {name: 'admin'}));
        // A role of namespaces: narrowed to one of the user's.
        const scope = screen.getByRole('combobox', {name: 'Namespace'});
        expect([...scope.options].map((o) => o.value)).toEqual(['', 'ns1', 'ns2']);
        fireEvent.change(scope, {target: {value: 'ns1'}});
        fireEvent.click(screen.getByRole('button', {name: '1h'}));
        fireEvent.click(screen.getByRole('button', {name: 'Create token'}));
        await screen.findByRole('textbox', {name: 'Token'});
        expect(global.fetch.mock.calls[0][0]).toBe('/api/auth/token?access_duration=1h&refresh=false&role=admin&scope=ns1');
        // Tried without it on the screen nor in the history of the shell.
        const tried = document.querySelector('[data-try] pre').textContent;
        expect(tried).toMatch(/^read -rs TOKEN/);
        expect(tried).toContain('curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/auth/whoami');
        expect(tried).not.toContain('eyJ');
    });

    test('a join token: no roles to pick, no request to try', async () => {
        localStorage.setItem('refreshToken', 'refresh-tok');
        mockGrants.value = {root: null};
        global.fetch = vi.fn().mockResolvedValue(answer(200, {access_token: 'tok'}));
        show();
        expect(screen.queryByRole('checkbox', {name: 'root'})).toBeNull();
        fireEvent.click(screen.getByRole('button', {name: 'Create token'}));
        await screen.findByRole('textbox', {name: 'Token'});
        expect(document.querySelector('[data-try]')).toBeNull();
    });

    test('a password session: the join token created from its refresh token, masked, revealed, copied', async () => {
        localStorage.setItem('refreshToken', 'refresh-tok');
        global.fetch = vi.fn().mockResolvedValue(answer(200, {access_token: 'eyJ.join.tok', access_expired_at: '2026-10-21T18:00:00Z'}));
        show();
        expect(screen.getByText(/Create a join token of this node/)).toBeInTheDocument();
        expect(screen.getByRole('textbox', {name: 'Lifetime'})).toHaveValue('1h');
        expect(screen.queryByLabelText('Password')).toBeNull();
        fireEvent.click(screen.getByRole('button', {name: 'Create token'}));
        const shown = await screen.findByRole('textbox', {name: 'Token'});
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe('/api/auth/token?access_duration=1h&refresh=false&role=join');
        expect(options).toMatchObject({method: 'POST', headers: {Authorization: 'Bearer refresh-tok'}});
        // Masked until revealed.
        expect(shown.value).not.toContain('eyJ');
        fireEvent.click(screen.getByRole('button', {name: 'Reveal the token'}));
        expect(shown).toHaveValue('eyJ.join.tok');
    });

    test('no password session: the username and password of a user of this node asked, sent to it alone', async () => {
        global.fetch = vi.fn().mockResolvedValue(answer(200, {access_token: 'tok'}));
        show();
        const create = screen.getByRole('button', {name: 'Create token'});
        expect(create).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Username'), {target: {value: 'root'}});
        fireEvent.change(screen.getByLabelText('Password'), {target: {value: 's3cr3t'}});
        fireEvent.click(create);
        await screen.findByRole('textbox', {name: 'Token'});
        expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe(`Basic ${btoa('root:s3cr3t')}`);
        // The password not kept once used.
        expect(screen.getByLabelText('Password')).toHaveValue('');
    });

    test('refused: om says why', async () => {
        global.fetch = vi.fn().mockResolvedValue(answer(403, {title: 'Create token Forbidden', detail: "no grant matching role and scope for username 'bob'", status: 403}));
        localStorage.setItem('refreshToken', 'r');
        show();
        fireEvent.click(screen.getByRole('button', {name: 'Create token'}));
        expect(await screen.findByText(/No token: .*no grant matching role/)).toBeInTheDocument();
    });
});

describe('tokenPageUrl', () => {
    test.each([
        ['dev2n3', 'https://dev2n3:1215/ui/token?role=join'],
        ['dev2n3.example.com:1300', 'https://dev2n3.example.com:1300/ui/token?role=join'],
        ['https://10.0.0.3', 'https://10.0.0.3:1215/ui/token?role=join'],
        ['[fd00::3]:1215', 'https://[fd00::3]:1215/ui/token?role=join'],
        ['x', null],
        ['bad host/with/path', null],
    ])('%s → %s', (address, url) => {
        expect(tokenPageUrl(address)).toBe(url);
    });
});

describe('after-login', () => {
    test('the page a sign-in returns to, once; never a page of the sign-in itself', () => {
        sessionStorage.clear();
        expect(takeReturn()).toBe('/');
        rememberReturn('/token?role=join');
        expect(takeReturn()).toBe('/token?role=join');
        expect(takeReturn()).toBe('/');
        rememberReturn('/auth/login');
        expect(takeReturn()).toBe('/');
    });
});
