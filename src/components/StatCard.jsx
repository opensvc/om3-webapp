import React, {memo} from 'react';
import {Paper, Typography, Box, CircularProgress} from "@mui/material";

const StatCard = memo(({title, value, subtitle, onClick, dynamicHeight = false, isLoading = false}) => {
    const handleClick = (e) => {
        if (onClick && !isLoading) onClick(e);
    };

    return (
        <Paper
            elevation={3}
            sx={{
                p: 3,
                height: dynamicHeight ? 'auto' : '240px',
                minHeight: '240px',
                display: 'flex',
                flexDirection: 'column',
                cursor: onClick && !isLoading ? 'pointer' : 'default',
                transition: 'box-shadow 0.3s, opacity 0.3s',
                '&:hover': onClick && !isLoading ? {boxShadow: 6} : {},
                borderRadius: 2,
                textAlign: 'center',
                opacity: isLoading ? 0.7 : 1,
                position: 'relative'
            }}
            onClick={handleClick}
        >
            {isLoading && (
                <Box sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8
                }}>
                    <CircularProgress size={24}/>
                </Box>
            )}
            <Typography variant="h6" gutterBottom>{title}</Typography>
            <Box sx={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
                {isLoading ? (
                    <CircularProgress sx={{alignSelf: 'center'}}/>
                ) : (
                    <Typography variant="h3" color="primary">{value}</Typography>
                )}
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
});

export default StatCard;
