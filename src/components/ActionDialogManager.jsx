import React, {useState, useEffect, useMemo} from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    TextField,
    Box,
} from '@mui/material';
import {
    FreezeDialog,
    StopDialog,
    UnprovisionDialog,
    PurgeDialog,
    DeleteDialog,
    SwitchDialog,
    GivebackDialog,
} from './ActionDialogs';
import logger from '../utils/logger.js';

// ConsoleDialog component for ActionDialogManager
const ConsoleDialog = ({
                           open,
                           onClose,
                           onConfirm,
                           seats,
                           setSeats,
                           greetTimeout,
                           setGreetTimeout,
                           disabled,
                           pendingAction
                       }) => (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Open Console</DialogTitle>
        <DialogContent>
            <Typography variant="body1" sx={{mb: 2}}>
                This will open a terminal console for the selected resource.
            </Typography>
            {pendingAction?.rid && (
                <Typography variant="body2" color="primary" sx={{mb: 2, fontWeight: 'bold'}}>
                    Resource: {pendingAction.rid}
                </Typography>
            )}
            {pendingAction?.node && (
                <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                    Node: {pendingAction.node}
                </Typography>
            )}
            <Typography variant="body2" sx={{mb: 3}}>
                The console session will open in a new browser tab and provide shell access to the container.
            </Typography>
            <Box sx={{mb: 2}}>
                <TextField
                    autoFocus
                    margin="dense"
                    label="Number of Seats"
                    type="number"
                    fullWidth
                    variant="outlined"
                    value={seats}
                    onChange={(e) => setSeats(Math.max(1, parseInt(e.target.value) || 1))}
                    disabled={disabled}
                    helperText="Number of simultaneous users allowed in the console"
                />
            </Box>
            <TextField
                margin="dense"
                label="Greet Timeout"
                type="text"
                fullWidth
                variant="outlined"
                value={greetTimeout}
                onChange={(e) => setGreetTimeout(e.target.value)}
                disabled={disabled}
                helperText="Time to wait for console connection (e.g., 5s, 10s)"
            />
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose} disabled={disabled}>
                Cancel
            </Button>
            <Button
                variant="contained"
                color="primary"
                onClick={onConfirm}
                disabled={disabled}
            >
                Open Console
            </Button>
        </DialogActions>
    </Dialog>
);
const SimpleConfirmDialog = ({open, onClose, onConfirm, action, target, disabled, cancelDisabled}) => {
    const dialogTitle = typeof action === 'string' && action
        ? `Confirm ${action.charAt(0).toUpperCase() + action.slice(1)}`
        : 'Confirm Action';
    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogContent>
                <Typography variant="body1">
                    Are you sure you want
                    to {typeof action === 'string' && action ? action : 'perform this action'} on {target}?
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={cancelDisabled}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={onConfirm}
                    disabled={disabled}
                >
                    Confirm
                </Button>
            </DialogActions>
        </Dialog>
    );
};
const ActionDialogManager = ({
                                 pendingAction,
                                 handleConfirm,
                                 target,
                                 supportedActions = [],
                                 onClose,
                                 seats = 1,
                                 setSeats = () => {
                                 },
                                 greetTimeout = "5s",
                                 setGreetTimeout = () => {
                                 },
                             }) => {
    const [checkboxState, setCheckboxState] = useState({
        freeze: false,
        stop: false,
        unprovision: {dataLoss: false, serviceInterruption: false, clusterwide: false},
        purge: {dataLoss: false, configLoss: false, serviceInterruption: false},
        "delete": {configLoss: false, clusterwide: false},
        "switch": false,
        giveback: false,
        console: false,
        simpleConfirm: false,
    });
    const [lastAction, setLastAction] = useState(null);
    const dialogConfig = useMemo(() => ({
        freeze: {
            component: FreezeDialog,
            props: {
                onClose: () => {
                    if (onClose) onClose();
                },
                onConfirm: () => {
                    handleConfirm(pendingAction?.action);
                    if (onClose) onClose();
                },
                checked: checkboxState.freeze,
                setChecked: (value) => {
                    setCheckboxState((prev) => ({...prev, freeze: value}));
                },
                pendingAction,
                target,
            },
        },
        stop: {
            component: StopDialog,
            props: {
                onClose: () => {
                    if (onClose) onClose();
                },
                onConfirm: () => {
                    handleConfirm(pendingAction?.action);
                    if (onClose) onClose();
                },
                checked: checkboxState.stop,
                setChecked: (value) => {
                    setCheckboxState((prev) => ({...prev, stop: value}));
                },
                pendingAction,
                target,
            },
        },
        unprovision: {
            component: UnprovisionDialog,
            props: {
                onClose: () => {
                    if (onClose) onClose();
                },
                onConfirm: () => {
                    handleConfirm(pendingAction?.action);
                    if (onClose) onClose();
                },
                checkboxes: checkboxState.unprovision,
                setCheckboxes: (value) => {
                    let updates;
                    if (typeof value === 'function') {
                        updates = value(checkboxState.unprovision);
                    } else if (typeof value === 'object' && value !== null) {
                        updates = value;
                    } else {
                        logger.error('setCheckboxes for unprovision received invalid value:', value);
                        return;
                    }
                    const validKeys = ['dataLoss', 'serviceInterruption', 'clusterwide'];
                    const validUpdates = Object.keys(updates).reduce((acc, key) => {
                        if (validKeys.includes(key)) {
                            acc[key] = updates[key];
                        }
                        return acc;
                    }, {});
                    setCheckboxState((prev) => ({
                        ...prev,
                        unprovision: {...prev.unprovision, ...validUpdates},
                    }));
                },
                pendingAction,
                target,
            },
        },
        purge: {
            component: PurgeDialog,
            props: {
                onClose: () => {
                    if (onClose) onClose();
                },
                onConfirm: () => {
                    handleConfirm(pendingAction?.action);
                    if (onClose) onClose();
                },
                checkboxes: checkboxState.purge,
                setCheckboxes: (value) => {
                    let updates;
                    if (typeof value === 'function') {
                        updates = value(checkboxState.purge);
                    } else if (typeof value === 'object' && value !== null) {
                        updates = value;
                    } else {
                        logger.error('setCheckboxes for purge received invalid value:', value);
                        return;
                    }
                    const validKeys = ['dataLoss', 'configLoss', 'serviceInterruption'];
                    const validUpdates = Object.keys(updates).reduce((acc, key) => {
                        if (validKeys.includes(key)) {
                            acc[key] = updates[key];
                        }
                        return acc;
                    }, {});
                    setCheckboxState((prev) => ({
                        ...prev,
                        purge: {...prev.purge, ...validUpdates},
                    }));
                },
                pendingAction,
                target,
            },
        },
        "delete": {
            component: DeleteDialog,
            props: {
                onClose: () => {
                    if (onClose) onClose();
                },
                onConfirm: () => {
                    handleConfirm(pendingAction?.action);
                    if (onClose) onClose();
                },
                checkboxes: checkboxState["delete"],
                setCheckboxes: (value) => {
                    let updates;
                    if (typeof value === 'function') {
                        updates = value(checkboxState["delete"]);
                    } else if (typeof value === 'object' && value !== null) {
                        updates = value;
                    } else {
                        logger.error('setCheckboxes for delete received invalid value:', value);
                        return;
                    }
                    const validKeys = ['configLoss', 'clusterwide'];
                    const validUpdates = Object.keys(updates).reduce((acc, key) => {
                        if (validKeys.includes(key)) {
                            acc[key] = updates[key];
                        }
                        return acc;
                    }, {});
                    setCheckboxState((prev) => ({
                        ...prev,
                        "delete": {...prev["delete"], ...validUpdates},
                    }));
                },
                pendingAction,
                target,
            },
        },
        "switch": {
            component: SwitchDialog,
            props: {
                onClose: () => {
                    if (onClose) onClose();
                },
                onConfirm: () => {
                    handleConfirm(pendingAction?.action);
                    if (onClose) onClose();
                },
                checked: checkboxState["switch"],
                setChecked: (value) => {
                    setCheckboxState((prev) => ({...prev, "switch": value}));
                },
                pendingAction,
                target,
            },
        },
        giveback: {
            component: GivebackDialog,
            props: {
                onClose: () => {
                    if (onClose) onClose();
                },
                onConfirm: () => {
                    handleConfirm(pendingAction?.action);
                    if (onClose) onClose();
                },
                checked: checkboxState.giveback,
                setChecked: (value) => {
                    setCheckboxState((prev) => ({...prev, giveback: value}));
                },
                pendingAction,
                target,
            },
        },
        console: {
            component: ConsoleDialog,
            props: {
                onClose: () => {
                    if (onClose) onClose();
                },
                onConfirm: () => {
                    handleConfirm(pendingAction?.action);
                    if (onClose) onClose();
                },
                seats,
                setSeats,
                greetTimeout,
                setGreetTimeout,
                pendingAction,
                target,
            },
        },
        simpleConfirm: {
            component: SimpleConfirmDialog,
            props: {
                onClose: () => {
                    if (onClose) onClose();
                },
                onConfirm: () => {
                    handleConfirm(pendingAction?.action);
                    if (onClose) onClose();
                },
                action: pendingAction?.action,
                target,
                disabled: false,
                cancelDisabled: false,
            },
        },
    }), [checkboxState, handleConfirm, pendingAction, target, onClose, seats, setSeats, greetTimeout, setGreetTimeout]);
    useEffect(() => {
        if (pendingAction === null) {
            setLastAction(null);
            if (onClose) onClose();
            return;
        }
        if (!pendingAction?.action || typeof pendingAction.action !== 'string') {
            if (process.env.NODE_ENV !== 'production') {
                logger.warn('Invalid pendingAction provided:', pendingAction);
            }
            if (onClose) onClose();
            return;
        }
        const action = pendingAction.action.toLowerCase();
        if (!supportedActions.includes(action)) {
            if (process.env.NODE_ENV !== 'production') {
                logger.warn(`Unsupported action: ${action}`);
            }
            if (onClose) onClose();
            return;
        }
        // Initialize checkbox state for the action only if the action has changed
        if (action !== lastAction) {
            const initCheckbox = {
                freeze: () => setCheckboxState((prev) => ({...prev, freeze: false})),
                stop: () => setCheckboxState((prev) => ({...prev, stop: false})),
                unprovision: () => setCheckboxState((prev) => ({
                    ...prev,
                    unprovision: {dataLoss: false, serviceInterruption: false, clusterwide: false},
                })),
                purge: () => setCheckboxState((prev) => ({
                    ...prev,
                    purge: {dataLoss: false, configLoss: false, serviceInterruption: false},
                })),
                "delete": () => setCheckboxState((prev) => ({
                    ...prev,
                    "delete": {configLoss: false, clusterwide: false},
                })),
                "switch": () => setCheckboxState((prev) => ({...prev, "switch": false})),
                giveback: () => setCheckboxState((prev) => ({...prev, giveback: false})),
                simpleConfirm: () => setCheckboxState((prev) => ({...prev, simpleConfirm: false})),
            };
            if (initCheckbox[action]) {
                initCheckbox[action]();
            } else {
                initCheckbox.simpleConfirm();
            }
            setLastAction(action);
        }
    }, [pendingAction, supportedActions, onClose, lastAction]);
    if (!pendingAction || !pendingAction.action) return null;
    const action = pendingAction.action.toLowerCase();
    const config = dialogConfig[action] || dialogConfig.simpleConfirm;
    if (!config) return null;
    const Component = config.component;
    const props = {...config.props, open: true, disabled: false};
    return <Component key={action} {...props} />;
};

export default ActionDialogManager;
