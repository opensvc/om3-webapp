import React from 'react';
import {
    Box,
    Typography,
    Tooltip,
    IconButton,
    Popper,
    Paper,
    MenuItem,
    ListItemIcon,
    ListItemText,
    ClickAwayListener,
} from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import {orange, blue, red} from '@mui/material/colors';
import {OBJECT_ACTIONS} from '../constants/actions';
import {isActionAllowedForSelection} from '../utils/objectUtils';
import logger from '../utils/logger.js';

// Detect Safari
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

const HeaderSection = ({
                           decodedObjectName,
                           globalStatus,
                           actionInProgress,
                           objectMenuAnchor,
                           setObjectMenuAnchor,
                           handleObjectActionClick,
                           getObjectStatus,
                           getColor,
                           objectMenuAnchorRef,
                       }) => {
    // Calculate the zoom level
    const getZoomLevel = () => {
        return window.devicePixelRatio || 1;
    };

    // Configuration of Popper props
    const popperProps = () => ({
        placement: "bottom-end",
        disablePortal: isSafari, // Disable portal for Safari
        modifiers: [
            {
                name: "offset",
                options: {
                    offset: () => {
                        const zoomLevel = getZoomLevel();
                        return [0, 8 / zoomLevel]; // Adjust the offset based on the zoom level
                    },
                },
            },
            {
                name: "preventOverflow",
                options: {
                    boundariesElement: "viewport",
                },
            },
            {
                name: "flip",
                options: {
                    enabled: true,
                },
            },
        ],
        sx: {
            zIndex: 1300,
            "& .MuiPaper-root": {
                minWidth: 200,
                boxShadow: "0px 5px 15px rgba(0,0,0,0.2)",
            },
        },
    });

    const isNotProvisioned = globalStatus?.provisioned === "false" || globalStatus?.provisioned === false;

    return (
        globalStatus && (
            <Box
                sx={{
                    p: 1,
                    mb: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <Typography variant="h4" fontWeight="bold">
                    {decodedObjectName}
                </Typography>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 2}}>
                    <Tooltip title={getObjectStatus().avail || 'unknown'}>
                        <FiberManualRecordIcon
                            sx={{color: getColor(getObjectStatus().avail), fontSize: '1.2rem'}}
                        />
                    </Tooltip>
                    {getObjectStatus().avail === 'warn' && (
                        <Tooltip title="warn">
                            <WarningAmberIcon sx={{color: orange[500], fontSize: '1.2rem'}}/>
                        </Tooltip>
                    )}
                    {getObjectStatus().frozen === 'frozen' && (
                        <Tooltip title="frozen">
                            <AcUnitIcon sx={{color: blue[300], fontSize: '1.2rem'}}/>
                        </Tooltip>
                    )}
                    {isNotProvisioned && (
                        <Tooltip title="Not Provisioned">
                            <WarningAmberIcon
                                sx={{color: red[500], fontSize: '1.2rem'}}
                                aria-label="Object is not provisioned"
                            />
                        </Tooltip>
                    )}
                    {getObjectStatus().globalExpect && (
                        <Typography variant="caption">{getObjectStatus().globalExpect}</Typography>
                    )}
                    <IconButton
                        onClick={(e) => {
                            setObjectMenuAnchor(e.currentTarget);
                            logger.info("Object menu opened at:", e.currentTarget.getBoundingClientRect());
                        }}
                        disabled={actionInProgress}
                        aria-label="Object actions"
                        ref={objectMenuAnchorRef}
                    >
                        <Tooltip title="Actions">
                            <MoreVertIcon sx={{fontSize: '1.2rem'}}/>
                        </Tooltip>
                    </IconButton>
                    <Popper
                        open={Boolean(objectMenuAnchor)}
                        anchorEl={objectMenuAnchor}
                        {...popperProps()}
                    >
                        <ClickAwayListener onClickAway={() => setObjectMenuAnchor(null)}>
                            <Paper elevation={3} role="menu">
                                {OBJECT_ACTIONS.map(({name, icon}) => {
                                    const isAllowed = isActionAllowedForSelection(name, [decodedObjectName]);
                                    return (
                                        <MenuItem
                                            key={name}
                                            onClick={() => {
                                                handleObjectActionClick(name);
                                                setObjectMenuAnchor(null);
                                            }}
                                            disabled={!isAllowed || actionInProgress}
                                            sx={{
                                                color: isAllowed ? 'inherit' : 'text.disabled',
                                                '&.Mui-disabled': {
                                                    opacity: 0.5,
                                                },
                                            }}
                                            aria-label={`Object ${name} action`}
                                        >
                                            <ListItemIcon
                                                sx={{minWidth: 40, color: isAllowed ? 'inherit' : 'text.disabled'}}
                                            >
                                                {icon}
                                            </ListItemIcon>
                                            <ListItemText>
                                                {name.charAt(0).toUpperCase() + name.slice(1)}
                                            </ListItemText>
                                        </MenuItem>
                                    );
                                })}
                            </Paper>
                        </ClickAwayListener>
                    </Popper>
                </Box>
            </Box>
        )
    );
};

export default HeaderSection;
