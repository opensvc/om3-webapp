/* eslint-disable no-unused-vars */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useStateValue } from '../state.jsx';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

const decodeToken = (token) => {
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload;
    } catch (error) {
        console.error('Error decoding token:', error);
        return null;
    }
};

function Login() {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [{ basicLogin }, dispatch] = useStateValue();
    const { t } = useTranslation();

    const refreshToken = async () => {
        const token = localStorage.getItem('authToken');
        if (token) {
            try {
                const response = await fetch('/auth/token', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                if (!response.ok) throw new Error('Token refresh failed');
                const data = await response.json();
                localStorage.setItem('authToken', data.token);
                dispatch({ type: 'setBasicLogin', data: { ...basicLogin, token: data.token } });
            } catch (error) {
                console.error('Error refreshing token:', error);
            }
        }
    };

    const handleLogin = async (username, password) => {
        try {
            const response = await fetch('/auth/token', {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + btoa(`${username}:${password}`),
                },
            });

            if (!response.ok) {
                throw new Error('Incorrect username or password');
            }

            const data = await response.json();
            console.log('Token received:', data.token);

            setErrorMessage('');
            localStorage.setItem('authToken', data.token);
            dispatch({ type: 'setBasicLogin', data: { username, password, token: data.token } });

            const payload = decodeToken(data.token);
            if (payload && payload.exp) {
                const refreshTime = payload.exp * 1000 - Date.now() - 5000;
                if (refreshTime > 0) {
                    setTimeout(() => refreshToken(), refreshTime);
                }
            }

            navigate('/nodes');
        } catch (error) {
            console.error('Authentication error:', error);
            setErrorMessage(error.message);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        handleLogin(username, password);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSubmit(e);
        }
    };

    const handleChangeMethod = (e) => {
        dispatch({ type: 'setAuthChoice', data: '' });
    };

    return (
        <Dialog
            open={true}
            aria-labelledby="dialog-title"
            className="p-4"
            PaperProps={{
                className: 'bg-gray-100 rounded-lg shadow-lg w-full max-w-md mx-auto',
            }}
        >
            <DialogTitle
                id="dialog-title"
                className="text-2xl font-semibold text-gray-800 text-center py-4"
            >
                {t('Login')}
            </DialogTitle>
            <DialogContent className="px-6">
                <TextField
                    placeholder={t('Username')}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    fullWidth
                    autoFocus
                    sx={{ mb: 3 }} // Utilisation de sx pour un espacement de 24px (3 * 8px)
                    InputProps={{
                        className:
                            'bg-white border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200',
                    }}
                />
                <TextField
                    type="password"
                    placeholder={t('Password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    fullWidth
                    sx={{ mb: 2 }} // 16px (2 * 8px) pour l'espace avec le message d'erreur
                    InputProps={{
                        className:
                            'bg-white border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200',
                    }}
                />
                {errorMessage && (
                    <Typography
                        className="text-red-500 text-sm mb-4 animate-pulse text-center"
                    >
                        {errorMessage}
                    </Typography>
                )}
            </DialogContent>
            <DialogActions className="px-6 pb-6 flex justify-center gap-4">
                <Button
                    onClick={handleSubmit}
                    disabled={!username || !password}
                    className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 transition duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {t('Submit')}
                </Button>
                <Button
                    onClick={handleChangeMethod}
                    className="bg-gray-500 text-white px-6 py-2 rounded-md hover:bg-gray-600 transition duration-200"
                >
                    {t('Change Method')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default Login;