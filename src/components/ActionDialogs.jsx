import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    FormControlLabel,
    Checkbox,
    Typography,
    TextField,
    Box,
} from '@mui/material';

// Dialog for the "freeze" action
export const FreezeDialog = ({open, onClose, onConfirm, checked, setChecked, disabled}) => (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Freeze</DialogTitle>
        <DialogContent>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={checked}
                        onChange={(e) => setChecked(e.target.checked)}
                        aria-label="Confirm failover pause"
                    />
                }
                label="I understand that the selected service orchestration will be paused."
            />
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose} disabled={false}>
                Cancel
            </Button>
            <Button
                variant="contained"
                color="primary"
                disabled={!checked || disabled}
                onClick={onConfirm}
                aria-label="Confirm freeze action"
            >
                Confirm
            </Button>
        </DialogActions>
    </Dialog>
);

// Dialog for the "stop" action
export const StopDialog = ({open, onClose, onConfirm, checked, setChecked, disabled}) => (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Stop</DialogTitle>
        <DialogContent>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={checked}
                        onChange={(e) => setChecked(e.target.checked)}
                        aria-label="Confirm service interruption"
                    />
                }
                label="I understand that this may interrupt services."
            />
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose} disabled={false}>
                Cancel
            </Button>
            <Button
                variant="contained"
                color="primary"
                disabled={!checked || disabled}
                onClick={onConfirm}
                aria-label="Confirm stop action"
            >
                Stop
            </Button>
        </DialogActions>
    </Dialog>
);

// Dialog for the "restart" action
export const RestartDialog = ({open, onClose, onConfirm, checked, setChecked, disabled}) => (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{textAlign: "center", fontWeight: "bold"}}>Confirm Restart</DialogTitle>
        <DialogContent sx={{padding: 3}}>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={checked}
                        onChange={(e) => setChecked(e.target.checked)}
                        aria-label="Confirm service interruption"
                    />
                }
                label="I understand that this may interrupt services."
            />
        </DialogContent>
        <DialogActions sx={{justifyContent: "center", px: 3, pb: 2}}>
            <Button onClick={onClose} disabled={false} variant="outlined">
                Cancel
            </Button>
            <Button
                variant="contained"
                color="primary"
                disabled={!checked || disabled}
                onClick={onConfirm}
                aria-label="Confirm restart action"
            >
                Restart
            </Button>
        </DialogActions>
    </Dialog>
);

// Dialog for the "clear" action
export const ClearDialog = ({open, onClose, onConfirm, checked, setChecked, disabled}) => (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{textAlign: "center", fontWeight: "bold"}}>Confirm Clear</DialogTitle>
        <DialogContent sx={{padding: 3}}>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={checked}
                        onChange={(e) => setChecked(e.target.checked)}
                        aria-label="Confirm clear action"
                    />
                }
                label="I understand that this will clear node status and logs."
            />
        </DialogContent>
        <DialogActions sx={{justifyContent: "center", px: 3, pb: 2}}>
            <Button onClick={onClose} disabled={false} variant="outlined">
                Cancel
            </Button>
            <Button
                variant="contained"
                color="primary"
                disabled={!checked || disabled}
                onClick={onConfirm}
                aria-label="Confirm clear action"
            >
                Confirm
            </Button>
        </DialogActions>
    </Dialog>
);

// Dialog for the "drain" action
export const DrainDialog = ({open, onClose, onConfirm, checked, setChecked, disabled}) => (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{textAlign: "center", fontWeight: "bold"}}>Confirm Drain</DialogTitle>
        <DialogContent sx={{padding: 3}}>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={checked}
                        onChange={(e) => setChecked(e.target.checked)}
                        aria-label="Confirm service migration"
                    />
                }
                label="I understand that this will migrate services away from the selected nodes."
            />
        </DialogContent>
        <DialogActions sx={{justifyContent: "center", px: 3, pb: 2}}>
            <Button onClick={onClose} disabled={false} variant="outlined">
                Cancel
            </Button>
            <Button
                variant="contained"
                color="primary"
                disabled={!checked || disabled}
                onClick={onConfirm}
                aria-label="Confirm drain action"
            >
                Confirm
            </Button>
        </DialogActions>
    </Dialog>
);

