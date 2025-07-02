import React from 'react';
import {
    Box,
    Typography,
    Tooltip,
    IconButton,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
} from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import {orange, blue} from '@mui/material/colors';
import {OBJECT_ACTIONS} from '../constants/actions';
import {isActionAllowedForSelection} from '../utils/objectUtils';

const HeaderSection = ({
                           decodedObjectName,
                           globalStatus,
                           actionInProgress,
                           objectMenuAnchor,
                           setObjectMenuAnchor,
                           setPendingAction,
                           setConfirmDialogOpen,
                           setStopDialogOpen,
                           setUnprovisionDialogOpen,
                           setPurgeDialogOpen,
                           setDeleteDialogOpen,
                           setSimpleDialogOpen,
                           setCheckboxes,
                           setStopCheckbox,
                           setUnprovisionChecked,
                           setPurgeCheckboxes,
                           setDeleteCheckboxes,
                           setSwitchDialogOpen,
                           setSwitchCheckbox,
                           setGivebackDialogOpen,
                           setGivebackCheckbox,
                           getObjectStatus,
                           getColor,
                       }) => {
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
                    {getObjectStatus().globalExpect && (
                        <Typography variant="caption">{getObjectStatus().globalExpect}</Typography>
                    )}
                    <IconButton
                        onClick={(e) => setObjectMenuAnchor(e.currentTarget)}
                        disabled={actionInProgress}
                        aria-label="Object actions"
                    >
                        <Tooltip title="Actions">
                            <MoreVertIcon sx={{fontSize: '1.2rem'}}/>
                        </Tooltip>
                    </IconButton>
                    <Menu
                        anchorEl={objectMenuAnchor}
                        open={Boolean(objectMenuAnchor)}
                        onClose={() => setObjectMenuAnchor(null)}
                    >
                        {OBJECT_ACTIONS.map(({name, icon}) => {
                            const isAllowed = isActionAllowedForSelection(name, [decodedObjectName]);
                            return (
                                <MenuItem
                                    key={name}
                                    onClick={() => {
                                        setPendingAction({action: name});
                                        if (name === 'freeze') {
                                            setCheckboxes({failover: false});
                                            setConfirmDialogOpen(true);
                                        } else if (name === 'stop') {
                                            setStopCheckbox(false);
                                            setStopDialogOpen(true);
                                        } else if (name === 'unprovision') {
                                            setUnprovisionChecked(false);
                                            setUnprovisionDialogOpen(true);
                                        } else if (name === 'purge') {
                                            setPurgeCheckboxes({
                                                dataLoss: false,
                                                configLoss: false,
                                                serviceInterruption: false,
                                            });
                                            setPurgeDialogOpen(true);
                                        } else if (name === 'delete') {
                                            setDeleteCheckboxes({
                                                configLoss: false,
                                                clusterwide: false,
                                            });
                                            setDeleteDialogOpen(true);
                                        } else if (name === 'switch') {
                                            setSwitchCheckbox(false);
                                            setSwitchDialogOpen(true);
                                        } else if (name === 'giveback') {
                                            setGivebackCheckbox(false);
                                            setGivebackDialogOpen(true);
                                        } else {
                                            setSimpleDialogOpen(true);
                                        }
                                        setObjectMenuAnchor(null);
                                    }}
                                    disabled={!isAllowed || actionInProgress}
                                    sx={{
                                        color: isAllowed ? 'inherit' : 'text.disabled',
                                        '&.Mui-disabled': {
                                            opacity: 0.5,
                                        },
                                    }}
                                >
                                    <ListItemIcon
                                        sx={{minWidth: 40, color: isAllowed ? 'inherit' : 'text.disabled'}}
                                    >
                                        {icon}
                                    </ListItemIcon>
                                    <ListItemText>{name.charAt(0).toUpperCase() + name.slice(1)}</ListItemText>
                                </MenuItem>
                            );
                        })}
                    </Menu>
                </Box>
            </Box>
        )
    );
};

export default HeaderSection;
