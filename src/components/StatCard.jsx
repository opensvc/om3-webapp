import React from 'react';
import {Paper, Typography, Box} from "@mui/material";

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
            },
            minHeight: "200px",
            display: "flex",
            flexDirection: "column"
        }}
        onClick={onClick}
        role="button"
        aria-label={`${title} stat card`}
    >
        <Typography
            variant="h6"
            gutterBottom
            aria-label={`${title} title`}
        >
            {title}
        </Typography>
        <Box
            sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center"
            }}
        >
            <Typography
                variant="h3"
                color="primary"
                aria-label={`${title} value`}
            >
                {value}
            </Typography>
        </Box>
        {subtitle && (
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    marginTop: 8,
                    maxHeight: "80px",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                }}
            >
                <Typography
                    variant="body2"
                    aria-label={`${title} subtitle`}
                    sx={{
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden"
                    }}
                >
                    {subtitle}
                </Typography>
            </div>
        )}
    </Paper>
);