// Dialog for the "unprovision" action
export const UnprovisionDialog = ({open, onClose, onConfirm, checkboxes, setCheckboxes, disabled, pendingAction}) => {
    const isNodeAction = pendingAction?.node || pendingAction?.batch === 'nodes';

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Confirm Unprovision</DialogTitle>
            <DialogContent>
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={checkboxes.dataLoss}
                            onChange={(e) =>
                                setCheckboxes((prev) => ({...prev, dataLoss: e.target.checked}))
                            }
                            aria-label="Confirm data loss"
                        />
                    }
                    label="I understand data will be lost."
                />
                {!isNodeAction && (
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={checkboxes.clusterwide}
                                onChange={(e) =>
                                    setCheckboxes((prev) => ({...prev, clusterwide: e.target.checked}))
                                }
                                aria-label="Confirm clusterwide orchestration"
                            />
                        }
                        label="I understand this action will be orchestrated clusterwide."
                    />
                )}
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={checkboxes.serviceInterruption}
                            onChange={(e) =>
                                setCheckboxes((prev) => ({
                                    ...prev,
                                    serviceInterruption: e.target.checked,
                                }))
                            }
                            aria-label="Confirm service interruption"
                        />
                    }
                    label="I understand the selected services may be temporarily interrupted during failover, or durably interrupted if no failover is configured."
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={false}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    color="primary"
                    disabled={
                        !checkboxes.dataLoss ||
                        !checkboxes.serviceInterruption ||
                        (!isNodeAction && !checkboxes.clusterwide) ||
                        disabled
                    }
                    onClick={onConfirm}
                    aria-label="Confirm unprovision action"
                >
                    Confirm
                </Button>
            </DialogActions>
        </Dialog>
    );
};

// Dialog for the "purge" action
export const PurgeDialog = ({open, onClose, onConfirm, checkboxes, setCheckboxes, disabled}) => (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Purge</DialogTitle>
        <DialogContent>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={checkboxes.dataLoss}
                        onChange={(e) =>
                            setCheckboxes((prev) => ({...prev, dataLoss: e.target.checked}))
                        }
                        aria-label="Confirm data loss"
                    />
                }
                label="I understand data will be lost."
            />
            <FormControlLabel
                control={
                    <Checkbox
                        checked={checkboxes.configLoss}
                        onChange={(e) =>
                            setCheckboxes((prev) => ({...prev, configLoss: e.target.checked}))
                        }
                        aria-label="Confirm configuration loss"
                    />
                }
                label="I understand the configuration will be lost."
            />
            <FormControlLabel
                control={
                    <Checkbox
                        checked={checkboxes.serviceInterruption}
                        onChange={(e) =>
                            setCheckboxes((prev) => ({
                                ...prev,
                                serviceInterruption: e.target.checked,
                            }))
                        }
                        aria-label="Confirm service interruption"
                    />
                }
                label="I understand the selected services may be temporarily interrupted during failover, or durably interrupted if no failover is configured."
            />
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose} disabled={false}>
                Cancel
            </Button>
            <Button
                variant="contained"
                color="primary"
                disabled={
                    !checkboxes.dataLoss ||
                    !checkboxes.configLoss ||
                    !checkboxes.serviceInterruption ||
                    disabled
                }
                onClick={onConfirm}
                aria-label="Confirm purge action"
            >
                Confirm
            </Button>
        </DialogActions>
    </Dialog>
);

// Dialog for the "delete" action
export const DeleteDialog = ({open, onClose, onConfirm, checkboxes, setCheckboxes, disabled}) => (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={checkboxes.configLoss}
                        onChange={(e) =>
                            setCheckboxes((prev) => ({...prev, configLoss: e.target.checked}))
                        }
                        aria-label="Confirm configuration loss"
                    />
                }
                label="I understand the configuration will be lost."
            />
            <FormControlLabel
                control={
                    <Checkbox
                        checked={checkboxes.clusterwide}
                        onChange={(e) =>
                            setCheckboxes((prev) => ({...prev, clusterwide: e.target.checked}))
                        }
                        aria-label="Confirm clusterwide orchestration"
                    />
                }
                label="I understand this action will be orchestrated clusterwide."
            />
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose} disabled={false}>
                Cancel
            </Button>
            <Button
                variant="contained"
                color="primary"
                disabled={!checkboxes.configLoss || !checkboxes.clusterwide || disabled}
                onClick={onConfirm}
                aria-label="Confirm delete action"
            >
                Delete
            </Button>
        </DialogActions>
    </Dialog>
);

// Dialog for the "switch" action
export const SwitchDialog = ({open, onClose, onConfirm, checked, setChecked, disabled}) => (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Switch</DialogTitle>
        <DialogContent>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={checked}
                        onChange={(e) => setChecked(e.target.checked)}
                        aria-label="Confirm service unavailability"
                    />
                }
                label="I understand the selected services will be unavailable during move."
            />
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose} disabled={disabled}>
                Cancel
            </Button>
            <Button
                variant="contained"
                color="primary"
                disabled={!checked || disabled}
                onClick={onConfirm}
                aria-label="Confirm switch action"
            >
                Confirm
            </Button>
        </DialogActions>
    </Dialog>
);

