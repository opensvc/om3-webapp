import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {
    FreezeDialog, StopDialog, RestartDialog, ClearDialog, DrainDialog,
    UnprovisionDialog, PurgeDialog, DeleteDialog, SwitchDialog, GivebackDialog,
    DeleteKeyDialog, CreateKeyDialog, UpdateKeyDialog, UpdateConfigDialog,
    ManageConfigParamsDialog, SimpleConfirmDialog,
} from '../ActionDialogs';

// Mock MUI components to simplify rendering and add accessibility labels
jest.mock('@mui/material', () => ({
    Dialog: ({open, children}) => (open ? <div>{children}</div> : null),
    DialogTitle: ({children}) => <h2>{children}</h2>,
    DialogContent: ({children}) => <div>{children}</div>,
    DialogActions: ({children}) => <div>{children}</div>,
    Button: ({onClick, disabled, children, 'aria-label': ariaLabel}) =>
        <button onClick={onClick} disabled={disabled} aria-label={ariaLabel}>{children}</button>,
    Checkbox: ({checked, onChange, 'aria-label': ariaLabel}) =>
        <input type="checkbox" checked={checked} onChange={onChange} aria-label={ariaLabel}/>,
    FormControlLabel: ({control, label}) => <label>{control}{label}</label>,
    Typography: ({children}) => <span>{children}</span>,
    TextField: ({value, onChange, 'aria-label': ariaLabel}) =>
        <input aria-label={ariaLabel} value={value} onChange={onChange}/>,
    Box: ({children}) => <div>{children}</div>,
}));

