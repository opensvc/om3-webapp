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
        <Dialog open={true} aria-labelledby="dialog-title" className="p-4">
            <DialogTitle id="dialog-title">{t('Login')}</DialogTitle>
            <DialogContent>
                <TextField
                    placeholder={t('Username')}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    fullWidth
                    sx={{ mb: 2 }}
                    autoFocus
                />
                <TextField
                    type="password"
                    placeholder={t('Password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    fullWidth
                    sx={{ mb: 2 }}
                />
                {errorMessage && (
                    <Typography color="error" sx={{ mb: 2 }}>
                        {errorMessage}
                    </Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleSubmit} disabled={!username || !password} color="primary">
                    {t('Submit')}
                </Button>
                <Button onClick={handleChangeMethod} color="secondary">
                    {t('Change Method')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default Login;