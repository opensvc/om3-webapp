import React, {useRef} from 'react';
import {Dialog} from '../ui/components/Dialog';
import {Button} from '../ui/components/Button';
import {Checkbox, Field, Input, Textarea} from '../ui/components/Field';

// Cancel and confirm buttons at the foot of a dialog.
const DialogFooter = ({onClose, cancelDisabled = false, onConfirm, confirmDisabled, confirmLabel, variant = 'primary', children}) => (
    <>
        <Button variant="secondary" onClick={onClose} disabled={cancelDisabled}>
            Cancel
        </Button>
        <Button variant={variant} onClick={onConfirm} disabled={confirmDisabled} aria-label={confirmLabel}>
            {children}
        </Button>
    </>
);

// Acknowledgement checkboxes, one per line.
const Acknowledgements = ({children}) => <div className="flex flex-col gap-2 text-ink">{children}</div>;

// Dialog with a single acknowledgement checkbox
const SingleCheckDialog = ({
                               open, onClose, onConfirm, checked, setChecked, disabled,
                               title, checkboxLabel, checkboxAriaLabel, confirmAriaLabel, confirmText,
                               variant = 'primary', cancelDisabled = false,
                           }) => (
    <Dialog
        open={open}
        onClose={onClose}
        title={title}
        footer={
            <DialogFooter
                onClose={onClose}
                cancelDisabled={cancelDisabled}
                onConfirm={onConfirm}
                confirmDisabled={!checked || disabled}
                confirmLabel={confirmAriaLabel}
                variant={variant}
            >
                {confirmText}
            </DialogFooter>
        }
    >
        <Acknowledgements>
            <Checkbox
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                aria-label={checkboxAriaLabel}
                label={checkboxLabel}
            />
        </Acknowledgements>
    </Dialog>
);

// Hidden file input behind a "Choose File" button, the chosen file name beside it
const FilePicker = ({id, onChange, disabled, file, emptyText}) => {
    const input = useRef(null);
    return (
        <div>
            <input
                ref={input}
                id={id}
                type="file"
                hidden
                onChange={onChange}
                disabled={disabled}
            />
            <div className="flex items-center gap-3">
                <Button variant="secondary" onClick={() => input.current?.click()} disabled={disabled}>
                    Choose File
                </Button>
                <span className={file ? 'text-ink' : 'text-ink-muted'}>
                    {file ? file.name : emptyText}
                </span>
            </div>
        </div>
    );
};

// Dialog for the "freeze" action
export const FreezeDialog = ({open, onClose, onConfirm, checked, setChecked, disabled}) => (
    <SingleCheckDialog
        open={open} onClose={onClose} onConfirm={onConfirm}
        checked={checked} setChecked={setChecked} disabled={disabled}
        title="Confirm Freeze"
        checkboxAriaLabel="Confirm failover pause"
        checkboxLabel="I understand that the selected service orchestration will be paused."
        confirmAriaLabel="Confirm freeze action"
        confirmText="Confirm"
    />
);

// Dialog for the "stop" action
export const StopDialog = ({open, onClose, onConfirm, checked, setChecked, disabled}) => (
    <SingleCheckDialog
        open={open} onClose={onClose} onConfirm={onConfirm}
        checked={checked} setChecked={setChecked} disabled={disabled}
        title="Confirm Stop"
        checkboxAriaLabel="Confirm service interruption"
        checkboxLabel="I understand that this may interrupt services."
        confirmAriaLabel="Confirm stop action"
        confirmText="Stop"
        variant="danger"
    />
);

