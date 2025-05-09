import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter as Router} from 'react-router-dom';
import App from './components/App';
import './i18n';
import './styles/main.css';

const rootElement = document.getElementById('root');

if (rootElement) {
    const basename = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
    const root = ReactDOM.createRoot(rootElement);

    root.render(
        <React.StrictMode>
            <Router basename={basename}>
                <App/>
            </Router>
        </React.StrictMode>
    );
} else {
    console.error("DOM element with id 'root' not found!");
}