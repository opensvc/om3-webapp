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
} from '@mui/material';
import {FaSignOutAlt, FaServer, FaUser, FaLock, FaCode, FaWifi, FaMoon, FaSun} from "react-icons/fa";
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

    // Fetch version from GitHub
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

    // Fetch daemon status
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

    // Fetch WhoAmI
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
                        '&:hover': {transform: 'translateY(-2px)', boxShadow: 4}
                    }}
                >
                    <CardContent>
                        <Box sx={{display: 'flex', alignItems: 'center', mb: 3}}>
                            <FaUser style={{marginRight: '8px', color: '#1976d2'}}/>
                            <Typography variant="h5">My Information</Typography>
                        </Box>

                        {/* Identity */}
                        <Box>
                            <Typography variant="h6" sx={{mb: 2, display: 'flex', alignItems: 'center'}}>
                                <FaUser style={{marginRight: '8px', fontSize: '1rem'}}/>
                                Identity
                            </Typography>

                            <Box>
                                <Box sx={{display: 'flex', justifyContent: 'space-between', py: 1}}>
                                    <Typography variant="body2" color="text.secondary">Username</Typography>
                                    <Typography variant="body1" sx={{fontFamily: 'monospace'}}>
                                        {userInfo.name}
                                    </Typography>
                                </Box>

                                <Box sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    py: 1,
                                    borderTop: '1px solid',
                                    borderColor: 'divider'
                                }}>
                                    <Typography variant="body2" color="text.secondary">Auth Method</Typography>
                                    <Typography variant="body1" sx={{fontFamily: 'monospace'}}>
                                        {userInfo.auth}
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>

                        {/* Permission Details */}
                        <Box sx={{mt: 3}}>
                            <Typography variant="h6" sx={{mb: 2, display: 'flex', alignItems: 'center'}}>
                                <FaLock style={{marginRight: '8px'}}/>
                                Permission Details
                            </Typography>

                            <Box sx={{
                                bgcolor: isDarkMode ? 'background.default' : 'grey.50',
                                p: 2,
                                borderRadius: 1
                            }}>
                                <Typography variant="body2" color="text.secondary">Raw Permissions</Typography>
                                <Typography variant="body1" sx={{fontFamily: 'monospace'}}>
                                    {userInfo.raw_grant || "None"}
                                </Typography>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>

                {/* RIGHT PANEL */}
                <Box sx={{flex: 1, display: 'flex', flexDirection: 'column', gap: 3}}>

                    {/* Server Info */}
                    <Card
                        sx={{
                            cursor: 'pointer',
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {transform: 'translateY(-2px)', boxShadow: 4}
                        }}
                    >
                        <CardContent>

                            <Box sx={{display: 'flex', alignItems: 'center', mb: 3}}>
                                <FaServer style={{marginRight: '8px', color: '#1976d2'}}/>
                                <Typography variant="h5">Server Information</Typography>
                            </Box>

                            {/* Connected Node */}
                            <Box sx={{mb: 3}}>
                                <Typography variant="h6" sx={{mb: 2, display: 'flex', alignItems: 'center'}}>
                                    <FaWifi style={{marginRight: '8px'}}/>
                                    Connected Node
                                </Typography>

                                <Box>
                                    <Box sx={{display: 'flex', justifyContent: 'space-between', py: 1}}>
                                        <Typography variant="body2" color="text.secondary">
                                            Node Name
                                        </Typography>
                                        <Typography variant="body1" sx={{fontFamily: 'monospace'}}>
                                            {daemon?.nodename || "Loading..."}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>

                            {/* App Version */}
                            <Box>
                                <Typography variant="h6" sx={{mb: 2, display: 'flex', alignItems: 'center'}}>
                                    <FaCode style={{marginRight: '8px'}}/>
                                    WebApp Version
                                </Typography>

                                <Box>
                                    <Box sx={{display: 'flex', justifyContent: 'space-between', py: 1}}>
                                        <Typography variant="body2" color="text.secondary">Version</Typography>
                                        <Typography variant="body1" sx={{fontFamily: 'monospace'}}>
                                            v{appVersion || "Loading..."}
                                        </Typography>
                                    </Box>

                                    <Box sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        py: 1,
                                        borderTop: '1px solid',
                                        borderColor: 'divider'
                                    }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Description
                                        </Typography>
                                        <Typography variant="body1" color="text.secondary">
                                            OM3 WebApp
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>

                    {/* Dark Mode */}
                    <Button
                        startIcon={isDarkMode ? <FaSun/> : <FaMoon/>}
                        onClick={toggleDarkMode}
                        size="large"
                        fullWidth
                        sx={{
                            backgroundColor: isDarkMode ? "#ff9800" : "#333333",
                            color: "white",
                            fontWeight: 'bold',
                            borderRadius: 2
                        }}
                    >
                        {isDarkMode ? "Light Mode" : "Dark Mode"}
                    </Button>

                    {/* Logout */}
                    <Button
                        startIcon={<FaSignOutAlt/>}
                        onClick={handleLogout}
                        size="large"
                        fullWidth
                        sx={{
                            backgroundColor: "red",
                            color: "white",
                            fontWeight: 'bold',
                            borderRadius: 2
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
