import React, {useState, useEffect, useMemo} from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
} from '@mui/material';
import {
    FreezeDialog,
    StopDialog,
    UnprovisionDialog,
    PurgeDialog,
    DeleteDialog,
    SwitchDialog,
    GivebackDialog
} from './ActionDialogs';

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
                             }) => {
    const [dialogState, setDialogState] = useState({
        freeze: false,
        stop: false,
        unprovision: false,
        purge: false,
        delete: false,
        switch: false,
        giveback: false,
        simpleConfirm: false,
    });

    const [checkboxState, setCheckboxState] = useState({
        freeze: false,
        stop: false,
        unprovision: {dataLoss: false, serviceInterruption: false, clusterwide: false},
        purge: {dataLoss: false, configLoss: false, serviceInterruption: false},
        delete: {configLoss: false, clusterwide: false},
        switch: false,
        giveback: false,
        simpleConfirm: false,
    });

    const dialogConfig = useMemo(() => ({
        freeze: {
            component: FreezeDialog,
            props: {
                open: dialogState.freeze,
                onClose: () => {
                    setDialogState((prev) => ({...prev, freeze: false}));
                    if (onClose) onClose();
                },
                onConfirm: () => {
                    handleConfirm(pendingAction?.action);
                    setDialogState((prev) => ({...prev, freeze: false}));
                    if (onClose) onClose();
                },
                checked: checkboxState.freeze,
                setChecked: (value) => {
                    setCheckboxState((prev) => ({...prev, freeze: value}));
                },
                disabled: !checkboxState.freeze,
                cancelDisabled: false,
                pendingAction,
                target,
            },
        },
        stop: {
            component: StopDialog,
            props: {
                open: dialogState.stop,
                onClose: () => {
                    setDialogState((prev) => ({...prev, stop: false}));
                    if (onClose) onClose();
                },
                onConfirm: () => {
                    handleConfirm(pendingAction?.action);
                    setDialogState((prev) => ({...prev, stop: false}));
                    if (onClose) onClose();
                },
                checked: checkboxState.stop,
                setChecked: (value) => {
                    setCheckboxState((prev) => ({...prev, stop: value}));
                },
                disabled: !checkboxState.stop,
                cancelDisabled: false,
                pendingAction,
                target,
            },
        },
        unprovision: {
            component: UnprovisionDialog,
            props: {
                open: dialogState.unprovision,
                onClose: () => {
                    setDialogState((prev) => ({...prev, unprovision: false}));
                    if (onClose) onClose();
                },
                onConfirm: () => {
                    handleConfirm(pendingAction?.action);
                    setDialogState((prev) => ({...prev, unprovision: false}));
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
                        console.error('setCheckboxes for unprovision received invalid value:', value);
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
                disabled: !checkboxState.unprovision.dataLoss,
                cancelDisabled: false,
                pendingAction,
                target,
            },
        },
        purge: {
            component: PurgeDialog,
            props: {
                open: dialogState.purge,
                onClose: () => {
                    setDialogState((prev) => ({...prev, purge: false}));
                    if (onClose) onClose();
                },
                onConfirm: () => {
                    handleConfirm(pendingAction?.action);
                    setDialogState((prev) => ({...prev, purge: false}));
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
                        console.error('setCheckboxes for purge received invalid value:', value);
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
                disabled: !checkboxState.purge.dataLoss,
                cancelDisabled: false,
                pendingAction,
                target,
            },
        },
        delete: {
            component: DeleteDialog,
            props: {
                open: dialogState.delete,
                onClose: () => {
                    setDialogState((prev) => ({...prev, delete: false}));
                    if (onClose) onClose();
                },
                onConfirm: () => {
                    handleConfirm(pendingAction?.action);
                    setDialogState((prev) => ({...prev, delete: false}));
                    if (onClose) onClose();
                },
                checkboxes: checkboxState.delete,
                setCheckboxes: (value) => {
                    let updates;
                    if (typeof value === 'function') {
                        updates = value(checkboxState.delete);
                    } else if (typeof value === 'object' && value !== null) {
                        updates = value;
                    } else {
                        console.error('setCheckboxes for delete received invalid value:', value);
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
                        delete: {...prev.delete, ...validUpdates},
                    }));
                },
                disabled: !checkboxState.delete.configLoss,
                cancelDisabled: false,
                pendingAction,
                target,
            },
        },
        switch: {
            component: SwitchDialog,
            props: {
                open: dialogState.switch,
                onClose: () => {
                    setDialogState((prev) => ({...prev, switch: false}));
                    if (onClose) onClose();
                },
                onConfirm: () => {
                    handleConfirm(pendingAction?.action);
                    setDialogState((prev) => ({...prev, switch: false}));
                    if (onClose) onClose();
                },
                checked: checkboxState.switch,
                setChecked: (value) => {
                    setCheckboxState((prev) => ({...prev, switch: value}));
                },
                disabled: !checkboxState.switch,
                cancelDisabled: false,
                pendingAction,
                target,
            },
        },
        giveback: {
            component: GivebackDialog,
            props: {
                open: dialogState.giveback,
                onClose: () => {
                    setDialogState((prev) => ({...prev, giveback: false}));
                    if (onClose) onClose();
                },
                onConfirm: () => {
                    handleConfirm(pendingAction?.action);
                    setDialogState((prev) => ({...prev, giveback: false}));
                    if (onClose) onClose();
                },
                checked: checkboxState.giveback,
                setChecked: (value) => {
                    setCheckboxState((prev) => ({...prev, giveback: value}));
                },
                disabled: !checkboxState.giveback,
                cancelDisabled: false,
                pendingAction,
                target,
            },
        },
        simpleConfirm: {
            component: SimpleConfirmDialog,
            props: {
                open: dialogState.simpleConfirm,
                onClose: () => {
                    setDialogState((prev) => ({...prev, simpleConfirm: false}));
                    if (onClose) onClose();
                },
                onConfirm: () => {
                    handleConfirm(pendingAction?.action);
                    setDialogState((prev) => ({...prev, simpleConfirm: false}));
                    if (onClose) onClose();
                },
                action: pendingAction?.action,
                target,
                disabled: false,
                cancelDisabled: false,
            },
        },
    }), [dialogState, checkboxState, handleConfirm, pendingAction, target, onClose]);

    const initializeDialog = (action) => {
        const actions = {
            freeze: () => {
                setDialogState((prev) => ({...prev, freeze: true}));
                setCheckboxState((prev) => ({...prev, freeze: false}));
            },
            stop: () => {
                setDialogState((prev) => ({...prev, stop: true}));
                setCheckboxState((prev) => ({...prev, stop: false}));
            },
            unprovision: () => {
                setDialogState((prev) => ({...prev, unprovision: true}));
                setCheckboxState((prev) => ({
                    ...prev,
                    unprovision: {dataLoss: false, serviceInterruption: false, clusterwide: false},
                }));
            },
            purge: () => {
                setDialogState((prev) => ({...prev, purge: true}));
                setCheckboxState((prev) => ({
                    ...prev,
                    purge: {dataLoss: false, configLoss: false, serviceInterruption: false},
                }));
            },
            delete: () => {
                setDialogState((prev) => ({...prev, delete: true}));
                setCheckboxState((prev) => ({
                    ...prev,
                    delete: {configLoss: false, clusterwide: false},
                }));
            },
            switch: () => {
                setDialogState((prev) => ({...prev, switch: true}));
                setCheckboxState((prev) => ({...prev, switch: false}));
            },
            giveback: () => {
                setDialogState((prev) => ({...prev, giveback: true}));
                setCheckboxState((prev) => ({...prev, giveback: false}));
            },
            simpleConfirm: () => {
                setDialogState((prev) => ({...prev, simpleConfirm: true}));
                setCheckboxState((prev) => ({...prev, simpleConfirm: false}));
            },
        };

        if (action in actions) {
            actions[action]();
        } else {
            actions.simpleConfirm();
        }
    };

    useEffect(() => {
        // If pendingAction is null, call onClose but don't log warning
        if (pendingAction === null) {
            if (onClose) onClose();
            return;
        }

        // Log warning for invalid non-null pendingAction in development
        if (!pendingAction?.action || typeof pendingAction.action !== 'string') {
            if (process.env.NODE_ENV !== 'production') {
                console.warn('Invalid pendingAction provided:', pendingAction);
            }
            if (onClose) onClose();
            return;
        }

        const action = pendingAction.action.toLowerCase();
        if (supportedActions.includes(action)) {
            initializeDialog(action);
        } else {
            if (process.env.NODE_ENV !== 'production') {
                console.warn(`Unsupported action: ${action}`);
            }
            if (onClose) onClose();
        }
    }, [pendingAction, supportedActions, onClose]);

    return (
        <>
            {Object.entries(dialogConfig).map(([key, {component: Component, props}]) => (
                <Component key={key} {...props} />
            ))}
        </>
    );
};

export default ActionDialogManager;
