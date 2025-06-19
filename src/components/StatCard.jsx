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
            minHeight: "240px",
            height: "240px",
            display: "flex",
            flexDirection: "column",
            WebkitFlexDirection: "column"
        }}
        onClick={onClick}
        role="button"
        aria-label={`${title} stat card`}
    >
        <Typography
            variant="h6"
            gutterBottom
            aria-label={`${title} title`}
            sx={{
                flexShrink: 0,
                minHeight: "32px"
            }}
        >
            {title}
        </Typography>
        <Box
            sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "80px",
                WebkitFlexDirection: "column",
                WebkitJustifyContent: "center",
                WebkitAlignItems: "center"
            }}
        >
            <Typography
                variant="h3"
                color="primary"
                aria-label={`${title} value`}
                sx={{
                    lineHeight: 1.2,
                    flexShrink: 0
                }}
            >
                {value}
            </Typography>
        </Box>
        {subtitle && (
            <Box
                onClick={(e) => e.stopPropagation()}
                sx={{
                    mt: 1,
                    flexShrink: 0,
                    minHeight: "60px",
                    maxHeight: "100px",
                    overflow: "auto",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    WebkitOverflowScrolling: "touch"
                }}
            >
                <Typography
                    variant="body2"
                    aria-label={`${title} subtitle`}
                    component="div"
                    sx={{
                        overflow: "visible",
                        wordWrap: "break-word"
                    }}
                >
                    {subtitle}
                </Typography>
            </Box>
        )}
    </Paper>
);