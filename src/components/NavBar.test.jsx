// NavBar.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NavBar from './NavBar';
import { AuthProvider } from '../context/AuthProvider.jsx'; // adapt if needed
import { OidcAuthProvider } from '../context/OidcAuthContext.js'; // adapt if needed

describe('NavBar', () => {
    const renderWithProviders = (initialPath = '/cluster') => {
        render(
            <MemoryRouter initialEntries={[initialPath]}>
                <OidcAuthProvider>
                    <AuthProvider>
                        <Routes>
                            <Route path="*" element={<NavBar />} />
                        </Routes>
                    </AuthProvider>
                </OidcAuthProvider>
            </MemoryRouter>
        );
    };

    test('affiche correctement Cluster si chemin /cluster', () => {
        renderWithProviders('/cluster');
        expect(screen.getByText('Cluster')).toBeInTheDocument();
    });

    test('affiche les breadcrumbs pour un chemin plus profond', () => {
        renderWithProviders('/cluster/my%2Fpool/details');
        expect(screen.getByText('Cluster')).toBeInTheDocument();
        expect(screen.getByText('my/pool')).toBeInTheDocument();
        expect(screen.getByText('details')).toBeInTheDocument();
    });

    test('le bouton logout supprime le token et redirige', () => {
        localStorage.setItem('authToken', 'fake-token');
        renderWithProviders('/cluster');

        const logoutButton = screen.getByRole('button', { name: /logout/i });
        fireEvent.click(logoutButton);

        expect(localStorage.getItem('authToken')).toBeNull();
        // Note : on ne peut pas facilement tester "navigate" sans mock,
        // mais au moins on sait que le logout se passe bien.
    });

    test('chaque breadcrumb est un Link vers le bon chemin', () => {
        renderWithProviders('/cluster/section/subsection');

        const links = screen.getAllByRole('link');
        expect(links[0]).toHaveAttribute('href', '/cluster');
        expect(links[1]).toHaveAttribute('href', '/cluster/section');
        expect(links[2]).toHaveAttribute('href', '/cluster/section/subsection');
    });
});
