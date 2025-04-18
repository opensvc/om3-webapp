import { Link, useNavigate, useLocation } from "react-router-dom";
import { AppBar, Toolbar, Typography, Button, Box } from "@mui/material";
import { FaSignOutAlt } from "react-icons/fa";

const NavBar = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        localStorage.removeItem("authToken");
        navigate("/login");
    };

    const getBreadcrumbItems = () => {
        const pathParts = location.pathname.split("/").filter(Boolean);
        const breadcrumbItems = [];

        // Si on est sur /cluster seul, juste afficher "Cluster"
        if (pathParts.length === 1 && pathParts[0] === "cluster") {
            breadcrumbItems.push({ name: "Cluster", path: "/cluster" });
        } else {
            // Ajouter "Cluster" comme racine
            breadcrumbItems.push({ name: "Cluster", path: "/cluster" });

            // Ajouter les autres parties (nodes, objects, etc.)
            pathParts.forEach((part, index) => {
                const fullPath = "/" + pathParts.slice(0, index + 1).join("/");
                // Skip the 'cluster' part, it's already added
                if (part !== "cluster") {
                    breadcrumbItems.push({ name: part, path: fullPath });
                }
            });
        }

        return breadcrumbItems;
    };

    const breadcrumb = getBreadcrumbItems();

    return (
        <AppBar position="sticky">
            <Toolbar sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {/* Breadcrumb */}
                <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.5 }}>
                    {breadcrumb.map((item, index) => (
                        <Box key={index} sx={{ display: "flex", alignItems: "center" }}>
                            <Typography
                                component={Link}
                                to={item.path}
                                sx={{
                                    color: "inherit",
                                    textDecoration: "none",
                                    fontWeight: 500,
                                    fontSize: "1.1rem",
                                    textTransform: "capitalize",
                                    '&:hover': {
                                        textDecoration: "underline"
                                    }
                                }}
                            >
                                {item.name}
                            </Typography>
                            {index < breadcrumb.length - 1 && (
                                <Typography sx={{ mx: 0.5, fontSize: "1.1rem" }}>{">"}</Typography>
                            )}
                        </Box>
                    ))}
                </Box>

                {/* Nav buttons */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Button color="inherit" component={Link} to="/cluster">Cluster</Button>
                    <Button color="inherit" component={Link} to="/nodes">Nodes</Button>
                    <Button color="inherit" component={Link} to="/objects">Objects</Button>
                    <Button
                        startIcon={<FaSignOutAlt />}
                        onClick={handleLogout}
                        sx={{
                            backgroundColor: 'red',
                            color: 'white',
                            boxShadow: 3,
                            '&:hover': {
                                backgroundColor: 'darkred',
                            }
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