describe('ActionDialogs', () => {
    const onClose = jest.fn();
    const onConfirm = jest.fn();

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
            // Confirm starts disabled
            expect(screen.getByText(confirmLabel).closest('button')).toBeDisabled();

            // Check the box
            fireEvent.click(screen.getByRole('checkbox'));
            expect(setChecked).toHaveBeenCalledWith(true);

            // Simulate parent updating checked prop
            rerender(
                <DialogComponent open onClose={onClose} onConfirm={onConfirm}
                                 checked={true} setChecked={setChecked} disabled={false}/>
            );
            const btn = screen.getByText(confirmLabel);
            expect(btn.closest('button')).not.toBeDisabled();

            fireEvent.click(btn);
            expect(onConfirm).toHaveBeenCalled();
        });
    }

    // Tests for simple checkbox dialogs (adjust confirm label accordingly)
    testCheckboxDialog(FreezeDialog, 'Confirm Freeze');
    testCheckboxDialog(StopDialog, 'Confirm Stop', 'Stop');
    testCheckboxDialog(RestartDialog, 'Confirm Restart', 'Restart');
    testCheckboxDialog(ClearDialog, 'Confirm Clear');
    testCheckboxDialog(DrainDialog, 'Confirm Drain');
    testCheckboxDialog(SwitchDialog, 'Confirm Switch');
    testCheckboxDialog(GivebackDialog, 'Confirm Giveback');


    test('UnprovisionDialog requires all checkboxes', async () => {
        const cb = {dataLoss: false, clusterwide: false, serviceInterruption: false};
        const setCb = jest.fn(newState => Object.assign(cb, newState));

        const {rerender} = render(
            <UnprovisionDialog open pendingAction={{}} onClose={onClose} onConfirm={onConfirm}
                               checkboxes={cb} setCheckboxes={setCb} disabled={false}/>
        );

        const confirmBtn = screen.getByRole('button', {name: /Confirm unprovision action/i});
        expect(confirmBtn).toBeDisabled();

        // Simuler les clics et mettre à jour les props
        fireEvent.click(screen.getByLabelText(/Confirm data loss/i));
        fireEvent.click(screen.getByLabelText(/Confirm service interruption/i));
        fireEvent.click(screen.getByLabelText(/Confirm clusterwide orchestration/i));

        // Re-rendre avec les nouvelles valeurs
        rerender(
            <UnprovisionDialog open pendingAction={{}} onClose={onClose} onConfirm={onConfirm}
                               checkboxes={{
                                   dataLoss: true,
                                   clusterwide: true,
                                   serviceInterruption: true
                               }}
                               setCheckboxes={setCb}
                               disabled={false}/>
        );

        expect(setCb).toHaveBeenCalledTimes(3);
        expect(confirmBtn).not.toBeDisabled();

        fireEvent.click(confirmBtn);
        expect(onConfirm).toHaveBeenCalled();
    });

    test('PurgeDialog requires 3 checkboxes', async () => {
        const cb = {dataLoss: false, configLoss: false, serviceInterruption: false};
        const setCb = jest.fn(newState => Object.assign(cb, newState));

        const {rerender} = render(
            <PurgeDialog open onClose={onClose} onConfirm={onConfirm}
                         checkboxes={cb} setCheckboxes={setCb} disabled={false}/>
        );

        const confirmBtn = screen.getByRole('button', {name: /Confirm purge action/i});
        expect(confirmBtn).toBeDisabled();

        // Simuler les clics et mettre à jour les props
        fireEvent.click(screen.getByLabelText(/Confirm data loss/i));
        fireEvent.click(screen.getByLabelText(/Confirm configuration loss/i));
        fireEvent.click(screen.getByLabelText(/Confirm service interruption/i));

        // Re-rendre avec les nouvelles valeurs
        rerender(
            <PurgeDialog open onClose={onClose} onConfirm={onConfirm}
                         checkboxes={{
                             dataLoss: true,
                             configLoss: true,
                             serviceInterruption: true
                         }}
                         setCheckboxes={setCb}
                         disabled={false}/>
        );

        expect(setCb).toHaveBeenCalledTimes(3);
        expect(confirmBtn).not.toBeDisabled();

        fireEvent.click(confirmBtn);
        expect(onConfirm).toHaveBeenCalled();
    });

    test('DeleteDialog requires both checkboxes', async () => {
        const cb = {configLoss: false, clusterwide: false};
        const setCb = jest.fn(newState => Object.assign(cb, newState));

        const {rerender} = render(
            <DeleteDialog open onClose={onClose} onConfirm={onConfirm}
                          checkboxes={cb} setCheckboxes={setCb} disabled={false}/>
        );

        const confirmBtn = screen.getByRole('button', {name: /Confirm delete action/i});
        expect(confirmBtn).toBeDisabled();

        // Simuler les clics et mettre à jour les props
        fireEvent.click(screen.getByLabelText(/Confirm configuration loss/i));
        fireEvent.click(screen.getByLabelText(/Confirm clusterwide orchestration/i));

        // Re-rendre avec les nouvelles valeurs
        rerender(
            <DeleteDialog open onClose={onClose} onConfirm={onConfirm}
                          checkboxes={{
                              configLoss: true,
                              clusterwide: true
                          }}
                          setCheckboxes={setCb}
                          disabled={false}/>
        );

        expect(setCb).toHaveBeenCalledTimes(2);
        expect(confirmBtn).not.toBeDisabled();

        fireEvent.click(confirmBtn);
        expect(onConfirm).toHaveBeenCalled();
    });

    test('DeleteKeyDialog shows key and enables delete', () => {
        render(<DeleteKeyDialog open onClose={onClose} onConfirm={onConfirm}
                                keyToDelete="SECRET_KEY" disabled={false}/>);
        expect(screen.getByText(/SECRET_KEY/)).toBeInTheDocument();

        const deleteBtn = screen.getByRole('button', {name: /Delete/i});
        fireEvent.click(deleteBtn);
        expect(onConfirm).toHaveBeenCalled();
    });

    test('CreateKeyDialog requires name and file', () => {
        let name = '', file = null;
        const setName = jest.fn(v => name = v);
        const setFile = jest.fn(v => file = v);

        const {rerender} = render(
            <CreateKeyDialog open onClose={onClose} onConfirm={onConfirm}
                             newKeyName={name} setNewKeyName={setName}
                             newKeyFile={file} setNewKeyFile={setFile}
                             disabled={false}/>
        );

        const inputName = screen.getByRole('textbox', {name: /Key Name/i});
        expect(inputName).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /Create/i})).toBeDisabled();

        fireEvent.change(inputName, {target: {value: 'KEY'}});
        expect(setName).toHaveBeenCalledWith('KEY');

        // File input simulation is limited, just check button exists
        fireEvent.click(screen.getByRole('button', {name: /Create/i}));
        expect(onConfirm).not.toHaveBeenCalled();

        // Simulate both name and file set to enable confirm
        rerender(
            <CreateKeyDialog open onClose={onClose} onConfirm={onConfirm}
                             newKeyName="KEY" setNewKeyName={setName}
                             newKeyFile={{name: 'file.key'}} setNewKeyFile={setFile}
                             disabled={false}/>
        );

        const createBtn = screen.getByRole('button', {name: /Create/i});
        expect(createBtn).not.toBeDisabled();

        fireEvent.click(createBtn);
        expect(onConfirm).toHaveBeenCalled();
    });

    test('UpdateConfigDialog enables update only with file', () => {
        let file = null;
        const setFile = jest.fn(v => file = v);
        const {rerender} = render(
            <UpdateConfigDialog open onClose={onClose} onConfirm={onConfirm}
                                newConfigFile={file} setNewConfigFile={setFile} disabled={false}/>
        );
        const updateBtn = screen.getByRole('button', {name: /Update/i});
        expect(updateBtn).toBeDisabled();

        rerender(
            <UpdateConfigDialog open onClose={onClose} onConfirm={onConfirm}
                                newConfigFile={{name: 'cfg.yml'}}
                                setNewConfigFile={setFile} disabled={false}/>
        );
        expect(updateBtn).not.toBeDisabled();

        fireEvent.click(updateBtn);
        expect(onConfirm).toHaveBeenCalled();
    });

    test('ManageConfigParamsDialog enables apply when params present', () => {
        let set1 = '', set2 = '', set3 = '';
        const funcs = {
            setParamsToSet: v => set1 = v,
            setParamsToUnset: v => set2 = v,
            setParamsToDelete: v => set3 = v,
        };
        const {rerender} = render(
            <ManageConfigParamsDialog open onClose={onClose} onConfirm={onConfirm}
                                      paramsToSet={set1} setParamsToSet={funcs.setParamsToSet}
                                      paramsToUnset={set2} setParamsToUnset={funcs.setParamsToUnset}
                                      paramsToDelete={set3} setParamsToDelete={funcs.setParamsToDelete}
                                      disabled={false}/>
        );
        const applyBtn = screen.getByRole('button', {name: /Apply/i});
        expect(applyBtn).toBeDisabled();

        rerender(
            <ManageConfigParamsDialog open onClose={onClose} onConfirm={onConfirm}
                                      paramsToSet="a=b" setParamsToSet={funcs.setParamsToSet}
                                      paramsToUnset="" setParamsToUnset={funcs.setParamsToUnset}
                                      paramsToDelete="" setParamsToDelete={funcs.setParamsToDelete}
                                      disabled={false}/>
        );
        expect(applyBtn).not.toBeDisabled();

        fireEvent.click(applyBtn);
        expect(onConfirm).toHaveBeenCalled();
    });

    test('SimpleConfirmDialog shows action and deletes', () => {
        render(<SimpleConfirmDialog open onClose={onClose} onConfirm={onConfirm} action="foo" target="bar"/>);
        expect(screen.getByText(/Confirm foo/i)).toBeInTheDocument();
        const confirmBtn = screen.getByRole('button', {name: /Confirm/i});
        fireEvent.click(confirmBtn);
        expect(onConfirm).toHaveBeenCalled();
    });
});