// Dialog for the "giveback" action
export const GivebackDialog = ({open, onClose, onConfirm, checked, setChecked, disabled}) => (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Giveback</DialogTitle>
        <DialogContent>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={checked}
                        onChange={(e) => setChecked(e.target.checked)}
                        aria-label="Confirm service unavailability"
                    />
                }
                label="I understand the selected services will be unavailable during move."
            />
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose} disabled={false}>
                Cancel
            </Button>
            <Button
                variant="contained"
                color="primary"
                disabled={!checked || disabled}
                onClick={onConfirm}
                aria-label="Confirm giveback action"
            >
                Confirm
            </Button>
        </DialogActions>
    </Dialog>
);

// Dialog for the "delete key" action
export const DeleteKeyDialog = ({
                                    open,
                                    onClose,
                                    onConfirm,
                                    keyToDelete,
                                    disabled,
                                }) => (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Key Deletion</DialogTitle>
        <DialogContent>
            <Typography variant="body1">
                Are you sure you want to delete the key <strong>{keyToDelete}</strong>?
            </Typography>
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose} disabled={false}>
                Cancel
            </Button>
            <Button
                variant="contained"
                color="primary"
                onClick={onConfirm}
                disabled={disabled}
                aria-label="Confirm delete key action"
            >
                Delete
            </Button>
        </DialogActions>
    </Dialog>
);

// Dialog for the "create key" action
export const CreateKeyDialog = ({
                                    open,
                                    onClose,
                                    onConfirm,
                                    newKeyName,
                                    setNewKeyName,
                                    newKeyFile,
                                    setNewKeyFile,
                                    disabled,
                                }) => (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Key</DialogTitle>
        <DialogContent>
            <TextField
                autoFocus
                margin="dense"
                label="Key Name"
                fullWidth
                variant="outlined"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                disabled={disabled}
            />
            <Box sx={{mt: 2}}>
                <input
                    id="create-key-file-upload"
                    type="file"
                    hidden
                    onChange={(e) => setNewKeyFile(e.target.files[0])}
                    disabled={disabled}
                />
                <Box sx={{display: 'flex', alignItems: 'center', gap: 2}}>
                    <Button
                        variant="outlined"
                        component="label"
                        htmlFor="create-key-file-upload"
                        disabled={disabled}
                    >
                        Choose File
                    </Button>
                    <Typography
                        variant="body2"
                        color={newKeyFile ? 'textPrimary' : 'textSecondary'}
                    >
                        {newKeyFile ? newKeyFile.name : 'No file selected'}
                    </Typography>
                </Box>
            </Box>
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose} disabled={false}>
                Cancel
            </Button>
            <Button
                variant="contained"
                color="primary"
                onClick={onConfirm}
                disabled={disabled || !newKeyName || !newKeyFile}
                aria-label="Confirm create key action"
            >
                Create
            </Button>
        </DialogActions>
    </Dialog>
);

// Dialog for the "update key" action
export const UpdateKeyDialog = ({
                                    open,
                                    onClose,
                                    onConfirm,
                                    updateKeyName,
                                    setUpdateKeyName,
                                    updateKeyFile,
                                    setUpdateKeyFile,
                                    disabled,
                                }) => (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Update Key</DialogTitle>
        <DialogContent>
            <TextField
                autoFocus
                margin="dense"
                label="Key Name"
                fullWidth
                variant="outlined"
                value={updateKeyName}
                onChange={(e) => setUpdateKeyName(e.target.value)}
                disabled={disabled}
            />
            <Box sx={{mt: 2}}>
                <input
                    id="update-key-file-upload"
                    type="file"
                    hidden
                    onChange={(e) => setUpdateKeyFile(e.target.files[0])}
                    disabled={disabled}
                />
                <Box sx={{display: 'flex', alignItems: 'center', gap: 2}}>
                    <Button
                        variant="outlined"
                        component="label"
                        htmlFor="update-key-file-upload"
                        disabled={disabled}
                    >
                        Choose File
                    </Button>
                    <Typography
                        variant="body2"
                        color={updateKeyFile ? 'textPrimary' : 'textSecondary'}
                    >
                        {updateKeyFile ? updateKeyFile.name : 'No file chosen'}
                    </Typography>
                </Box>
            </Box>
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose} disabled={false}>
                Cancel
            </Button>
            <Button
                variant="contained"
                color="primary"
                onClick={onConfirm}
                disabled={disabled || !updateKeyName || !updateKeyFile}
                aria-label="Confirm update key action"
            >
                Update
            </Button>
        </DialogActions>
    </Dialog>
);

