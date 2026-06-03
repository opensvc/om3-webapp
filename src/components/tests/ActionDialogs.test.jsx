import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {
    FreezeDialog, StopDialog, RestartDialog, ClearDialog, DrainDialog,
    UnprovisionDialog, PurgeDialog, DeleteDialog, SwitchDialog, GivebackDialog,
    DeleteKeyDialog, CreateKeyDialog, UpdateConfigDialog,
    ManageConfigParamsDialog, SimpleConfirmDialog,
} from '../ActionDialogs';

// Mock MUI components to simplify rendering and add accessibility labels
jest.mock('@mui/material', () => ({
    Dialog: ({open, children}) => (open ? <div data-testid="dialog">{children}</div> : null),
    DialogTitle: ({children}) => <h2>{children}</h2>,
    DialogContent: ({children}) => <div>{children}</div>,
    DialogActions: ({children}) => <div>{children}</div>,
    Button: ({onClick, disabled, children, 'aria-label': ariaLabel, variant}) =>
        <button onClick={onClick} disabled={disabled} aria-label={ariaLabel} data-variant={variant}>{children}</button>,
    Checkbox: ({checked, onChange, 'aria-label': ariaLabel}) =>
        <input type="checkbox" checked={checked} onChange={onChange} aria-label={ariaLabel}/>,
    FormControlLabel: ({control, label}) => <label>{control}{label}</label>,
    Typography: ({children}) => <span>{children}</span>,
    TextField: ({value, onChange, 'aria-label': ariaLabel, multiline, placeholder, rows, sx}) => {
        if (multiline) {
            return <textarea aria-label={ariaLabel} value={value} onChange={onChange} placeholder={placeholder}
                             rows={rows}/>;
        }
        return <input aria-label={ariaLabel} value={value} onChange={onChange} placeholder={placeholder}/>;
    },
    Box: ({children}) => <div>{children}</div>,
}));