// Dialog for the "shutdown" action
export const ShutdownDialog = ({open, onClose, onConfirm, checkboxes, setCheckboxes, disabled}) => (
    <Dialog
        open={open}
        onClose={onClose}
        title="Confirm Shutdown"
        footer={
            <DialogFooter
                onClose={onClose}
                onConfirm={onConfirm}
                confirmDisabled={
                    !checkboxes.instancesDown ||
                    !checkboxes.peerTakeover ||
                    disabled
                }
                confirmLabel="Confirm shutdown action"
                variant="danger"
            >
                Shutdown
            </DialogFooter>
        }
    >
        <Acknowledgements>
            <Checkbox
                checked={checkboxes.instancesDown}
                onChange={(e) =>
                    setCheckboxes((prev) => ({...prev, instancesDown: e.target.checked}))
                }
                aria-label="Confirm instances shutdown"
                label="I understand all svc and vol instances on this node will be shut down and the daemon will be stopped."
            />
            <Checkbox
                checked={checkboxes.peerTakeover}
                onChange={(e) =>
                    setCheckboxes((prev) => ({...prev, peerTakeover: e.target.checked}))
                }
                aria-label="Confirm peer takeover"
                label="I understand peer nodes are not notified of a maintenance period and will try to take over services as soon as the instances are down."
            />
        </Acknowledgements>
    </Dialog>
);

// Dialog for the "restart" action
export const RestartDialog = ({open, onClose, onConfirm, checked, setChecked, disabled}) => (
    <SingleCheckDialog
        open={open} onClose={onClose} onConfirm={onConfirm}
        checked={checked} setChecked={setChecked} disabled={disabled}
        title="Confirm Restart"
        checkboxAriaLabel="Confirm service interruption"
        checkboxLabel="I understand that this may interrupt services."
        confirmAriaLabel="Confirm restart action"
        confirmText="Restart"
        variant="danger"
    />
);

// Dialog for the "clear" action
export const ClearDialog = ({open, onClose, onConfirm, checked, setChecked, disabled}) => (
    <SingleCheckDialog
        open={open} onClose={onClose} onConfirm={onConfirm}
        checked={checked} setChecked={setChecked} disabled={disabled}
        title="Confirm Clear"
        checkboxAriaLabel="Confirm clear action"
        checkboxLabel="I understand that this will clear node status and logs."
        confirmAriaLabel="Confirm clear action"
        confirmText="Confirm"
    />
);

// Dialog for the "drain" action
export const DrainDialog = ({open, onClose, onConfirm, checked, setChecked, disabled}) => (
    <SingleCheckDialog
        open={open} onClose={onClose} onConfirm={onConfirm}
        checked={checked} setChecked={setChecked} disabled={disabled}
        title="Confirm Drain"
        checkboxAriaLabel="Confirm service migration"
        checkboxLabel="I understand that this will migrate services away from the selected nodes."
        confirmAriaLabel="Confirm drain action"
        confirmText="Confirm"
    />
);

const SERVICE_INTERRUPTION_LABEL =
    "I understand the selected services may be temporarily interrupted during failover, or durably interrupted if no failover is configured.";

// Dialog for the "unprovision" action
export const UnprovisionDialog = ({open, onClose, onConfirm, checkboxes, setCheckboxes, disabled, pendingAction}) => {
    const isNodeAction = pendingAction?.node || pendingAction?.batch === 'nodes';

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Confirm Unprovision"
            footer={
                <DialogFooter
                    onClose={onClose}
                    onConfirm={onConfirm}
                    confirmDisabled={
                        !checkboxes.dataLoss ||
                        !checkboxes.serviceInterruption ||
                        (!isNodeAction && !checkboxes.clusterwide) ||
                        disabled
                    }
                    confirmLabel="Confirm unprovision action"
                    variant="danger"
                >
                    Confirm
                </DialogFooter>
            }
        >
            <Acknowledgements>
                <Checkbox
                    checked={checkboxes.dataLoss}
                    onChange={(e) =>
                        setCheckboxes((prev) => ({...prev, dataLoss: e.target.checked}))
                    }
                    aria-label="Confirm data loss"
                    label="I understand data will be lost."
                />
                {!isNodeAction && (
                    <Checkbox
                        checked={checkboxes.clusterwide}
                        onChange={(e) =>
                            setCheckboxes((prev) => ({...prev, clusterwide: e.target.checked}))
                        }
                        aria-label="Confirm clusterwide orchestration"
                        label="I understand this action will be orchestrated clusterwide."
                    />
                )}
                <Checkbox
                    checked={checkboxes.serviceInterruption}
                    onChange={(e) =>
                        setCheckboxes((prev) => ({
                            ...prev,
                            serviceInterruption: e.target.checked,
                        }))
                    }
                    aria-label="Confirm service interruption"
                    label={SERVICE_INTERRUPTION_LABEL}
                />
            </Acknowledgements>
        </Dialog>
    );
};

