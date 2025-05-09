import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App';
import './i18n';
import './styles/main.css'

const rootElement = document.getElementById('root');

if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);

    root.render(
        <React.StrictMode>
            <App/>
        </React.StrictMode>
    );
} else {
    console.error("DOM element with id 'root' not found!");
}