describe('ActionDialogs', () => {
    const onClose = jest.fn();
    const onConfirm = jest.fn();
    const defaultSetState = jest.fn();

    afterEach(() => jest.clearAllMocks());

    // Helper to test dialogs with a single checkbox and a confirm button
    function testCheckboxDialog(DialogComponent, dialogTitleText, confirmLabel = 'Confirm') {
        test(`${dialogTitleText} enables confirm when checked`, () => {
            let checked = false;
            const setChecked = jest.fn(val => checked = val);
            const {rerender} = render(
                <DialogComponent open onClose={onClose} onConfirm={onConfirm}
                                 checked={checked} setChecked={setChecked} disabled={false}/>
            );

            const buttonName = confirmLabel === 'Confirm' ? /Confirm/i : new RegExp(`Confirm ${confirmLabel.toLowerCase()}`, 'i');
            const confirmBtn = screen.getByRole('button', {name: buttonName});
            expect(confirmBtn).toBeDisabled();

            // Check the box
            fireEvent.click(screen.getByRole('checkbox'));
            expect(setChecked).toHaveBeenCalledWith(true);

            // Simulate parent updating checked prop
            rerender(
                <DialogComponent open onClose={onClose} onConfirm={onConfirm}
                                 checked={true} setChecked={setChecked} disabled={false}/>
            );
            expect(confirmBtn).not.toBeDisabled();

            fireEvent.click(confirmBtn);
            expect(onConfirm).toHaveBeenCalled();
        });

        test(`${dialogTitleText} calls onClose when cancel button is clicked`, () => {
            render(
                <DialogComponent open onClose={onClose} onConfirm={onConfirm}
                                 checked={true} setChecked={defaultSetState} disabled={false}/>
            );
            const cancelBtn = screen.getByRole('button', {name: /Cancel/i});
            fireEvent.click(cancelBtn);
            expect(onClose).toHaveBeenCalled();
        });

        test(`${dialogTitleText} confirm button is disabled when disabled prop is true`, () => {
            render(
                <DialogComponent open onClose={onClose} onConfirm={onConfirm}
                                 checked={true} setChecked={defaultSetState} disabled={true}/>
            );
            const buttonName = confirmLabel === 'Confirm' ? /Confirm/i : new RegExp(`Confirm ${confirmLabel.toLowerCase()}`, 'i');
            const confirmBtn = screen.getByRole('button', {name: buttonName});
            expect(confirmBtn).toBeDisabled();
        });
    }

    // Tests for simple checkbox dialogs
    testCheckboxDialog(FreezeDialog, 'Confirm Freeze');
    testCheckboxDialog(StopDialog, 'Confirm Stop', 'Stop');
    testCheckboxDialog(RestartDialog, 'Confirm Restart', 'Restart');
    testCheckboxDialog(ClearDialog, 'Confirm Clear');
    testCheckboxDialog(DrainDialog, 'Confirm Drain');
    testCheckboxDialog(SwitchDialog, 'Confirm Switch');
    testCheckboxDialog(GivebackDialog, 'Confirm Giveback');

    // ----- UnprovisionDialog specific tests (including isNodeAction branch) -----
    describe('UnprovisionDialog', () => {
        const baseCheckboxes = {dataLoss: false, clusterwide: false, serviceInterruption: false};
        const setCheckboxes = jest.fn();

        afterEach(() => jest.clearAllMocks());

        test('requires all three checkboxes when not a node action (clusterwide appears)', () => {
            let checkboxes = {...baseCheckboxes};
            const setCb = jest.fn(updater => {
                checkboxes = updater(checkboxes);
            });
            const {rerender} = render(
                <UnprovisionDialog open pendingAction={{}} onClose={onClose} onConfirm={onConfirm}
                                   checkboxes={checkboxes} setCheckboxes={setCb} disabled={false}/>
            );

            const confirmBtn = screen.getByRole('button', {name: /Confirm unprovision action/i});
            expect(confirmBtn).toBeDisabled();

            // Check each checkbox individually
            fireEvent.click(screen.getByLabelText(/I understand data will be lost/i));
            fireEvent.click(screen.getByLabelText(/I understand the selected services may be temporarily interrupted/i));
            fireEvent.click(screen.getByLabelText(/I understand this action will be orchestrated clusterwide/i));

            // Simulate state updates
            rerender(
                <UnprovisionDialog open pendingAction={{}} onClose={onClose} onConfirm={onConfirm}
                                   checkboxes={{dataLoss: true, clusterwide: true, serviceInterruption: true}}
                                   setCheckboxes={setCb} disabled={false}/>
            );
            expect(confirmBtn).not.toBeDisabled();
            fireEvent.click(confirmBtn);
            expect(onConfirm).toHaveBeenCalled();
        });

        test('requires only dataLoss and serviceInterruption when isNodeAction is true (no clusterwide checkbox)', () => {
            let checkboxes = {dataLoss: false, clusterwide: false, serviceInterruption: false};
            const setCb = jest.fn(updater => {
                checkboxes = updater(checkboxes);
            });
            const pendingAction = {node: 'some-node'}; // makes isNodeAction true

            const {rerender} = render(
                <UnprovisionDialog open pendingAction={pendingAction} onClose={onClose} onConfirm={onConfirm}
                                   checkboxes={checkboxes} setCheckboxes={setCb} disabled={false}/>
            );

            // Clusterwide checkbox should NOT be present
            expect(screen.queryByLabelText(/I understand this action will be orchestrated clusterwide/i)).not.toBeInTheDocument();

            const confirmBtn = screen.getByRole('button', {name: /Confirm unprovision action/i});
            expect(confirmBtn).toBeDisabled();

            // Check only dataLoss and serviceInterruption
            fireEvent.click(screen.getByLabelText(/I understand data will be lost/i));
            fireEvent.click(screen.getByLabelText(/I understand the selected services may be temporarily interrupted/i));

            rerender(
                <UnprovisionDialog open pendingAction={pendingAction} onClose={onClose} onConfirm={onConfirm}
                                   checkboxes={{dataLoss: true, clusterwide: false, serviceInterruption: true}}
                                   setCheckboxes={setCb} disabled={false}/>
            );
            expect(confirmBtn).not.toBeDisabled();
            fireEvent.click(confirmBtn);
            expect(onConfirm).toHaveBeenCalled();
        });

        test('calls onClose when cancel is clicked', () => {
            render(
                <UnprovisionDialog open pendingAction={{}} onClose={onClose} onConfirm={onConfirm}
                                   checkboxes={baseCheckboxes} setCheckboxes={setCheckboxes} disabled={false}/>
            );
            fireEvent.click(screen.getByRole('button', {name: /Cancel/i}));
            expect(onClose).toHaveBeenCalled();
        });

        test('confirm button disabled when disabled prop is true', () => {
            render(
                <UnprovisionDialog open pendingAction={{}} onClose={onClose} onConfirm={onConfirm}
                                   checkboxes={{dataLoss: true, clusterwide: true, serviceInterruption: true}}
                                   setCheckboxes={setCheckboxes} disabled={true}/>
            );
            const confirmBtn = screen.getByRole('button', {name: /Confirm unprovision action/i});
            expect(confirmBtn).toBeDisabled();
        });
    });

    // ----- PurgeDialog -----
    describe('PurgeDialog', () => {
        const baseCheckboxes = {dataLoss: false, configLoss: false, serviceInterruption: false};
        const setCheckboxes = jest.fn();

        test('requires all three checkboxes', () => {
            let checkboxes = {...baseCheckboxes};
            const setCb = jest.fn(updater => {
                checkboxes = updater(checkboxes);
            });
            const {rerender} = render(
                <PurgeDialog open onClose={onClose} onConfirm={onConfirm}
                             checkboxes={checkboxes} setCheckboxes={setCb} disabled={false}/>
            );
            const confirmBtn = screen.getByRole('button', {name: /Confirm purge action/i});
            expect(confirmBtn).toBeDisabled();

            fireEvent.click(screen.getByLabelText(/I understand data will be lost/i));
            fireEvent.click(screen.getByLabelText(/I understand the configuration will be lost/i));
            fireEvent.click(screen.getByLabelText(/I understand the selected services may be temporarily interrupted/i));

            rerender(
                <PurgeDialog open onClose={onClose} onConfirm={onConfirm}
                             checkboxes={{dataLoss: true, configLoss: true, serviceInterruption: true}}
                             setCheckboxes={setCb} disabled={false}/>
            );
            expect(confirmBtn).not.toBeDisabled();
            fireEvent.click(confirmBtn);
            expect(onConfirm).toHaveBeenCalled();
        });

        test('calls onClose on cancel', () => {
            render(
                <PurgeDialog open onClose={onClose} onConfirm={onConfirm}
                             checkboxes={baseCheckboxes} setCheckboxes={setCheckboxes} disabled={false}/>
            );
            fireEvent.click(screen.getByRole('button', {name: /Cancel/i}));
            expect(onClose).toHaveBeenCalled();
        });
    });

    // ----- DeleteDialog -----
    describe('DeleteDialog', () => {
        const baseCheckboxes = {configLoss: false, clusterwide: false};
        const setCheckboxes = jest.fn();

        test('requires both checkboxes', () => {
            let checkboxes = {...baseCheckboxes};
            const setCb = jest.fn(updater => {
                checkboxes = updater(checkboxes);
            });
            const {rerender} = render(
                <DeleteDialog open onClose={onClose} onConfirm={onConfirm}
                              checkboxes={checkboxes} setCheckboxes={setCb} disabled={false}/>
            );
            const confirmBtn = screen.getByRole('button', {name: /Confirm delete action/i});
            expect(confirmBtn).toBeDisabled();

            fireEvent.click(screen.getByLabelText(/I understand the configuration will be lost/i));
            fireEvent.click(screen.getByLabelText(/I understand this action will be orchestrated clusterwide/i));

            rerender(
                <DeleteDialog open onClose={onClose} onConfirm={onConfirm}
                              checkboxes={{configLoss: true, clusterwide: true}}
                              setCheckboxes={setCb} disabled={false}/>
            );
            expect(confirmBtn).not.toBeDisabled();
            fireEvent.click(confirmBtn);
            expect(onConfirm).toHaveBeenCalled();
        });

        test('calls onClose on cancel', () => {
            render(
                <DeleteDialog open onClose={onClose} onConfirm={onConfirm}
                              checkboxes={baseCheckboxes} setCheckboxes={setCheckboxes} disabled={false}/>
            );
            fireEvent.click(screen.getByRole('button', {name: /Cancel/i}));
            expect(onClose).toHaveBeenCalled();
        });
    });

    // ----- DeleteKeyDialog -----
    describe('DeleteKeyDialog', () => {
        test('shows key and calls onConfirm on delete, onClose on cancel', () => {
            render(<DeleteKeyDialog open onClose={onClose} onConfirm={onConfirm}
                                    keyToDelete="MY_SECRET_KEY" disabled={false}/>);
            expect(screen.getByText(/MY_SECRET_KEY/)).toBeInTheDocument();

            const deleteBtn = screen.getByRole('button', {name: /Delete/i});
            fireEvent.click(deleteBtn);
            expect(onConfirm).toHaveBeenCalled();

            const cancelBtn = screen.getByRole('button', {name: /Cancel/i});
            fireEvent.click(cancelBtn);
            expect(onClose).toHaveBeenCalled();
        });

        test('delete button is disabled when disabled prop is true', () => {
            render(<DeleteKeyDialog open onClose={onClose} onConfirm={onConfirm}
                                    keyToDelete="KEY" disabled={true}/>);
            expect(screen.getByRole('button', {name: /Delete/i})).toBeDisabled();
        });
    });

    // ----- CreateKeyDialog -----
    describe('CreateKeyDialog', () => {
        const defaultProps = {
            open: true,
            onClose,
            onConfirm,
            newKeyName: '',
            setNewKeyName: jest.fn(),
            newKeyFile: null,
            setNewKeyFile: jest.fn(),
            disabled: false,
        };

        test('requires key name and file to enable Create button', () => {
            let props = {...defaultProps};
            const {rerender} = render(<CreateKeyDialog {...props} />);
            const nameInput = screen.getByRole('textbox', {name: /Key Name/i});
            const createBtn = screen.getByRole('button', {name: /Create/i});
            expect(createBtn).toBeDisabled();

            // Fill name only
            fireEvent.change(nameInput, {target: {value: 'mykey'}});
            expect(props.setNewKeyName).toHaveBeenCalledWith('mykey');
            // Create still disabled without file
            rerender(<CreateKeyDialog {...props} newKeyName="mykey"/>);
            expect(createBtn).toBeDisabled();

            // Simulate file selection
            const file = new File(['file content'], 'key.pem', {type: 'text/plain'});
            const fileInput = document.getElementById('create-key-file-upload');
            // Since input is hidden, we need to get it by id
            fireEvent.change(fileInput, {target: {files: [file]}});
            expect(props.setNewKeyFile).toHaveBeenCalledWith(file);

            rerender(<CreateKeyDialog {...props} newKeyName="mykey" newKeyFile={file}/>);
            expect(createBtn).not.toBeDisabled();

            fireEvent.click(createBtn);
            expect(onConfirm).toHaveBeenCalled();
        });

        test('calls onClose when cancel is clicked', () => {
            render(<CreateKeyDialog {...defaultProps} />);
            fireEvent.click(screen.getByRole('button', {name: /Cancel/i}));
            expect(onClose).toHaveBeenCalled();
        });

        test('Create button is disabled when disabled prop is true', () => {
            render(<CreateKeyDialog {...defaultProps} disabled={true} newKeyName="key" newKeyFile={{}}/>);
            expect(screen.getByRole('button', {name: /Create/i})).toBeDisabled();
        });
    });

    // ----- UpdateConfigDialog -----
    describe('UpdateConfigDialog', () => {
        const defaultProps = {
            open: true,
            onClose,
            onConfirm,
            newConfigFile: null,
            setNewConfigFile: jest.fn(),
            disabled: false,
        };

        test('enables Update button only when a file is selected', () => {
            let props = {...defaultProps};
            const {rerender} = render(<UpdateConfigDialog {...props} />);
            const updateBtn = screen.getByRole('button', {name: /Update/i});
            expect(updateBtn).toBeDisabled();

            // Simulate file selection
            const file = new File(['config'], 'config.yaml', {type: 'text/yaml'});
            const fileInput = document.getElementById('update-config-file-upload');
            fireEvent.change(fileInput, {target: {files: [file]}});
            expect(props.setNewConfigFile).toHaveBeenCalledWith(file);

            rerender(<UpdateConfigDialog {...props} newConfigFile={file}/>);
            expect(updateBtn).not.toBeDisabled();

            fireEvent.click(updateBtn);
            expect(onConfirm).toHaveBeenCalled();
        });

        test('calls onClose on cancel', () => {
            render(<UpdateConfigDialog {...defaultProps} />);
            fireEvent.click(screen.getByRole('button', {name: /Cancel/i}));
            expect(onClose).toHaveBeenCalled();
        });

        test('Update button disabled when disabled prop is true', () => {
            render(<UpdateConfigDialog {...defaultProps} disabled={true} newConfigFile={{name: 'cfg'}}/>);
            expect(screen.getByRole('button', {name: /Update/i})).toBeDisabled();
        });
    });

    // ----- ManageConfigParamsDialog -----
    describe('ManageConfigParamsDialog', () => {
        const defaultProps = {
            open: true,
            onClose,
            onConfirm,
            paramsToSet: '',
            setParamsToSet: jest.fn(),
            paramsToUnset: '',
            setParamsToUnset: jest.fn(),
            paramsToDelete: '',
            setParamsToDelete: jest.fn(),
            disabled: false,
        };

        test('enables Apply button when any of the three fields has content', () => {
            let props = {...defaultProps};
            const {rerender} = render(<ManageConfigParamsDialog {...props} />);
            const applyBtn = screen.getByRole('button', {name: /Apply/i});
            expect(applyBtn).toBeDisabled();

            // Only paramsToSet
            rerender(<ManageConfigParamsDialog {...props} paramsToSet="a=b"/>);
            expect(applyBtn).not.toBeDisabled();

            // Reset
            rerender(<ManageConfigParamsDialog {...props} paramsToSet="" paramsToUnset="section.key"/>);
            expect(applyBtn).not.toBeDisabled();

            rerender(<ManageConfigParamsDialog {...props} paramsToSet="" paramsToUnset="" paramsToDelete="section"/>);
            expect(applyBtn).not.toBeDisabled();

            fireEvent.click(applyBtn);
            expect(onConfirm).toHaveBeenCalled();
        });

        test('calls onClose on cancel', () => {
            render(<ManageConfigParamsDialog {...defaultProps} />);
            fireEvent.click(screen.getByRole('button', {name: /Cancel/i}));
            expect(onClose).toHaveBeenCalled();
        });

        test('Apply button disabled when disabled prop is true', () => {
            render(<ManageConfigParamsDialog {...defaultProps} disabled={true} paramsToSet="a=b"/>);
            expect(screen.getByRole('button', {name: /Apply/i})).toBeDisabled();
        });

        test('textarea fields handle multiline input', () => {
            const setParamsToSet = jest.fn();
            render(
                <ManageConfigParamsDialog
                    {...defaultProps}
                    paramsToSet=""
                    setParamsToSet={setParamsToSet}
                />
            );
            const textarea = screen.getByRole('textbox', {name: /Parameters to set/i});
            fireEvent.change(textarea, {target: {value: 'key1=val1\nkey2=val2'}});
            expect(setParamsToSet).toHaveBeenCalledWith('key1=val1\nkey2=val2');
        });
    });

    // ----- SimpleConfirmDialog -----
    describe('SimpleConfirmDialog', () => {
        test('renders action and target, calls onConfirm and onClose', () => {
            render(<SimpleConfirmDialog open onClose={onClose} onConfirm={onConfirm} action="reboot" target="node-1"/>);

            expect(screen.getByText(/Confirm reboot/i)).toBeInTheDocument();

            expect(screen.getByText(/Are you sure you want to/i)).toBeInTheDocument();

            const confirmBtn = screen.getByRole('button', {name: /Confirm reboot action/i});
            fireEvent.click(confirmBtn);
            expect(onConfirm).toHaveBeenCalled();

            const cancelBtn = screen.getByRole('button', {name: /Cancel/i});
            fireEvent.click(cancelBtn);
            expect(onClose).toHaveBeenCalled();
        });
    });
});
