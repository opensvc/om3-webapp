import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {useTranslation} from 'react-i18next';
import Authenticating from '../Authenticating';

// Mock dependencies
jest.mock('react-i18next', () => ({
    useTranslation: jest.fn(),
}));

describe('Authenticating Component', () => {
    const mockReload = jest.fn();
    const mockT = jest.fn((key) => key); // Simulates the `t` function returning the key
    const mockI18n = {language: 'en'};

    beforeEach(() => {
        jest.clearAllMocks();
        useTranslation.mockReturnValue({t: mockT, i18n: mockI18n});

        // Mock window.location.reload
        delete window.location;
        window.location = {reload: mockReload};
    });

    afterEach(() => {
        // Restore window.location after each test
        window.location = global.location;
    });

    test('1. renders dialog with translated title, content, and button', () => {
        render(<Authenticating/>);

        // Check that the dialog is rendered
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title');

        // Check the translated title
        expect(screen.getByText('Authentication')).toBeInTheDocument();
        expect(mockT).toHaveBeenCalledWith('Authentication');

        // Check the translated content
        expect(screen.getByText('You are being redirected to the openid provider.')).toBeInTheDocument();
        expect(mockT).toHaveBeenCalledWith('You are being redirected to the openid provider.');

        // Check the translated button
        expect(screen.getByRole('button', {name: 'Reload'})).toBeInTheDocument();
        expect(mockT).toHaveBeenCalledWith('Reload');
    });

    test('2. dialog is always open', () => {
        render(<Authenticating/>);
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(dialog).toBeVisible();
        // Logs for debugging dialog attributes
        console.log('Dialog attributes:', dialog.getAttributeNames());
        console.log('Dialog open attribute:', dialog.getAttribute('open'));
    });

    test('3. clicking reload button calls window.location.reload', () => {
        render(<Authenticating/>);
        const reloadButton = screen.getByRole('button', {name: 'Reload'});
        fireEvent.click(reloadButton);
        expect(mockReload).toHaveBeenCalled();
    });

    test('4. renders correctly with unused props', () => {
        render(<Authenticating someUnusedProp="value"/>);
        expect(screen.getByText('Authentication')).toBeInTheDocument();
        expect(screen.getByText('You are being redirected to the openid provider.')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Reload'})).toBeInTheDocument();
        expect(mockT).toHaveBeenCalledWith('Authentication');
        expect(mockT).toHaveBeenCalledWith('You are being redirected to the openid provider.');
        expect(mockT).toHaveBeenCalledWith('Reload');
    });

    test('5. translation function handles different language', () => {
        const mockTWithFrench = jest.fn((key) => {
            const translations = {
                Authentication: 'Authentification',
                'You are being redirected to the openid provider.': 'Vous êtes redirigé vers le fournisseur OpenID.',
                Reload: 'Recharger',
            };
            return translations[key] || key;
        });
        useTranslation.mockReturnValue({t: mockTWithFrench, i18n: {language: 'fr'}});

        render(<Authenticating/>);

        expect(screen.getByText('Authentification')).toBeInTheDocument();
        expect(screen.getByText('Vous êtes redirigé vers le fournisseur OpenID.')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Recharger'})).toBeInTheDocument();
        expect(mockTWithFrench).toHaveBeenCalledWith('Authentication');
        expect(mockTWithFrench).toHaveBeenCalledWith('You are being redirected to the openid provider.');
        expect(mockTWithFrench).toHaveBeenCalledWith('Reload');
    });
});
