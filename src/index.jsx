import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter as Router} from 'react-router-dom';
import App from './components/App';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {grey} from '@mui/material/colors';
import './i18n';
import './styles/main.css';
import logger from './utils/logger.js';


const rootElement = document.getElementById('root');

if (rootElement) {
    const pathname = window.location.pathname;
    const uiMatch = pathname.startsWith('/ui') ? '/ui' : '/';

    const root = ReactDOM.createRoot(rootElement);
    const theme = createTheme({
        palette: {
            primary: {
                main: grey[900],
                contrastText: '#fff',
            },
        },
    });
    root.render(
        <React.StrictMode>
            <ThemeProvider theme={theme}>
                <Router basename={uiMatch}>
                    <App/>
                </Router>
            </ThemeProvider>
        </React.StrictMode>
    );
} else {
    logger.error("DOM element with id 'root' not found!");
}