// Dialog for the "purge" action
export const PurgeDialog = ({open, onClose, onConfirm, checkboxes, setCheckboxes, disabled}) => (
    <Dialog
        open={open}
        onClose={onClose}
        title="Confirm Purge"
        footer={
            <DialogFooter
                onClose={onClose}
                onConfirm={onConfirm}
                confirmDisabled={
                    !checkboxes.dataLoss ||
                    !checkboxes.configLoss ||
                    !checkboxes.serviceInterruption ||
                    disabled
                }
                confirmLabel="Confirm purge action"
                variant="danger"
            >
                Confirm
            </DialogFooter>
        }
    >
        <Acknowledgements>
            <Checkbox
                checked={checkboxes.dataLoss}
                onChange={(e) =>
                    setCheckboxes((prev) => ({...prev, dataLoss: e.target.checked}))
                }
                aria-label="Confirm data loss"
                label="I understand data will be lost."
            />
            <Checkbox
                checked={checkboxes.configLoss}
                onChange={(e) =>
                    setCheckboxes((prev) => ({...prev, configLoss: e.target.checked}))
                }
                aria-label="Confirm configuration loss"
                label="I understand the configuration will be lost."
            />
            <Checkbox
                checked={checkboxes.serviceInterruption}
                onChange={(e) =>
                    setCheckboxes((prev) => ({
                        ...prev,
                        serviceInterruption: e.target.checked,
                    }))
                }
                aria-label="Confirm service interruption"
                label={SERVICE_INTERRUPTION_LABEL}
            />
        </Acknowledgements>
    </Dialog>
);

// Dialog for the "delete" action
export const DeleteDialog = ({open, onClose, onConfirm, checkboxes, setCheckboxes, disabled}) => (
    <Dialog
        open={open}
        onClose={onClose}
        title="Confirm Delete"
        footer={
            <DialogFooter
                onClose={onClose}
                onConfirm={onConfirm}
                confirmDisabled={!checkboxes.configLoss || !checkboxes.clusterwide || disabled}
                confirmLabel="Confirm delete action"
                variant="danger"
            >
                Delete
            </DialogFooter>
        }
    >
        <Acknowledgements>
            <Checkbox
                checked={checkboxes.configLoss}
                onChange={(e) =>
                    setCheckboxes((prev) => ({...prev, configLoss: e.target.checked}))
                }
                aria-label="Confirm configuration loss"
                label="I understand the configuration will be lost."
            />
            <Checkbox
                checked={checkboxes.clusterwide}
                onChange={(e) =>
                    setCheckboxes((prev) => ({...prev, clusterwide: e.target.checked}))
                }
                aria-label="Confirm clusterwide orchestration"
                label="I understand this action will be orchestrated clusterwide."
            />
        </Acknowledgements>
    </Dialog>
);

// Dialog for the "switch" action
export const SwitchDialog = ({open, onClose, onConfirm, checked, setChecked, disabled}) => (
    <SingleCheckDialog
        open={open} onClose={onClose} onConfirm={onConfirm}
        checked={checked} setChecked={setChecked} disabled={disabled}
        cancelDisabled={disabled}
        title="Confirm Switch"
        checkboxAriaLabel="Confirm service unavailability"
        checkboxLabel="I understand the selected services will be unavailable during move."
        confirmAriaLabel="Confirm switch action"
        confirmText="Confirm"
    />
);

// Dialog for the "giveback" action
export const GivebackDialog = ({open, onClose, onConfirm, checked, setChecked, disabled}) => (
    <SingleCheckDialog
        open={open} onClose={onClose} onConfirm={onConfirm}
        checked={checked} setChecked={setChecked} disabled={disabled}
        title="Confirm Giveback"
        checkboxAriaLabel="Confirm service unavailability"
        checkboxLabel="I understand the selected services will be unavailable during move."
        confirmAriaLabel="Confirm giveback action"
        confirmText="Confirm"
    />
);

