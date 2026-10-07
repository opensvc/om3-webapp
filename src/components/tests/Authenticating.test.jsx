import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {vi, describe, test, expect, beforeEach, afterEach} from 'vitest';
import Authenticating from '../Authenticating';

// Hoisted mock variables
const {mockUseTranslation, mockReload} = vi.hoisted(() => ({
    mockUseTranslation: vi.fn(),
    mockReload: vi.fn(),
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: mockUseTranslation,
}));

describe('Authenticating Component', () => {
    let originalLocation;
    const mockT = vi.fn((key) => key);
    const mockI18n = {language: 'en'};

    beforeEach(() => {
        vi.clearAllMocks();
        mockUseTranslation.mockReturnValue({t: mockT, i18n: mockI18n});

        // Mock window.location.reload
        originalLocation = window.location;
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: {reload: mockReload},
        });
    });

    afterEach(() => {
        // Restore window.location
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: originalLocation,
        });
    });

    test('renders panel with translated title, content, spinner and button', () => {
        render(<Authenticating/>);

        // Check that the panel is rendered and named by its title
        const panel = screen.getByRole('region', {name: 'Authentication'});
        expect(panel).toBeInTheDocument();
        expect(panel).toHaveAttribute('aria-labelledby', 'dialog-title');

        // Check the translated title
        expect(screen.getByRole('heading', {name: 'Authentication'})).toBeInTheDocument();

        // Check the spinner
        expect(screen.getByRole('status')).toHaveTextContent('Loading...');
        expect(mockT).toHaveBeenCalledWith('Authentication');

        // Check the translated content
        expect(screen.getByText('You are being redirected to the openid provider.')).toBeInTheDocument();
        expect(mockT).toHaveBeenCalledWith('You are being redirected to the openid provider.');

        // Check the translated button
        expect(screen.getByRole('button', {name: 'Reload'})).toBeInTheDocument();
        expect(mockT).toHaveBeenCalledWith('Reload');
    });

    test('panel is always shown', () => {
        render(<Authenticating/>);
        const panel = screen.getByRole('region', {name: 'Authentication'});
        expect(panel).toBeInTheDocument();
        expect(panel).toBeVisible();
    });

    test('clicking reload button calls window.location.reload', () => {
        render(<Authenticating/>);
        const reloadButton = screen.getByRole('button', {name: 'Reload'});
        fireEvent.click(reloadButton);
        expect(mockReload).toHaveBeenCalled();
    });

    test('renders correctly with unused props', () => {
        render(<Authenticating someUnusedProp="value"/>);
        expect(screen.getByText('Authentication')).toBeInTheDocument();
        expect(screen.getByText('You are being redirected to the openid provider.')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Reload'})).toBeInTheDocument();
        expect(mockT).toHaveBeenCalledWith('Authentication');
        expect(mockT).toHaveBeenCalledWith('You are being redirected to the openid provider.');
        expect(mockT).toHaveBeenCalledWith('Reload');
    });

    test('translation function handles different language', () => {
        const mockTWithFrench = vi.fn((key) => {
            const translations = {
                Authentication: 'Authentification',
                'You are being redirected to the openid provider.': 'Vous êtes redirigé vers le fournisseur OpenID.',
                Reload: 'Recharger',
            };
            return translations[key] || key;
        });
        mockUseTranslation.mockReturnValue({t: mockTWithFrench, i18n: {language: 'fr'}});

        render(<Authenticating/>);

        expect(screen.getByText('Authentification')).toBeInTheDocument();
        expect(screen.getByText('Vous êtes redirigé vers le fournisseur OpenID.')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Recharger'})).toBeInTheDocument();
        expect(mockTWithFrench).toHaveBeenCalledWith('Authentication');
        expect(mockTWithFrench).toHaveBeenCalledWith('You are being redirected to the openid provider.');
        expect(mockTWithFrench).toHaveBeenCalledWith('Reload');
    });
});
