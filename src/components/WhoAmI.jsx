import React, {useEffect, useState} from 'react';
import {URL_AUTH_WHOAMI} from '../config/apiPath';
import {
    Card,
    CardContent,
    LinearProgress,
    Alert,
    Typography,
    Button,
    Box,
    useTheme
} from '@mui/material';
import {FaSignOutAlt, FaServer, FaUser, FaKey, FaLock, FaCode, FaWifi, FaMoon, FaSun} from "react-icons/fa";
import {useOidc} from "../context/OidcAuthContext.tsx";
import {useAuth, useAuthDispatch, Logout} from "../context/AuthProvider.jsx";
import {useNavigate} from "react-router-dom";
import logger from '../utils/logger.js';
import useFetchDaemonStatus from "../hooks/useFetchDaemonStatus";
import {useDarkMode} from "../context/DarkModeContext";

const WhoAmI = () => {
    const [userInfo, setUserInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [appVersion, setAppVersion] = useState(null);
    const {userManager} = useOidc();
    const auth = useAuth();
    const authDispatch = useAuthDispatch();
    const navigate = useNavigate();
    const {daemon, fetchNodes} = useFetchDaemonStatus();
    const {isDarkMode, toggleDarkMode} = useDarkMode();
    const theme = useTheme();

    // Fetch app version from GitHub API
    useEffect(() => {
        const fetchVersion = async () => {
            const cached = localStorage.getItem('appVersion');
            const cacheTime = localStorage.getItem('appVersionTime');
            const now = Date.now();

            if (cached && cacheTime && (now - parseInt(cacheTime)) < 3600000) {
                setAppVersion(cached);
                return;
            }

            try {
                const response = await fetch('https://api.github.com/repos/opensvc/om3-webapp/releases', {
                    headers: {'User-Agent': 'MonTestCurl'}
                });
                const data = await response.json();
                const latestVersion = data[0]?.tag_name || 'Unknown';
                const cleanVersion = latestVersion.startsWith('v') ? latestVersion.slice(1) : latestVersion;

                setAppVersion(cleanVersion);
                localStorage.setItem('appVersion', cleanVersion);
                localStorage.setItem('appVersionTime', now.toString());
            } catch (error) {
                logger.error('Error fetching version:', error);
                setAppVersion(cached || 'Unknown');
            }
        };

        fetchVersion();
    }, []);

    // Fetch daemon status to get the nodename
    useEffect(() => {
        const fetchDaemonData = async () => {
            const token = localStorage.getItem("authToken");
            if (token) {
                try {
                    await fetchNodes(token);
                } catch (error) {
                    logger.error("Error fetching daemon status:", error);
                }
            }
        };

        fetchDaemonData();
    }, [fetchNodes]);

    useEffect(() => {
        const fetchUserInfo = async () => {
            try {
                const response = await fetch(URL_AUTH_WHOAMI, {
                    credentials: 'include',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    }
                });

                if (!response.ok) {
                    setError('Failed to load user information');
                    return;
                }
                setUserInfo(await response.json());
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchUserInfo();
    }, []);

    const handleLogout = () => {
        if (auth?.authChoice === "openid") {
            userManager.signoutRedirect();
            userManager.removeUser();
        }
        localStorage.removeItem("authToken");
        authDispatch({type: Logout});
        navigate("/auth-choice");
    };

    if (loading) return <LinearProgress/>;
    if (error) return <Alert severity="error">{error}</Alert>;

    return (
        <Box sx={{p: 3}}>
            <Typography variant="h4" gutterBottom sx={{mb: 4}}>
                My Information
            </Typography>

            <Box sx={{
                display: 'flex',
                flexDirection: {xs: 'column', lg: 'row'},
                gap: 3,
                alignItems: 'stretch'
            }}>
                {/* My Information Panel */}
                <Card
                    sx={{
                        flex: 2,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: 4
                        }
                    }}
                >
                    <CardContent>
                        <Box sx={{display: 'flex', alignItems: 'center', mb: 3}}>
                            <FaUser style={{marginRight: '8px', color: '#1976d2'}}/>
                            <Typography variant="h5" component="h2">
                                My Information
                            </Typography>
                        </Box>

                        <Box sx={{display: 'grid', gridTemplateColumns: {xs: '1fr', md: '1fr 1fr'}, gap: 3}}>
                            {/* Identity Section */}
                            <Box>
                                <Typography variant="h6" sx={{mb: 2, display: 'flex', alignItems: 'center'}}>
                                    <FaUser style={{marginRight: '8px', fontSize: '1rem'}}/>
                                    Identity
                                </Typography>
                                <Box sx={{spaceY: 2}}>
                                    <Box sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        py: 1
                                    }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Username
                                        </Typography>
                                        <Typography variant="body1"
                                                    sx={{fontFamily: 'monospace', fontWeight: 'medium'}}>
                                            {userInfo.name}
                                        </Typography>
                                    </Box>

                                    <Box sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        py: 1,
                                        borderTop: '1px solid',
                                        borderColor: 'divider'
                                    }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Auth Method
                                        </Typography>
                                        <Typography variant="body1"
                                                    sx={{fontFamily: 'monospace', fontWeight: 'medium'}}>
                                            {userInfo.auth}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>

                            {/* Access Section */}
                            <Box>
                                <Typography variant="h6" sx={{mb: 2, display: 'flex', alignItems: 'center'}}>
                                    <FaKey style={{marginRight: '8px', fontSize: '1rem'}}/>
                                    Access
                                </Typography>
                                <Box sx={{spaceY: 2}}>
                                    <Box sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        py: 1
                                    }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Namespace
                                        </Typography>
                                        <Typography variant="body1"
                                                    sx={{fontFamily: 'monospace', fontWeight: 'medium'}}>
                                            {userInfo.namespace}
                                        </Typography>
                                    </Box>

                                    <Box sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        py: 1,
                                        borderTop: '1px solid',
                                        borderColor: 'divider'
                                    }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Raw Permissions
                                        </Typography>
                                        <Typography variant="body1"
                                                    sx={{fontFamily: 'monospace', fontWeight: 'medium'}}>
                                            {userInfo.raw_grant || 'None'}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                        </Box>

                        {/* Permissions Section - Full width */}
                        <Box sx={{mt: 3}}>
                            <Typography variant="h6" sx={{mb: 2, display: 'flex', alignItems: 'center'}}>
                                <FaLock style={{marginRight: '8px', fontSize: '1rem'}}/>
                                Permission Details
                            </Typography>

                            <Box sx={{
                                bgcolor: isDarkMode ? 'background.default' : 'grey.50',
                                p: 2,
                                borderRadius: 1,
                                maxHeight: '300px',
                                overflow: 'auto'
                            }}>
                                <pre style={{
                                    margin: 0,
                                    fontSize: '0.875rem',
                                    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                                    color: isDarkMode ? '#ffffff' : theme.palette.text.primary,
                                    backgroundColor: 'transparent'
                                }}>
                                    {JSON.stringify(userInfo.grant, null, 2)}
                                </pre>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>

                {/* Right Side - Server Information, Dark Mode and Logout */}
                <Box sx={{flex: 1, display: 'flex', flexDirection: 'column', gap: 3}}>
                    {/* Server Information Panel */}
                    <Card
                        sx={{
                            cursor: 'pointer',
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                                transform: 'translateY(-2px)',
                                boxShadow: 4
                            }
                        }}
                    >
                        <CardContent>
                            <Box sx={{display: 'flex', alignItems: 'center', mb: 3}}>
                                <FaServer style={{marginRight: '8px', color: '#1976d2'}}/>
                                <Typography variant="h5" component="h2">
                                    Server Information
                                </Typography>
                            </Box>

                            <Box sx={{display: 'flex', flexDirection: 'column', gap: 3}}>
                                {/* Connected Node Information */}
                                <Box sx={{
                                    textAlign: 'center',
                                    p: 2,
                                    bgcolor: isDarkMode ? 'background.default' : 'grey.50',
                                    borderRadius: 1,
                                    border: isDarkMode ? `1px solid ${theme.palette.divider}` : 'none'
                                }}>
                                    <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1}}>
                                        <FaWifi style={{color: '#4caf50', marginRight: '8px'}}/>
                                        <Typography variant="h6" color="primary.main">
                                            Connected Node
                                        </Typography>
                                    </Box>
                                    <Typography
                                        variant="h5"
                                        sx={{
                                            fontFamily: 'monospace',
                                            fontWeight: 'bold',
                                            color: 'text.primary'
                                        }}
                                    >
                                        {daemon?.nodename || 'Loading...'}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Daemon Node
                                    </Typography>
                                </Box>

                                {/* Application Version */}
                                <Box sx={{textAlign: 'center', p: 2}}>
                                    <FaCode style={{
                                        fontSize: '2.5rem',
                                        color: '#1976d2',
                                        marginBottom: '12px',
                                        opacity: 0.8
                                    }}/>

                                    <Typography variant="h5" component="div" sx={{
                                        fontFamily: 'monospace',
                                        fontWeight: 'bold',
                                        color: 'primary.main',
                                        mb: 1
                                    }}>
                                        v{appVersion || 'loading...'}
                                    </Typography>

                                    <Typography variant="body1" color="text.secondary" sx={{mb: 1}}>
                                        OM3 WebApp
                                    </Typography>

                                    <Typography variant="caption" color="text.secondary" sx={{fontStyle: 'italic'}}>
                                        Open Source Cluster Management
                                    </Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>

                    {/* Dark Mode Toggle Button */}
                    <Button
                        startIcon={isDarkMode ? <FaSun/> : <FaMoon/>}
                        onClick={toggleDarkMode}
                        size="large"
                        fullWidth
                        sx={{
                            backgroundColor: isDarkMode ? "#ff9800" : "#333333",
                            color: "white",
                            boxShadow: 2,
                            padding: '16px 24px',
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            borderRadius: 2,
                            "&:hover": {
                                backgroundColor: isDarkMode ? "#f57c00" : "#555555",
                                boxShadow: 4
                            },
                            transition: 'all 0.3s ease',
                        }}
                        aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
                    >
                        {isDarkMode ? "Light Mode" : "Dark Mode"}
                    </Button>

                    {/* Simple Logout Button */}
                    <Button
                        startIcon={<FaSignOutAlt/>}
                        onClick={handleLogout}
                        size="large"
                        fullWidth
                        sx={{
                            backgroundColor: "red",
                            color: "white",
                            boxShadow: 2,
                            padding: '16px 24px',
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            borderRadius: 2,
                            "&:hover": {
                                backgroundColor: "darkred",
                                boxShadow: 4
                            },
                        }}
                    >
                        Logout
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

export default WhoAmI;
