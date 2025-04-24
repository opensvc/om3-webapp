import {Paper, Typography} from "@mui/material";

export const StatCard = ({title, value, subtitle, onClick}) => (
    <Paper
        elevation={3}
        sx={{
            p: 3,
            borderRadius: 2,
            textAlign: "center",
            cursor: "pointer",
            "&:hover": {
                boxShadow: 6,
                transition: "box-shadow 0.3s ease-in-out"
            }
        }}
        onClick={onClick}
    >
        <Typography variant="h6" gutterBottom>{title}</Typography>
        <Typography variant="h3" color="primary">{value}</Typography>
        {subtitle && (
            <Typography variant="body2" sx={{mt: 1}}>{subtitle}</Typography>
        )}
    </Paper>
);
