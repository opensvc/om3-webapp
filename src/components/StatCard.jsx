import React from 'react';
import {Paper, Typography, Box} from "@mui/material";

export const StatCard = ({title, value, subtitle, onClick, dynamicHeight = false}) => (
    <Paper
        elevation={3}
        sx={{
            p: 3,
            height: dynamicHeight ? 'auto' : '240px',
            minHeight: '240px',
            display: 'flex',
            flexDirection: 'column',
            cursor: 'pointer',
            transition: 'box-shadow 0.3s',
            '&:hover': {boxShadow: 6},
            borderRadius: 2,
            textAlign: 'center'
        }}
        onClick={onClick}
    >
        <Typography variant="h6" gutterBottom>{title}</Typography>
        <Box sx={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
            <Typography variant="h3" color="primary">{value}</Typography>
        </Box>
        {subtitle && (
            <Box onClick={(e) => e.stopPropagation()}>
                {typeof subtitle === 'string' ? (
                    <Typography variant="body2">{subtitle}</Typography>
                ) : (
                    subtitle
                )}
            </Box>
        )}
    </Paper>
);
