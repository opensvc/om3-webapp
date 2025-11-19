import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter as Router} from 'react-router-dom';
import App from './components/App';
import './i18n';
import './styles/main.css';
import logger from './utils/logger.js';


const rootElement = document.getElementById('root');

if (rootElement) {
    const pathname = window.location.pathname;
    const uiMatch = pathname.startsWith('/ui') ? '/ui' : '/';

    const root = ReactDOM.createRoot(rootElement);
    root.render(
        <React.StrictMode>
            <Router basename={uiMatch}>
                <App/>
            </Router>
        </React.StrictMode>
    );
} else {
    logger.error("DOM element with id 'root' not found!");
}