// Dialog for the "update config" action
export const UpdateConfigDialog = ({
                                       open,
                                       onClose,
                                       onConfirm,
                                       newConfigFile,
                                       setNewConfigFile,
                                       disabled,
                                   }) => (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Update Configuration</DialogTitle>
        <DialogContent>
            <Box sx={{mt: 2}}>
                <input
                    id="update-config-file-upload"
                    type="file"
                    hidden
                    onChange={(e) => setNewConfigFile(e.target.files[0])}
                    disabled={disabled}
                />
                <Box sx={{display: 'flex', alignItems: 'center', gap: 2}}>
                    <Button
                        variant="outlined"
                        component="label"
                        htmlFor="update-config-file-upload"
                        disabled={disabled}
                    >
                        Choose File
                    </Button>
                    <Typography
                        variant="body2"
                        color={newConfigFile ? 'textPrimary' : 'textSecondary'}
                    >
                        {newConfigFile ? newConfigFile.name : 'No file chosen'}
                    </Typography>
                </Box>
            </Box>
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose} disabled={false}>
                Cancel
            </Button>
            <Button
                variant="contained"
                color="primary"
                onClick={onConfirm}
                disabled={disabled || !newConfigFile}
                aria-label="Confirm update config action"
            >
                Update
            </Button>
        </DialogActions>
    </Dialog>
);

// Dialog for the "manage config parameters" action
export const ManageConfigParamsDialog = ({
                                             open,
                                             onClose,
                                             onConfirm,
                                             paramsToSet,
                                             setParamsToSet,
                                             paramsToUnset,
                                             setParamsToUnset,
                                             paramsToDelete,
                                             setParamsToDelete,
                                             disabled,
                                         }) => (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Manage Configuration Parameters</DialogTitle>
        <DialogContent>
            <Typography variant="subtitle1" gutterBottom>
                Add parameters (one per line, e.g., section.param=value)
            </Typography>
            <TextField
                autoFocus
                margin="dense"
                label="Parameters to set"
                fullWidth
                variant="outlined"
                multiline
                rows={4}
                value={paramsToSet}
                onChange={(e) => setParamsToSet(e.target.value)}
                disabled={disabled}
                placeholder="section.param1=value1
section.param2=value2"
            />
            <Typography variant="subtitle1" gutterBottom sx={{mt: 2}}>
                Unset parameters (one key per line, e.g., section.param)
            </Typography>
            <TextField
                margin="dense"
                label="Parameter keys to unset"
                fullWidth
                variant="outlined"
                multiline
                rows={4}
                value={paramsToUnset}
                onChange={(e) => setParamsToUnset(e.target.value)}
                disabled={disabled}
                placeholder="section.param1
section.param2"
                sx={{
                    "& .MuiInputBase-root": {
                        padding: "8px",
                        lineHeight: "1.5",
                        minHeight: "100px",
                    },
                    "& .MuiInputBase-input": {
                        overflow: "auto",
                        boxSizing: "border-box",
                    },
                    "& .MuiInputLabel-root": {
                        backgroundColor: "white",
                        padding: "0 4px",
                    },
                }}
            />
            <Typography variant="subtitle1" gutterBottom sx={{mt: 2}}>
                Delete sections (one key per line, e.g., section)
            </Typography>
            <TextField
                margin="dense"
                label="Section keys to delete"
                fullWidth
                variant="outlined"
                multiline
                rows={4}
                value={paramsToDelete}
                onChange={(e) => setParamsToDelete(e.target.value)}
                disabled={disabled}
                placeholder="section1
section2"
                sx={{
                    "& .MuiInputBase-root": {
                        padding: "8px",
                        lineHeight: "1.5",
                        minHeight: "100px",
                    },
                    "& .MuiInputBase-input": {
                        overflow: "auto",
                        boxSizing: "border-box",
                    },
                    "& .MuiInputLabel-root": {
                        backgroundColor: "white",
                        padding: "0 4px",
                    },
                }}
            />
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose} disabled={false}>
                Cancel
            </Button>
            <Button
                variant="contained"
                color="primary"
                onClick={onConfirm}
                disabled={disabled || (!paramsToSet && !paramsToUnset && !paramsToDelete)}
                aria-label="Confirm manage config params action"
            >
                Apply
            </Button>
        </DialogActions>
    </Dialog>
);

// Simple dialog for other actions
export const SimpleConfirmDialog = ({open, onClose, onConfirm, action, target}) => (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm {action}</DialogTitle>
        <DialogContent>
            <Typography>
                Are you sure you want to <strong>{action}</strong> on {target}?
            </Typography>
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose} disabled={false}>
                Cancel
            </Button>
            <Button
                variant="contained"
                color="primary"
                onClick={onConfirm}
                aria-label={`Confirm ${action} action`}
            >
                Confirm
            </Button>
        </DialogActions>
    </Dialog>
);
