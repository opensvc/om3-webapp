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
import {URL_TOKEN} from "../config/apiPath.js";

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

const Login = forwardRef((props, ref) => {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const dispatch = useAuthDispatch();
    const {t} = useTranslation();

    const handleLogin = async (username, password) => {
        try {
            const response = await fetch(URL_TOKEN, {
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
            const newPayload = decodeToken(data.token);
            const expirationTime = newPayload?.exp * 1000;
            localStorage.setItem('tokenExpiration', expirationTime);
            dispatch({type: SetAccessToken, data: data.token});

            const payload = decodeToken(data.token);
            if (payload?.exp) {
                const refreshTime = payload.exp * 1000 - Date.now() - 5000;
                if (refreshTime > 0) {
                    setTimeout(refreshToken, refreshTime);
                }
            }

            navigate('/');
        } catch (error) {
            console.error('Authentication error:', error);
            setErrorMessage(error.message);
        }
    };

    const refreshToken = async () => {
        const token = localStorage.getItem('authToken');
        const tokenExpiration = localStorage.getItem('tokenExpiration');
        const currentTime = Date.now();

        console.log('Checking token validity...');
        console.log('Current time:', new Date(currentTime).toLocaleString());
        console.log('Token expiration time:', new Date(Number(tokenExpiration)).toLocaleString());

        if (token && tokenExpiration && currentTime < tokenExpiration) {
            console.log('Token is still valid, attempting to refresh...');
            try {
                const response = await fetch(URL_TOKEN, {
                    method: 'POST',
                    headers: {'Authorization': `Bearer ${token}`},
                });

                if (!response.ok) throw new Error('Token refresh failed');
                const data = await response.json();
                console.log('✅ Token refreshed successfully:', data.token);

                localStorage.setItem('authToken', data.token);
                const expirationTime = Date.now() + 30000;
                localStorage.setItem('tokenExpiration', expirationTime);
                console.log('New token expiration set for:', new Date(expirationTime).toLocaleString());

                dispatch({type: SetAccessToken, data: data.token});

                // Decode the new token and re-set the timeout
                const payload = decodeToken(data.token);
                if (payload?.exp) {
                    const refreshTime = payload.exp * 1000 - Date.now() - 5000;
                    if (refreshTime > 0) {
                        console.log('Next refresh in:', refreshTime / 1000, 'seconds');
                        setTimeout(refreshToken, refreshTime);
                    }
                }
            } catch (error) {
                console.error('❌ Error refreshing token:', error);
                navigate('/auth/login');
            }
        } else {
            console.warn('⚠️ Token expired or missing, redirecting to login...');
            navigate('/auth/login');
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

    const handleChangeMethod = () => {
        dispatch({type: SetAuthChoice, data: ''})
        navigate('/auth-choice')
    };

    return (
        <Dialog
            open={true}
            aria-labelledby="login-dialog"
            ref={ref}
            PaperProps={{
                sx: {
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
                sx={{
                    textAlign: 'center',
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    py: 2,
                    color: 'text.primary'
                }}
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
                    sx={{mb: 2}}
                />
                {errorMessage && (
                    <Typography
                        color="error"
                        variant="body2"
                        sx={{
                            mt: 1,
                            textAlign: 'center',
                            animation: 'pulse 1.5s infinite'
                        }}
                    >
                        {errorMessage}
                    </Typography>
                )}
            </DialogContent>
            <DialogActions sx={{
                display: 'flex',
                justifyContent: 'center',
                gap: 2,
                px: 3,
                pb: 3
            }}>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={!username || !password}
                    sx={{
                        px: 4,
                        py: 1,
                        borderRadius: 1
                    }}
                >
                    {t('Submit')}
                </Button>
                <Button
                    variant="outlined"
                    onClick={handleChangeMethod}
                    sx={{
                        px: 4,
                        py: 1,
                        borderRadius: 1
                    }}
                >
                    {t('Change Method')}
                </Button>
            </DialogActions>
        </Dialog>
    );
});

export default Login;