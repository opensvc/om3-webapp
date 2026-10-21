import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {vi} from 'vitest';
import '../../i18n';
import {EnrollNodeDialog, JOIN_TOKEN_COMMAND} from '../EnrollNodeDialog';
import {useActionTracker} from '../../app/action-tracker';
import useEventStore from '../../hooks/useEventStore';

const answer = (status, body) => ({
    ok: status < 300,
    status,
    json: async () => body,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
    clone() { return this; },
});

const tray = () => useActionTracker.getState().tracked;

describe('EnrollNodeDialog', () => {
    beforeEach(() => {
        localStorage.setItem('authToken', 'tok');
        useActionTracker.setState({tracked: [], revealed: 0});
        useEventStore.setState({nodeStatus: {dev2n1: {}}});
    });

    const fill = ({node = 'dev3n1.example.com:1215', token = 'eyJ.join.token', understood = true} = {}) => {
        fireEvent.change(screen.getByRole('textbox', {name: 'Node address'}), {target: {value: node}});
        fireEvent.change(screen.getByRole('textbox', {name: 'Join token'}), {target: {value: token}});
        if (understood) fireEvent.click(screen.getByRole('checkbox', {name: 'I understand'}));
    };

    test('how to make the token said; enroll only with an address, a token, and the drain understood', () => {
        render(<EnrollNodeDialog open onClose={vi.fn()}/>);
        const dialog = screen.getByRole('dialog', {name: 'Enroll a node'});
        expect(dialog).toHaveTextContent(JOIN_TOKEN_COMMAND);
        expect(dialog).toHaveTextContent('they are stopped, stay down, and are removed from its configuration');
        const enroll = within(dialog).getByRole('button', {name: 'Enroll'});
        // It adds a node: the accent of what creates.
        expect(enroll).toHaveClass('bg-accent');
        expect(enroll).toBeDisabled();
        fill({understood: false});
        expect(enroll).toBeDisabled();
        fireEvent.click(screen.getByRole('checkbox', {name: 'I understand'}));
        expect(enroll).toBeEnabled();
        // The token page of the node typed, a link away.
        expect(within(dialog).getByRole('link', {name: /Get a join token from the webapp of dev3n1.example.com:1215/})).toHaveAttribute(
            'href', 'https://dev3n1.example.com:1215/ui/token?role=join');
        // None of the fields is a login, for the password managers.
        expect(screen.getByRole('textbox', {name: 'Join token'})).toHaveAttribute('data-protonpass-ignore', 'true');
    });

    test('enrolled: posted to the cluster, the node followed in the tray until the cluster lists it', async () => {
        global.fetch = vi.fn().mockResolvedValue(answer(200, {node: 'dev3n1'}));
        const onClose = vi.fn();
        render(<EnrollNodeDialog open onClose={onClose}/>);
        fill();
        fireEvent.click(screen.getByText('More options'));
        fireEvent.change(screen.getByRole('textbox', {name: 'Token lifetime'}), {target: {value: '2h'}});
        fireEvent.click(screen.getByRole('button', {name: 'Enroll'}));
        await waitFor(() => expect(onClose).toHaveBeenCalled());
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe('/api/cluster/enroll');
        expect(options.method).toBe('POST');
        expect(JSON.parse(options.body)).toEqual({node: 'dev3n1.example.com:1215', token: 'eyJ.join.token', timeout: '2h'});
        // Followed under the name the node gave itself, until it shows in the cluster.
        expect(tray()[0]).toMatchObject({state: 'running', label: 'Enroll dev3n1'});
        act(() => {
            useEventStore.setState({nodeStatus: {dev2n1: {}, dev3n1: {}}});
        });
        await waitFor(() => expect(tray()[0]).toMatchObject({state: 'succeeded'}));
    });

    test('refused: said in the dialog and the tray, the dialog kept', async () => {
        global.fetch = vi.fn().mockResolvedValue(answer(409, {title: 'Conflict', detail: 'dev3n1 is a member of a multi node cluster', status: 409}));
        const onClose = vi.fn();
        render(<EnrollNodeDialog open onClose={onClose}/>);
        fill();
        fireEvent.click(screen.getByRole('button', {name: 'Enroll'}));
        expect(await screen.findByText(/Enrollment refused: .*multi node cluster/)).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
        expect(tray()[0]).toMatchObject({state: 'refused', error: expect.stringContaining('HTTP 409')});
    });
});
