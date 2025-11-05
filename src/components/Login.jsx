import React, {useState, forwardRef, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate} from 'react-router-dom';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
    SetAccessToken,
    SetAuthChoice,
    useAuthDispatch,
} from '../context/AuthProvider.jsx';
import {URL_TOKEN, URL_REFRESH} from '../config/apiPath.js';

// --- Secure decodeToken ---
export const decodeToken = (token) => {
    if (!token) return null;
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch (error) {
        console.error('Error decoding token:', error);
        return null;
    }
};

// --- Refresh token queue lock to handle concurrency ---
let refreshInProgress = false;
let refreshQueue = [];

export const refreshToken = async (dispatch) => {
    // If refresh already in progress, return a promise that resolves when complete
    if (refreshInProgress) {
        return new Promise((resolve, reject) => {
            refreshQueue.push({resolve, reject});
        });
    }

    const refresh_token = localStorage.getItem('refreshToken');
    if (!refresh_token) return null;

    const refreshExpiration = localStorage.getItem('refreshTokenExpiration');
    if (refreshExpiration && Date.now() > parseInt(refreshExpiration)) {
        console.error('Refresh token expired');
        dispatch({type: SetAccessToken, data: null});
        return null;
    }

    refreshInProgress = true;

    try {
        const response = await fetch(URL_REFRESH, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                Authorization: `Bearer ${refresh_token}`,
            },
        });

        if (!response.ok) {
            console.error('Error refreshing token: Token refresh failed');
            dispatch({type: SetAccessToken, data: null});
            refreshInProgress = false;
            refreshQueue.forEach(({reject}) =>
                reject(new Error('Token refresh failed'))
            );
            refreshQueue = [];
            return null;
        }

        const data = await response.json();

        localStorage.setItem('authToken', data.access_token);
        const expirationTime = decodeToken(data.access_token)?.exp * 1000;
        if (expirationTime) localStorage.setItem('tokenExpiration', expirationTime);

        dispatch({type: SetAccessToken, data: data.access_token});

        refreshInProgress = false;
        refreshQueue.forEach(({resolve}) => resolve(data.access_token));
        refreshQueue = [];

        return data.access_token;
    } catch (error) {
        console.error('Error refreshing token:', error);
        dispatch({type: SetAccessToken, data: null});
        refreshInProgress = false;
        refreshQueue.forEach(({reject}) => reject(error));
        refreshQueue = [];
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

    const isMounted = useRef(true);
    React.useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    const handleLogin = async (username, password) => {
        try {
            const response = await fetch(`${URL_TOKEN}?refresh=true`, {
                method: 'POST',
                headers: {
                    Authorization: 'Basic ' + btoa(`${username}:${password}`),
                },
            });

            if (!response.ok) {
                const errorMessage = t('Incorrect username or password');
                console.error('Authentication error:', errorMessage);
                setErrorMessage(errorMessage);
                return;
            }

            const data = await response.json();
            setErrorMessage('');

            localStorage.setItem('authToken', data.access_token);
            localStorage.setItem('refreshToken', data.refresh_token);
            const accessExp = decodeToken(data.access_token)?.exp * 1000;
            if (accessExp) localStorage.setItem('tokenExpiration', accessExp);
            const refreshDecoded = decodeToken(data.refresh_token);
            const refreshExp = refreshDecoded?.exp * 1000;
            if (refreshExp) localStorage.setItem('refreshTokenExpiration', refreshExp);

            dispatch({type: SetAccessToken, data: data.access_token});
            navigate('/');
        } catch (error) {
            console.error('Authentication error:', error);
            setErrorMessage(error.message || t('Network or server error'));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (username && password) handleLogin(username, password);
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
                    boxShadow: 3,
                },
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
                    sx={{mb: 2}}
                    inputProps={{autoComplete: 'username'}}
                />
                <TextField
                    margin="normal"
                    label={t('Password')}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    sx={{mb: 2}}
                    inputProps={{autoComplete: 'current-password'}}
                />
                {errorMessage && (
                    <Typography
                        variant="body2"
                        sx={{mt: 1, textAlign: 'center', animation: 'pulse 1.5s infinite'}}
                    >
                        {errorMessage}
                    </Typography>
                )}
            </DialogContent>
            <DialogActions
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 2,
                    px: 3,
                    pb: 3,
                }}
            >
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={!username || !password}
                    sx={{px: 4, py: 1, borderRadius: 1}}
                >
                    {t('Submit')}
                </Button>
                <Button
                    variant="outlined"
                    onClick={handleChangeMethod}
                    sx={{px: 4, py: 1, borderRadius: 1}}
                >
                    {t('Change Method')}
                </Button>
            </DialogActions>
        </Dialog>
    );
});

export default Login;