// Dialog for the "delete key" action
export const DeleteKeyDialog = ({
                                    open,
                                    onClose,
                                    onConfirm,
                                    keyToDelete,
                                    disabled,
                                }) => (
    <Dialog
        open={open}
        onClose={onClose}
        title="Confirm Key Deletion"
        footer={
            <DialogFooter
                onClose={onClose}
                onConfirm={onConfirm}
                confirmDisabled={disabled}
                confirmLabel="Confirm delete key action"
                variant="danger"
            >
                Delete
            </DialogFooter>
        }
    >
        <p className="text-ink">
            Are you sure you want to delete the key <strong>{keyToDelete}</strong>?
        </p>
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
    <Dialog
        open={open}
        onClose={onClose}
        title="Create New Key"
        footer={
            <DialogFooter
                onClose={onClose}
                onConfirm={onConfirm}
                confirmDisabled={disabled || !newKeyName || !newKeyFile}
                confirmLabel="Confirm create key action"
            >
                Create
            </DialogFooter>
        }
    >
        <Field label="Key Name">
            {(control) => (
                <Input
                    {...control}
                    autoFocus
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    disabled={disabled}
                    aria-label="Key name input"
                />
            )}
        </Field>
        <FilePicker
            id="create-key-file-upload"
            onChange={(e) => setNewKeyFile(e.target.files[0])}
            disabled={disabled}
            file={newKeyFile}
            emptyText="No file selected"
        />
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
    <Dialog
        open={open}
        onClose={onClose}
        title="Update Configuration"
        footer={
            <DialogFooter
                onClose={onClose}
                onConfirm={onConfirm}
                confirmDisabled={disabled || !newConfigFile}
                confirmLabel="Confirm update config action"
            >
                Update
            </DialogFooter>
        }
    >
        <FilePicker
            id="update-config-file-upload"
            onChange={(e) => setNewConfigFile(e.target.files[0])}
            disabled={disabled}
            file={newConfigFile}
            emptyText="No file chosen"
        />
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
    <Dialog
        open={open}
        onClose={onClose}
        title="Manage Configuration Parameters"
        size="md"
        footer={
            <DialogFooter
                onClose={onClose}
                onConfirm={onConfirm}
                confirmDisabled={disabled || (!paramsToSet && !paramsToUnset && !paramsToDelete)}
                confirmLabel="Apply configuration changes"
            >
                Apply
            </DialogFooter>
        }
    >
        <Field label="Parameters to set" hint="Add parameters (one per line, e.g., section.param=value)">
            {(control) => (
                <Textarea
                    {...control}
                    autoFocus
                    rows={4}
                    value={paramsToSet}
                    onChange={(e) => setParamsToSet(e.target.value)}
                    disabled={disabled}
                    placeholder={"section.param1=value1\nsection.param2=value2"}
                    aria-label="Parameters to set input"
                />
            )}
        </Field>
        <Field label="Parameter keys to unset" hint="Unset parameters (one key per line, e.g., section.param)">
            {(control) => (
                <Textarea
                    {...control}
                    rows={4}
                    value={paramsToUnset}
                    onChange={(e) => setParamsToUnset(e.target.value)}
                    disabled={disabled}
                    placeholder={"section.param1\nsection.param2"}
                    aria-label="Parameters to unset input"
                />
            )}
        </Field>
        <Field label="Section keys to delete" hint="Delete sections (one key per line, e.g., section)">
            {(control) => (
                <Textarea
                    {...control}
                    rows={4}
                    value={paramsToDelete}
                    onChange={(e) => setParamsToDelete(e.target.value)}
                    disabled={disabled}
                    placeholder={"section1\nsection2"}
                    aria-label="Sections to delete input"
                />
            )}
        </Field>
    </Dialog>
);

// Simple dialog for other actions
export const SimpleConfirmDialog = ({open, onClose, onConfirm, action, target}) => (
    <Dialog
        open={open}
        onClose={onClose}
        title={<>Confirm {action}</>}
        footer={
            <DialogFooter
                onClose={onClose}
                onConfirm={onConfirm}
                confirmLabel={`Confirm ${action} action`}
            >
                Confirm
            </DialogFooter>
        }
    >
        <p className="text-ink">
            Are you sure you want to <strong>{action}</strong> on {target}?
        </p>
    </Dialog>
);
