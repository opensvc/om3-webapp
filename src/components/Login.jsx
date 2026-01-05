import React, {useState, forwardRef} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate} from 'react-router-dom';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {SetAccessToken, SetAuthChoice, useAuthDispatch} from "../context/AuthProvider.jsx";
import {URL_TOKEN, URL_REFRESH} from "../config/apiPath.js";
import logger from '../utils/logger.js';

// --- Custom decodeToken using safe Base64url decoding for compatibility with tests ---
export const decodeToken = (token) => {
    if (!token) return null;

    // Base64url decode function
    const base64UrlDecode = (str) => {
        try {
            let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
            while (base64.length % 4) base64 += '=';
            // atob decodes base64 encoded string
            return atob(base64);
        } catch (e) {
            return null; // Return null instead of throwing
        }
    };

    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            const error = new Error('Invalid token format: expected 3 parts');
            logger.error('Error decoding token:', error);
            return null;
        }
        const payloadBase64 = parts[1];
        const decodedPayload = base64UrlDecode(payloadBase64);
        if (!decodedPayload) {
            const error = new Error('Failed to decode payload');
            logger.error('Error decoding token:', error);
            return null;
        }
        return JSON.parse(decodedPayload);
    } catch (error) {
        logger.error('Error decoding token:', error);
        return null;
    }
};

// Queue mechanism for concurrent refresh token calls
let refreshTokenPromise = null;

// --- Exported refreshToken with robust error and expiration handling ---
export const refreshToken = async (dispatch) => {
    // If a refresh is already in progress, return the existing promise
    if (refreshTokenPromise) {
        return refreshTokenPromise;
    }

    const refresh_token = localStorage.getItem('refreshToken');
    if (!refresh_token) return null;

    const refreshExpiration = localStorage.getItem('refreshTokenExpiration');
    if (refreshExpiration && Date.now() > parseInt(refreshExpiration, 10)) {
        logger.error('Refresh token expired');
        dispatch({type: SetAccessToken, data: null});
        return null;
    }

    // Create the refresh promise
    refreshTokenPromise = (async () => {
        try {
            const response = await fetch(URL_REFRESH, {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'Authorization': `Bearer ${refresh_token}`
                },
            });

            if (!response.ok) {
                logger.error('Error refreshing token: Token refresh failed');
                dispatch({type: SetAccessToken, data: null});
                return null;
            }

            const data = await response.json();

            localStorage.setItem('authToken', data.access_token);
            const accessExp = decodeToken(data.access_token)?.exp;
            if (accessExp) {
                localStorage.setItem('tokenExpiration', accessExp * 1000);
            } else {
                localStorage.removeItem('tokenExpiration');
            }

            if (data.refresh_token) {
                localStorage.setItem('refreshToken', data.refresh_token);
                const refreshExp = decodeToken(data.refresh_token)?.exp;
                if (refreshExp) {
                    localStorage.setItem('refreshTokenExpiration', refreshExp * 1000);
                } else {
                    localStorage.removeItem('refreshTokenExpiration');
                }
            }

            dispatch({type: SetAccessToken, data: data.access_token});
            return data.access_token;
        } catch (error) {
            logger.error('Error refreshing token:', error);
            dispatch({type: SetAccessToken, data: null});
            return null;
        } finally {
            // Clear the promise once completed
            refreshTokenPromise = null;
        }
    })();

    return refreshTokenPromise;
};

const Login = forwardRef((props, ref) => {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const dispatch = useAuthDispatch();
    const {t} = useTranslation();

    const handleLogin = async (username, password) => {
        setLoading(true);
        try {
            const response = await fetch(`${URL_TOKEN}?refresh=true`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + btoa(`${username}:${password}`),
                },
            });

            if (!response.ok) {
                const errorMsg = t('Incorrect username or password');
                logger.error('Authentication error:', errorMsg);
                setErrorMessage(errorMsg);
                setLoading(false);
                return;
            }

            const data = await response.json();
            setErrorMessage('');

            localStorage.setItem('authToken', data.access_token);
            localStorage.setItem('refreshToken', data.refresh_token);

            const accessExp = decodeToken(data.access_token)?.exp;
            if (accessExp) localStorage.setItem('tokenExpiration', accessExp * 1000);
            else localStorage.removeItem('tokenExpiration');

            const refreshExp = decodeToken(data.refresh_token)?.exp;
            if (refreshExp) localStorage.setItem('refreshTokenExpiration', refreshExp * 1000);
            else localStorage.removeItem('refreshTokenExpiration');

            dispatch({type: SetAccessToken, data: data.access_token});
            setLoading(false);
            navigate('/');
        } catch (error) {
            logger.error('Authentication error:', error);
            setErrorMessage(error.message || t('An error occurred during authentication'));
            setLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!loading) handleLogin(username, password);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSubmit(e);
    };

    const handleChangeMethod = () => {
        dispatch({type: SetAuthChoice, data: ''});
        navigate('/auth-choice');
    };

    return (
        <Dialog
            open={true}
            aria-labelledby="login-dialog"
            ref={ref}
            sx={{
                '& .MuiPaper-root': {
                    width: '100%',
                    maxWidth: '448px',
                    mx: 'auto',
                    p: 3,
                    borderRadius: 2,
                    boxShadow: 3
                }
            }}
        >
            <DialogTitle
                id="login-dialog"
                sx={{textAlign: 'center', fontSize: '1.5rem', fontWeight: 600, py: 2, color: 'text.primary'}}
            >
                {t('Login')}
            </DialogTitle>
            <DialogContent sx={{px: 3}}>
                <TextField
                    margin="normal"
                    fullWidth
                    label={t('Username')}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoFocus
                    disabled={loading}
                    sx={{mb: 2}}
                />
                <TextField
                    margin="normal"
                    fullWidth
                    label={t('Password')}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                    sx={{mb: 2}}
                />
                {errorMessage && (
                    <Typography
                        color="error"
                        variant="body2"
                        sx={{mt: 1, textAlign: 'center', animation: 'pulse 1.5s infinite'}}
                    >
                        {errorMessage}
                    </Typography>
                )}
            </DialogContent>
            <DialogActions sx={{display: 'flex', justifyContent: 'center', gap: 2, px: 3, pb: 3}}>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={!username || !password || loading}
                    sx={{px: 4, py: 1, borderRadius: 1}}
                >
                    {loading ? t('Loading...') : t('Submit')}
                </Button>
                <Button
                    variant="outlined"
                    onClick={handleChangeMethod}
                    disabled={loading}
                    sx={{px: 4, py: 1, borderRadius: 1}}
                >
                    {t('Change Method')}
                </Button>
            </DialogActions>
        </Dialog>
    );
});

export default Login;
