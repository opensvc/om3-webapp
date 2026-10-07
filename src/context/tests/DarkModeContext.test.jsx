import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { DarkModeProvider, useDarkMode } from '../DarkModeContext';

// Helper component to consume the context
const TestConsumer = () => {
    const { isDarkMode, toggleDarkMode, theme, setTheme, palette, setPalette } = useDarkMode();
    return (
        <div>
            <span data-testid="mode">{isDarkMode ? 'dark' : 'light'}</span>
            <span data-testid="theme">{theme}</span>
            <span data-testid="palette">{palette}</span>
            <button onClick={toggleDarkMode}>Toggle</button>
            <button onClick={() => setTheme('system')}>System</button>
            <button onClick={() => setPalette('contrast')}>Contrast</button>
        </div>
    );
};

// Component that uses the hook without a provider (for error test)
const UnwrappedConsumer = () => {
    useDarkMode();
    return null;
};

const renderProvider = () => render(
    <DarkModeProvider>
        <TestConsumer />
    </DarkModeProvider>
);

const htmlHas = (name) => document.documentElement.classList.contains(name);

describe('DarkModeContext', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.classList.remove('dark', 'contrast');
    });

    test('follows the system theme, light without matchMedia, when nothing is stored', () => {
        renderProvider();
        expect(screen.getByTestId('theme').textContent).toBe('system');
        expect(screen.getByTestId('mode').textContent).toBe('light');
        expect(htmlHas('dark')).toBe(false);
    });

    test('follows a dark system theme', () => {
        const original = window.matchMedia;
        window.matchMedia = jest.fn().mockReturnValue({
            matches: true,
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
        });
        try {
            renderProvider();
            expect(screen.getByTestId('mode').textContent).toBe('dark');
            expect(htmlHas('dark')).toBe(true);
        } finally {
            window.matchMedia = original;
        }
    });

    test('reads the stored theme', () => {
        localStorage.setItem('om3.theme', 'dark');
        renderProvider();
        expect(screen.getByTestId('mode').textContent).toBe('dark');
        expect(htmlHas('dark')).toBe(true);
    });

    test('carries over the former darkMode setting and drops its key', () => {
        localStorage.setItem('darkMode', 'true');
        renderProvider();
        expect(screen.getByTestId('theme').textContent).toBe('dark');
        expect(localStorage.getItem('om3.theme')).toBe('dark');
        expect(localStorage.getItem('darkMode')).toBeNull();
    });

    test('toggleDarkMode switches between explicit dark and light themes', () => {
        renderProvider();

        act(() => {
            screen.getByText('Toggle').click();
        });
        expect(screen.getByTestId('mode').textContent).toBe('dark');
        expect(localStorage.getItem('om3.theme')).toBe('dark');
        expect(htmlHas('dark')).toBe(true);

        act(() => {
            screen.getByText('Toggle').click();
        });
        expect(screen.getByTestId('mode').textContent).toBe('light');
        expect(localStorage.getItem('om3.theme')).toBe('light');
        expect(htmlHas('dark')).toBe(false);
    });

    test('setTheme goes back to the system theme', () => {
        localStorage.setItem('om3.theme', 'dark');
        renderProvider();

        act(() => {
            screen.getByText('System').click();
        });
        expect(screen.getByTestId('theme').textContent).toBe('system');
        expect(localStorage.getItem('om3.theme')).toBe('system');
        expect(htmlHas('dark')).toBe(false);
    });

    test('setPalette applies and stores the high-contrast palette', () => {
        renderProvider();
        expect(screen.getByTestId('palette').textContent).toBe('standard');

        act(() => {
            screen.getByText('Contrast').click();
        });
        expect(screen.getByTestId('palette').textContent).toBe('contrast');
        expect(localStorage.getItem('om3.palette')).toBe('contrast');
        expect(htmlHas('contrast')).toBe(true);
    });

    test('useDarkMode throws error when used outside DarkModeProvider', () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => {
            render(<UnwrappedConsumer />);
        }).toThrow('useDarkMode must be used within a DarkModeProvider');
        consoleError.mockRestore();
    });

    test('renders children correctly', () => {
        render(
            <DarkModeProvider>
                <div data-testid="child">Hello</div>
            </DarkModeProvider>
        );
        expect(screen.getByTestId('child')).toBeInTheDocument();
    });
});
