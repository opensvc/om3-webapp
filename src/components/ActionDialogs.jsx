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
            <Button onClick={onClose} disabled={disabled}>
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
            <Button onClick={onClose} disabled={disabled}>
                Cancel
            </Button>
            <Button
                variant="contained"
                color="error"
                disabled={!checked || disabled}
                onClick={onConfirm}
                aria-label="Confirm stop action"
            >
                Stop
            </Button>
        </DialogActions>
    </Dialog>
);

// Dialog for the "unprovision" action
export const UnprovisionDialog = ({open, onClose, onConfirm, checked, setChecked, disabled}) => (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Unprovision</DialogTitle>
        <DialogContent>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={checked}
                        onChange={(e) => setChecked(e.target.checked)}
                        aria-label="Confirm data loss"
                    />
                }
                label="I understand that data will be lost."
            />
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose} disabled={disabled}>
                Cancel
            </Button>
            <Button
                variant="contained"
                color="error"
                disabled={!checked || disabled}
                onClick={onConfirm}
                aria-label="Confirm unprovision action"
            >
                Confirm
            </Button>
        </DialogActions>
    </Dialog>
);

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
            <Button onClick={onClose} disabled={disabled}>
                Cancel
            </Button>
            <Button
                variant="contained"
                color="error"
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
            <Button onClick={onClose} disabled={disabled}>
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
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="contained" onClick={onConfirm} aria-label={`Confirm ${action} action`}>
                Confirm
            </Button>
        </DialogActions>
    </Dialog>
);
