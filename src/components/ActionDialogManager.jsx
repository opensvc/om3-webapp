import React, {useState, useEffect} from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Checkbox,
    FormControlLabel,
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
    // Fallback title if action is undefined or not a string
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

    const dialogConfig = {
        freeze: {
            openDialog: () => setDialogState((prev) => ({...prev, freeze: true})),
            initState: () => setCheckboxState((prev) => ({...prev, freeze: false})),
            component: FreezeDialog,
            props: {
                open: dialogState.freeze,
                onClose: () => {
                    console.log('Closing FreezeDialog');
                    setDialogState((prev) => ({...prev, freeze: false}));
                    if (onClose) onClose();
                },
                onConfirm: () => {
                    console.log('Confirming freeze');
                    handleConfirm(pendingAction?.action);
                    setDialogState((prev) => ({...prev, freeze: false}));
                    if (onClose) onClose();
                },
                checked: checkboxState.freeze,
                setChecked: (value) => {
                    console.log('Updating freeze checkbox:', value);
                    setCheckboxState((prev) => ({...prev, freeze: value}));
                },
                disabled: !checkboxState.freeze,
                cancelDisabled: false,
                pendingAction,
                target,
            },
        },
        stop: {
            openDialog: () => setDialogState((prev) => ({...prev, stop: true})),
            initState: () => setCheckboxState((prev) => ({...prev, stop: false})),
            component: StopDialog,
            props: {
                open: dialogState.stop,
                onClose: () => {
                    console.log('Closing StopDialog');
                    setDialogState((prev) => ({...prev, stop: false}));
                    if (onClose) onClose();
                },
                onConfirm: () => {
                    console.log('Confirming stop');
                    handleConfirm(pendingAction?.action);
                    setDialogState((prev) => ({...prev, stop: false}));
                    if (onClose) onClose();
                },
                checked: checkboxState.stop,
                setChecked: (value) => {
                    console.log('Updating stop checkbox:', value);
                    setCheckboxState((prev) => ({...prev, stop: value}));
                },
                disabled: !checkboxState.stop,
                cancelDisabled: false,
                pendingAction,
                target,
            },
        },
        unprovision: {
            openDialog: () => {
                console.log('Opening UnprovisionDialog');
                setDialogState((prev) => ({...prev, unprovision: true}));
            },
            initState: () => {
                console.log('Initializing unprovision checkbox state');
                setCheckboxState((prev) => ({
                    ...prev,
                    unprovision: {dataLoss: false, serviceInterruption: false, clusterwide: false},
                }));
            },
            component: UnprovisionDialog,
            props: {
                open: dialogState.unprovision,
                onClose: () => {
                    console.log('Closing UnprovisionDialog');
                    setDialogState((prev) => ({...prev, unprovision: false}));
                    if (onClose) onClose();
                },
                onConfirm: () => {
                    console.log('Confirming unprovision with checkboxes:', checkboxState.unprovision);
                    handleConfirm(pendingAction?.action);
                    setDialogState((prev) => ({...prev, unprovision: false}));
                    if (onClose) onClose();
                },
                checkboxes: checkboxState.unprovision,
                setCheckboxes: (value) => {
                    console.log('Updating unprovision checkboxes:', value);
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
            openDialog: () => {
                console.log('Opening PurgeDialog');
                setDialogState((prev) => ({...prev, purge: true}));
            },
            initState: () => {
                console.log('Initializing purge checkbox state');
                setCheckboxState((prev) => ({
                    ...prev,
                    purge: {dataLoss: false, configLoss: false, serviceInterruption: false},
                }));
            },
            component: PurgeDialog,
            props: {
                open: dialogState.purge,
                onClose: () => {
                    console.log('Closing PurgeDialog');
                    setDialogState((prev) => ({...prev, purge: false}));
                    if (onClose) onClose();
                },
                onConfirm: () => {
                    console.log('Confirming purge with checkboxes:', checkboxState.purge);
                    handleConfirm(pendingAction?.action);
                    setDialogState((prev) => ({...prev, purge: false}));
                    if (onClose) onClose();
                },
                checkboxes: checkboxState.purge,
                setCheckboxes: (value) => {
                    console.log('Updating purge checkboxes:', value);
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
            openDialog: () => {
                console.log('Opening DeleteDialog');
                setDialogState((prev) => ({...prev, delete: true}));
            },
            initState: () => {
                console.log('Initializing delete checkbox state');
                setCheckboxState((prev) => ({
                    ...prev,
                    delete: {configLoss: false, clusterwide: false},
                }));
            },
            component: DeleteDialog,
            props: {
                open: dialogState.delete,
                onClose: () => {
                    console.log('Closing DeleteDialog');
                    setDialogState((prev) => ({...prev, delete: false}));
                    if (onClose) onClose();
                },
                onConfirm: () => {
                    console.log('Confirming delete with checkboxes:', checkboxState.delete);
                    handleConfirm(pendingAction?.action);
                    setDialogState((prev) => ({...prev, delete: false}));
                    if (onClose) onClose();
                },
                checkboxes: checkboxState.delete,
                setCheckboxes: (value) => {
                    console.log('Updating delete checkboxes:', value);
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
            openDialog: () => setDialogState((prev) => ({...prev, switch: true})),
            initState: () => setCheckboxState((prev) => ({...prev, switch: false})),
            component: SwitchDialog,
            props: {
                open: dialogState.switch,
                onClose: () => {
                    console.log('Closing SwitchDialog');
                    setDialogState((prev) => ({...prev, switch: false}));
                    if (onClose) onClose();
                },
                onConfirm: () => {
                    console.log('Confirming switch');
                    handleConfirm(pendingAction?.action);
                    setDialogState((prev) => ({...prev, switch: false}));
                    if (onClose) onClose();
                },
                checked: checkboxState.switch,
                setChecked: (value) => {
                    console.log('Updating switch checkbox:', value);
                    setCheckboxState((prev) => ({...prev, switch: value}));
                },
                disabled: !checkboxState.switch,
                cancelDisabled: false,
                pendingAction,
                target,
            },
        },
        giveback: {
            openDialog: () => setDialogState((prev) => ({...prev, giveback: true})),
            initState: () => setCheckboxState((prev) => ({...prev, giveback: false})),
            component: GivebackDialog,
            props: {
                open: dialogState.giveback,
                onClose: () => {
                    console.log('Closing GivebackDialog');
                    setDialogState((prev) => ({...prev, giveback: false}));
                    if (onClose) onClose();
                },
                onConfirm: () => {
                    console.log('Confirming giveback');
                    handleConfirm(pendingAction?.action);
                    setDialogState((prev) => ({...prev, giveback: false}));
                    if (onClose) onClose();
                },
                checked: checkboxState.giveback,
                setChecked: (value) => {
                    console.log('Updating giveback checkbox:', value);
                    setCheckboxState((prev) => ({...prev, giveback: value}));
                },
                disabled: !checkboxState.giveback,
                cancelDisabled: false,
                pendingAction,
                target,
            },
        },
        simpleConfirm: {
            openDialog: () => setDialogState((prev) => ({...prev, simpleConfirm: true})),
            initState: () => setCheckboxState((prev) => ({...prev, simpleConfirm: false})),
            component: SimpleConfirmDialog,
            props: {
                open: dialogState.simpleConfirm,
                onClose: () => {
                    console.log('Closing SimpleConfirmDialog');
                    setDialogState((prev) => ({...prev, simpleConfirm: false}));
                    if (onClose) onClose();
                },
                onConfirm: () => {
                    console.log('Confirming simple action:', pendingAction?.action);
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
    };

    useEffect(() => {
        if (pendingAction && pendingAction.action) {
            const action = pendingAction.action.toLowerCase();
            console.log('Processing pendingAction:', pendingAction);

            if (supportedActions.includes(action)) {
                if (action in dialogConfig) {
                    console.log(`Opening dialog for action: ${action}`);
                    dialogConfig[action].openDialog();
                    dialogConfig[action].initState();
                } else {
                    console.log(`Using SimpleConfirmDialog for action: ${action}`);
                    dialogConfig.simpleConfirm.openDialog();
                    dialogConfig.simpleConfirm.initState();
                }
            } else {
                console.warn(`Unsupported action: ${action}`);
                if (onClose) onClose();
            }
        } else {
            console.warn('No valid pendingAction or action provided:', pendingAction);
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
