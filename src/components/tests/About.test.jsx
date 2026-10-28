import React from 'react';
import {fireEvent, render, screen, within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {describe, expect, test, beforeEach} from 'vitest';
import About from '../About';
import useEventStore from '../../hooks/useEventStore.js';
import {releaseCheckEnabled} from '../../app/release-check';

describe('About', () => {
    beforeEach(() => {
        useEventStore.setState({nodeStatus: {n1: {agent: 'v3.0.1'}, n2: {agent: 'v3.0.1'}, n3: {agent: 'v3.0.0'}}});
        localStorage.clear();
    });

    test('the release check off by default, opted in and out from here, the release told before forgotten when out', () => {
        render(<About/>, {wrapper: MemoryRouter});
        const box = screen.getByRole('checkbox', {name: 'Check GitHub for the latest release of this webapp'});
        expect(box).not.toBeChecked();
        expect(releaseCheckEnabled()).toBe(false);
        fireEvent.click(box);
        expect(box).toBeChecked();
        expect(releaseCheckEnabled()).toBe(true);
        localStorage.setItem('appVersion', '1.2.3');
        fireEvent.click(box);
        expect(releaseCheckEnabled()).toBe(false);
        expect(localStorage.getItem('appVersion')).toBeNull();
    });

    test('the product, the agent versions of the nodes each once, the publisher reached by mail', () => {
        render(<About/>, {wrapper: MemoryRouter});
        expect(screen.getByRole('heading', {level: 1})).toHaveTextContent('OpenSVCCluster');
        expect(document.querySelector('[data-about=agent]')).toHaveTextContent('Agent v3.0.0, v3.0.1');
        const publisher = screen.getByRole('region', {name: 'Publisher'});
        expect(publisher).toHaveTextContent('OpenSVC SAS');
        expect(within(publisher).getByRole('link', {name: 'support@opensvc.com'})).toHaveAttribute('href', 'mailto:support@opensvc.com');
    });

    test('the licenses and sources, the software bundled', () => {
        render(<About/>, {wrapper: MemoryRouter});
        const licenses = screen.getByRole('region', {name: 'Licenses and sources'});
        expect(within(licenses).getByRole('link', {name: 'om3'})).toHaveAttribute('href', 'https://github.com/opensvc/om3');
        expect(licenses).toHaveTextContent('under the Apache-2.0 license');
        expect(document.querySelector('[data-about=bundled]')).toHaveTextContent('oidc-client-ts · Apache-2.0');
    });

    test('what the law of the EU asks told: personal data, cookies, accessibility, security; the request to GitHub said', () => {
        render(<About/>, {wrapper: MemoryRouter});
        for (const name of ['Personal data (GDPR)', 'Cookies', 'Accessibility', 'Security']) expect(screen.getByRole('region', {name})).toBeInTheDocument();
        expect(screen.getByRole('region', {name: 'Personal data (GDPR)'})).toHaveTextContent('asks GitHub');
        expect(screen.getByRole('region', {name: 'Cookies'})).toHaveTextContent('sets no cookie');
        expect(within(screen.getByRole('region', {name: 'Security'})).getByRole('link', {name: 'support@opensvc.com'})).toBeInTheDocument();
    });

    test('signed out, no node told: no agent line', () => {
        useEventStore.setState({nodeStatus: {}});
        render(<About/>, {wrapper: MemoryRouter});
        expect(document.querySelector('[data-about=agent]')).toBeNull();
    });
});
