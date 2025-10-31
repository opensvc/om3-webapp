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
    GivebackDialog,
    ConsoleDialog,
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
                checked: checkboxState.console,
                setChecked: (value) => {
                    setCheckboxState((prev) => ({...prev, console: value}));
                },
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
    }), [checkboxState, handleConfirm, pendingAction, target, onClose]);
    useEffect(() => {
        if (pendingAction === null) {
            if (onClose) onClose();
            return;
        }
        if (!pendingAction?.action || typeof pendingAction.action !== 'string') {
            if (process.env.NODE_ENV !== 'production') {
                console.warn('Invalid pendingAction provided:', pendingAction);
            }
            if (onClose) onClose();
            return;
        }
        const action = pendingAction.action.toLowerCase();
        if (!supportedActions.includes(action)) {
            if (process.env.NODE_ENV !== 'production') {
                console.warn(`Unsupported action: ${action}`);
            }
            if (onClose) onClose();
            return;
        }
        // Initialize checkbox state for the action
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
            console: () => setCheckboxState((prev) => ({...prev, console: false})),
            simpleConfirm: () => setCheckboxState((prev) => ({...prev, simpleConfirm: false})),
        };
        if (initCheckbox[action]) {
            initCheckbox[action]();
        } else {
            initCheckbox.simpleConfirm();
        }
    }, [pendingAction, supportedActions, onClose]);
    if (!pendingAction || !pendingAction.action) return null;
    const action = pendingAction.action.toLowerCase();
    const config = dialogConfig[action] || dialogConfig.simpleConfirm;
    if (!config) return null;
    const Component = config.component;
    const props = {...config.props, open: true, disabled: false};
    return <Component key={action} {...props} />;
};

export default ActionDialogManager;
