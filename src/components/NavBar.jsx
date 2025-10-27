import {Link, useNavigate, useLocation} from "react-router-dom";
import {AppBar, Toolbar, Typography, Button, Box, Menu, MenuItem, ListItemIcon, ListItemText} from "@mui/material";
import {
    FaSignOutAlt,
    FaUser,
    FaBars,
    FaHome,
    FaList,
    FaHeartbeat,
    FaServer,
    FaDatabase,
    FaCubes,
    FaNetworkWired
} from "react-icons/fa";
import {useOidc} from "../context/OidcAuthContext.tsx";
import {useAuth, useAuthDispatch, Logout} from "../context/AuthProvider.jsx";
import {useEffect, useState, useMemo, useCallback} from "react";
import useFetchDaemonStatus from "../hooks/useFetchDaemonStatus";
import useEventStore from "../hooks/useEventStore.js";
import logger from '../utils/logger.js';
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {red, orange} from "@mui/material/colors";
import Tooltip from "@mui/material/Tooltip";

const NavBar = () => {
    const {userManager} = useOidc();
    const navigate = useNavigate();
    const auth = useAuth();
    const location = useLocation();
    const authDispatch = useAuthDispatch();
    const {clusterName, fetchNodes, loading, daemon} = useFetchDaemonStatus();
    const [breadcrumb, setBreadcrumb] = useState([]);
    const [menuAnchor, setMenuAnchor] = useState(null);
    const objectStatus = useEventStore((state) => state.objectStatus);
    const objectInstanceStatus = useEventStore((state) => state.objectInstanceStatus);
    const instanceMonitor = useEventStore((state) => state.instanceMonitor);
    const [downCount, setDownCount] = useState(0);
    const [warnCount, setWarnCount] = useState(0);

    // Define navigation routes with display names and icons
    const navRoutes = [
        {path: "/cluster", name: "Cluster Overview", icon: <FaHome/>},
        {path: "/namespaces", name: "Namespaces", icon: <FaList/>},
        {path: "/heartbeats", name: "Heartbeats", icon: <FaHeartbeat/>},
        {path: "/nodes", name: "Nodes", icon: <FaServer/>},
        {path: "/storage-pools", name: "Pools", icon: <FaDatabase/>},
        {path: "/network", name: "Networks", icon: <FaNetworkWired/>},
        {path: "/objects", name: "Objects", icon: <FaCubes/>},
        {path: "/whoami", name: "Who Am I", icon: <FaUser/>},
    ];

    const getObjectStatus = useCallback((objectName, objs) => {
        const obj = objs[objectName] || {};
        const rawAvail = obj?.avail;
        const validStatuses = ["up", "down", "warn"];
        const avail = validStatuses.includes(rawAvail) ? rawAvail : "n/a";
        const frozen = obj?.frozen;
        const provisioned = obj?.provisioned;
        let globalExpect = null;
        const nodes = Object.keys(objectInstanceStatus[objectName] || {});
        for (const node of nodes) {
            const monitorKey = `${node}:${objectName}`;
            const monitor = instanceMonitor[monitorKey] || {};
            if (monitor.global_expect && monitor.global_expect !== "none") {
                globalExpect = monitor.global_expect;
                break;
            }
        }
        return {avail, frozen, globalExpect, provisioned};
    }, [objectInstanceStatus, instanceMonitor]);

    const objects = useMemo(
        () => (Object.keys(objectStatus).length ? objectStatus : daemon?.cluster?.object || {}),
        [objectStatus, daemon]
    );

    useEffect(() => {
        let down = 0;
        let warn = 0;
        Object.keys(objects).forEach((key) => {
            const status = getObjectStatus(key, objects);
            if (status.avail === "down") down++;
            if (status.avail === "warn") warn++;
        });
        setDownCount(down);
        setWarnCount(warn);
    }, [objects, getObjectStatus]);

    const getPathBreadcrumbs = useCallback(() => {
        const pathParts = location.pathname.split("/").filter(Boolean);
        const breadcrumbItems = [];
        if (pathParts[0] !== "login" && pathParts.length > 1) {
            if (pathParts[0] === "network" && pathParts.length === 2) {
                breadcrumbItems.push({name: "network", path: "/network"});
                breadcrumbItems.push({name: pathParts[1], path: `/network/${pathParts[1]}`});
            } else if (pathParts[0] === "objects" && pathParts.length === 2) {
                breadcrumbItems.push({name: "Objects", path: "/objects"});
                breadcrumbItems.push({name: pathParts[1], path: `/objects/${pathParts[1]}`});
            } else {
                pathParts.forEach((part, index) => {
                    const fullPath = "/" + pathParts.slice(0, index + 1).join("/");
                    if (part !== "cluster") {
                        breadcrumbItems.push({name: part, path: fullPath});
                    }
                });
            }
        }
        return breadcrumbItems;
    }, [location.pathname]);

    useEffect(() => {
        const fetchClusterData = async () => {
            let retryCount = 0;
            const maxRetries = 3;
            const retryInterval = 1000;

            const tryFetch = async () => {
                const token = auth?.authToken || localStorage.getItem("authToken");

                if (!token) {
                    if (retryCount < maxRetries) {
                        retryCount++;
                        setTimeout(tryFetch, retryInterval);
                        return;
                    }
                    setBreadcrumb([
                        {name: "Cluster", path: "/cluster"},
                        ...getPathBreadcrumbs(),
                    ]);
                    return;
                }

                try {
                    await fetchNodes(token);
                } catch (error) {
                    logger.error("Error while calling fetchNodes:", error.message);
                }
            };

            tryFetch();
        };

        fetchClusterData();
    }, [auth, fetchNodes, getPathBreadcrumbs]);

    useEffect(() => {
        const pathParts = location.pathname.split("/").filter(Boolean);
        const breadcrumbItems = [];

        if (pathParts[0] !== "login") {
            breadcrumbItems.push({
                name: loading ? "Loading..." : (clusterName || "Cluster"),
                path: "/cluster",
            });

            if (pathParts.length > 1 || (pathParts.length === 1 && pathParts[0] !== "cluster")) {
                if (pathParts[0] === "network" && pathParts.length === 2) {
                    breadcrumbItems.push({name: "network", path: "/network"});
                    breadcrumbItems.push({name: pathParts[1], path: `/network/${pathParts[1]}`});
                } else if (pathParts[0] === "objects" && pathParts.length === 2) {
                    breadcrumbItems.push({name: "objects", path: "/objects"});
                    breadcrumbItems.push({name: pathParts[1], path: `/objects/${pathParts[1]}`});
                } else if (pathParts[0] === "network" && pathParts.length === 1) {
                    breadcrumbItems.push({name: "network", path: "/network"});
                } else {
                    pathParts.forEach((part, index) => {
                        const fullPath = "/" + pathParts.slice(0, index + 1).join("/");
                        if (part !== "cluster") {
                            breadcrumbItems.push({name: part, path: fullPath});
                        }
                    });
                }
            }
        }

        setBreadcrumb(breadcrumbItems);
    }, [location.pathname, clusterName, loading]);

    const handleLogout = () => {
        if (auth?.authChoice === "openid") {
            userManager.signoutRedirect();
            userManager.removeUser();
        }
        localStorage.removeItem("authToken");
        authDispatch({type: Logout});
        navigate("/auth-choice");
    };

    const handleMenuOpen = (event) => {
        setMenuAnchor(event.currentTarget);
    };

    const handleMenuClose = () => {
        setMenuAnchor(null);
    };

    const handleMenuItemClick = (path) => {
        navigate(path);
        handleMenuClose();
    };

    return (
        <AppBar position="sticky">
            <Toolbar sx={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                <Box sx={{display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1}}>
                    <Button
                        onClick={handleMenuOpen}
                        aria-label="Open navigation menu"
                        sx={{
                            color: "white",
                            minWidth: "auto",
                            padding: "8px",
                            borderRadius: 2,
                            backgroundColor: "rgba(255, 255, 255, 0.1)",
                            "&:hover": {
                                backgroundColor: "rgba(255, 255, 255, 0.2)",
                            },
                            transition: "background-color 0.3s ease",
                        }}
                    >
                        <FaBars/>
                    </Button>
                    <Typography id="navigation-menu-label" sx={{display: 'none'}}>Navigation menu</Typography>
                    <Menu
                        anchorEl={menuAnchor}
                        open={Boolean(menuAnchor)}
                        onClose={handleMenuClose}
                        aria-labelledby="navigation-menu-label"
                        slotProps={{
                            paper: {
                                sx: {
                                    minWidth: 200,
                                    boxShadow: "0 8px 16px rgba(0,0,0,0.2)",
                                    borderRadius: 2,
                                    backgroundColor: "background.paper",
                                },
                            },
                        }}
                        transformOrigin={{vertical: "top", horizontal: "left"}}
                        anchorOrigin={{vertical: "bottom", horizontal: "left"}}
                        transitionDuration={300}
                    >
                        {navRoutes.map(({path, name, icon}, index) => (
                            <MenuItem
                                key={path}
                                onClick={() => handleMenuItemClick(path)}
                                selected={location.pathname === path}
                                sx={{
                                    py: 1.5,
                                    transition: "background-color 0.2s ease",
                                    "&:hover": {
                                        backgroundColor: "primary.light",
                                        color: "primary.contrastText",
                                    },
                                    "&.Mui-selected": {
                                        backgroundColor: "primary.main",
                                        color: "primary.contrastText",
                                        "&:hover": {
                                            backgroundColor: "primary.dark",
                                        },
                                    },
                                    animation: `slideIn 0.3s ease forwards ${index * 0.05}s`,
                                    "@keyframes slideIn": {
                                        from: {
                                            opacity: 0,
                                            transform: "translateY(-10px)",
                                        },
                                        to: {
                                            opacity: 1,
                                            transform: "translateY(0)",
                                        },
                                    },
                                }}
                            >
                                <ListItemIcon sx={{color: "inherit"}}>{icon}</ListItemIcon>
                                <ListItemText primary={name}/>
                            </MenuItem>
                        ))}
                    </Menu>
                    {breadcrumb.length > 0 &&
                        breadcrumb.map((item, index) => (
                            <Box key={index} sx={{display: "flex", alignItems: "center"}}>
                                <Typography
                                    component={Link}
                                    to={item.path}
                                    aria-label={`Navigate to ${decodeURIComponent(item.name)}`}
                                    sx={{
                                        color: "inherit",
                                        textDecoration: "none",
                                        fontWeight: 500,
                                        fontSize: "1.1rem",
                                        textTransform: "none",
                                        "&:hover": {
                                            textDecoration: "underline",
                                        },
                                    }}
                                >
                                    {decodeURIComponent(item.name)}
                                </Typography>
                                {index < breadcrumb.length - 1 && (
                                    <Typography sx={{mx: 0.5, fontSize: "1.1rem"}}>{">"}</Typography>
                                )}
                            </Box>
                        ))}
                    {(downCount > 0 || warnCount > 0) && (
                        <Box sx={{display: "flex", alignItems: "center", gap: 2, ml: 2}}>
                            {downCount > 0 && (
                                <Tooltip title="Number of down objects">
                                    <Typography
                                        component={Link}
                                        to="/objects?globalState=down"
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 0.5,
                                            color: "inherit",
                                            textDecoration: "none",
                                        }}
                                    >
                                        <FiberManualRecordIcon sx={{color: red[500]}}/>
                                        {downCount}
                                    </Typography>
                                </Tooltip>
                            )}
                            {warnCount > 0 && (
                                <Tooltip title="Number of warn objects">
                                    <Typography
                                        component={Link}
                                        to="/objects?globalState=warn"
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 0.5,
                                            color: "inherit",
                                            textDecoration: "none",
                                        }}
                                    >
                                        <WarningAmberIcon sx={{color: orange[500]}}/>
                                        {warnCount}
                                    </Typography>
                                </Tooltip>
                            )}
                        </Box>
                    )}
                </Box>

                <Box sx={{display: "flex", alignItems: "center", gap: 1}}>
                    <Button
                        component={Link}
                        to="/whoami"
                        startIcon={<FaUser/>}
                        sx={{
                            backgroundColor: "primary.main",
                            color: "white",
                            boxShadow: 3,
                            "&:hover": {
                                backgroundColor: "primary.dark",
                            },
                        }}
                    >
                        Who Am I
                    </Button>
                    <Button
                        startIcon={<FaSignOutAlt/>}
                        onClick={handleLogout}
                        sx={{
                            backgroundColor: "red",
                            color: "white",
                            boxShadow: 3,
                            "&:hover": {
                                backgroundColor: "darkred",
                            },
                        }}
                    >
                        Logout
                    </Button>
                </Box>
            </Toolbar>
        </AppBar>
    );
};

export default NavBar;
