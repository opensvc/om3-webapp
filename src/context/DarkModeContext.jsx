import React, {createContext, useContext, useState, useEffect, useRef, useCallback} from 'react';
import {
    applyPalette,
    applyTheme,
    cachedPalette,
    cachedTheme,
    isDarkTheme,
    watchSystemTheme,
} from '../ui/theme';

const DarkModeContext = createContext();

export const useDarkMode = () => {
    const context = useContext(DarkModeContext);
    if (!context) {
        throw new Error('useDarkMode must be used within a DarkModeProvider');
    }
    return context;
};

/**
 * Appearance state of the app: the oc3 theme (system, light or dark) and palette
 * (standard or high contrast), applied as classes on <html> by src/ui/theme.
 * `isDarkMode` and `toggleDarkMode` keep the API of the former boolean dark mode.
 */
export const DarkModeProvider = ({children}) => {
    const [theme, setThemeState] = useState(cachedTheme);
    const [palette, setPaletteState] = useState(cachedPalette);
    const [isDarkMode, setIsDarkMode] = useState(() => isDarkTheme(theme));
    const themeRef = useRef(theme);

    useEffect(() => {
        themeRef.current = theme;
        applyTheme(theme);
        setIsDarkMode(isDarkTheme(theme));
    }, [theme]);

    useEffect(() => {
        applyPalette(palette);
    }, [palette]);

    useEffect(() => watchSystemTheme(
        () => themeRef.current,
        () => setIsDarkMode(isDarkTheme('system')),
    ), []);

    const setTheme = useCallback((next) => {
        // Applied right away so that styles computed during the next render,
        // such as the MUI theme read from the tokens, already see the new mode.
        applyTheme(next);
        setThemeState(next);
    }, []);

    const setPalette = useCallback((next) => {
        applyPalette(next);
        setPaletteState(next);
    }, []);

    const toggleDarkMode = useCallback(() => {
        setTheme(isDarkMode ? 'light' : 'dark');
    }, [isDarkMode, setTheme]);

    return (
        <DarkModeContext.Provider value={{isDarkMode, toggleDarkMode, theme, setTheme, palette, setPalette}}>
            {children}
        </DarkModeContext.Provider>
    );
};
