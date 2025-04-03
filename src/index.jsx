import React from 'react';
import ReactDOM from 'react-dom/client';
import { OidcProvider } from '@axa-fr/react-oidc';
import OidcConfiguration from './config/oidcConfiguration';
import App from './components/App';
import './styles/main.css'

console.log(document.getElementById('root'));
const rootElement = document.getElementById('root');

if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);

    root.render(
        <OidcProvider configuration={OidcConfiguration()}>
            <App />
        </OidcProvider>
    );
} else {
    console.error("DOM element with id 'root' not found!");
}