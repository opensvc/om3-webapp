import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {vi, describe, test, expect, beforeEach, afterEach} from 'vitest';
import ActionDialogManager, {ConsoleDialog, SimpleConfirmDialog} from '../ActionDialogManager';

// ── Mocks ──────────────────────────────────────────────────────────────
vi.mock('@mui/material', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        Dialog: ({open, children, ...props}) =>
            open ? (
                <div data-testid="mock-dialog" {...props}>
                    {children}
                </div>
            ) : null,
        TextField: ({label, value, onChange, helperText, inputProps, ...props}) => {
            const testId = label?.toLowerCase()?.replace(/\s+/g, '-') + '-input';
            const helperTestId = label?.toLowerCase()?.replace(/\s+/g, '-') + '-helper';
            const inputId = props.id || `textfield-${label}`;
            return (
                <div>
                    <label htmlFor={inputId}>{label}</label>
                    <input
                        id={inputId}
                        type="text"
                        value={value}
                        onChange={onChange}
                        data-testid={testId}
                        {...inputProps}
                    />
                    {helperText && <span data-testid={helperTestId}>{helperText}</span>}
                </div>
            );
        },
    };
});

vi.mock('../ActionDialogs', () => ({
    FreezeDialog: vi.fn((props) =>
        props.open ? (
            <div data-testid="freeze-dialog">
                <button onClick={props.onClose}>Cancel</button>
                <button onClick={props.onConfirm} disabled={props.disabled}>Confirm</button>
                <input type="checkbox" checked={props.checked}
                       onChange={(e) => props.setChecked(e.target.checked)}
                       data-testid="freeze-checkbox"/>
                <span>{props.pendingAction?.action}</span>
                <span>{props.target}</span>
            </div>
        ) : null
    ),
    StopDialog: vi.fn((props) =>
        props.open ? (
            <div data-testid="stop-dialog">
                <button onClick={props.onClose}>Cancel</button>
                <button onClick={props.onConfirm} disabled={props.disabled}>Confirm</button>
                <input type="checkbox" checked={props.checked}
                       onChange={(e) => props.setChecked(e.target.checked)}
                       data-testid="stop-checkbox"/>
                <span>{props.pendingAction?.action}</span>
                <span>{props.target}</span>
            </div>
        ) : null
    ),
    UnprovisionDialog: vi.fn((props) =>
        props.open ? (
            <div data-testid="unprovision-dialog">
                <button onClick={props.onClose}>Cancel</button>
                <button onClick={props.onConfirm} disabled={props.disabled}>Confirm</button>
                <input type="checkbox" checked={props.checkboxes.dataLoss}
                       onChange={(e) => props.setCheckboxes({...props.checkboxes, dataLoss: e.target.checked})}
                       data-testid="unprovision-dataLoss-checkbox"/>
                <input type="checkbox" checked={props.checkboxes.serviceInterruption}
                       onChange={(e) => props.setCheckboxes({
                           ...props.checkboxes,
                           serviceInterruption: e.target.checked
                       })}
                       data-testid="unprovision-serviceInterruption-checkbox"/>
                {!props.pendingAction?.node && (
                    <input type="checkbox" checked={props.checkboxes.clusterwide}
                           onChange={(e) => props.setCheckboxes({...props.checkboxes, clusterwide: e.target.checked})}
                           data-testid="unprovision-clusterwide-checkbox"/>
                )}
                <span>{props.pendingAction?.action}</span>
                <span>{props.target}</span>
            </div>
        ) : null
    ),
    PurgeDialog: vi.fn((props) =>
        props.open ? (
            <div data-testid="purge-dialog">
                <button onClick={props.onClose}>Cancel</button>
                <button onClick={props.onConfirm} disabled={props.disabled}>Confirm</button>
                <input type="checkbox" checked={props.checkboxes.dataLoss}
                       onChange={(e) => props.setCheckboxes({...props.checkboxes, dataLoss: e.target.checked})}
                       data-testid="purge-dataLoss-checkbox"/>
                <input type="checkbox" checked={props.checkboxes.configLoss}
                       onChange={(e) => props.setCheckboxes({...props.checkboxes, configLoss: e.target.checked})}
                       data-testid="purge-configLoss-checkbox"/>
                <input type="checkbox" checked={props.checkboxes.serviceInterruption}
                       onChange={(e) => props.setCheckboxes({
                           ...props.checkboxes,
                           serviceInterruption: e.target.checked
                       })}
                       data-testid="purge-serviceInterruption-checkbox"/>
                <span>{props.pendingAction?.action}</span>
                <span>{props.target}</span>
            </div>
        ) : null
    ),
    DeleteDialog: vi.fn((props) =>
        props.open ? (
            <div data-testid="delete-dialog">
                <button onClick={props.onClose}>Cancel</button>
                <button onClick={props.onConfirm} disabled={props.disabled}>Confirm</button>
                <input type="checkbox" checked={props.checkboxes.configLoss}
                       onChange={(e) => props.setCheckboxes({...props.checkboxes, configLoss: e.target.checked})}
                       data-testid="delete-configLoss-checkbox"/>
                <input type="checkbox" checked={props.checkboxes.clusterwide}
                       onChange={(e) => props.setCheckboxes({...props.checkboxes, clusterwide: e.target.checked})}
                       data-testid="delete-clusterwide-checkbox"/>
                <span>{props.pendingAction?.action}</span>
                <span>{props.target}</span>
            </div>
        ) : null
    ),
    SwitchDialog: vi.fn((props) =>
        props.open ? (
            <div data-testid="switch-dialog">
                <button onClick={props.onClose}>Cancel</button>
                <button onClick={props.onConfirm} disabled={props.disabled}>Confirm</button>
                <input type="checkbox" checked={props.checked}
                       onChange={(e) => props.setChecked(e.target.checked)}
                       data-testid="switch-checkbox"/>
                <span>{props.pendingAction?.action}</span>
                <span>{props.target}</span>
            </div>
        ) : null
    ),
    GivebackDialog: vi.fn((props) =>
        props.open ? (
            <div data-testid="giveback-dialog">
                <button onClick={props.onClose}>Cancel</button>
                <button onClick={props.onConfirm} disabled={props.disabled}>Confirm</button>
                <input type="checkbox" checked={props.checked}
                       onChange={(e) => props.setChecked(e.target.checked)}
                       data-testid="giveback-checkbox"/>
                <span>{props.pendingAction?.action}</span>
                <span>{props.target}</span>
            </div>
        ) : null
    ),
}));

describe('ActionDialogManager', () => {
    const defaultProps = {
        pendingAction: null,
        handleConfirm: vi.fn(),
        target: 'test-target',
        supportedActions: [
            'freeze', 'stop', 'unprovision', 'purge',
            'delete', 'switch', 'giveback', 'console', 'other',
        ],
        onClose: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'log').mockImplementation(() => {
        });
        vi.spyOn(console, 'warn').mockImplementation(() => {
        });
        vi.spyOn(console, 'error').mockImplementation(() => {
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('renders without crashing when no pendingAction is provided', () => {
        render(<ActionDialogManager {...defaultProps} pendingAction={null}/>);
        expect(screen.queryByTestId('mock-dialog')).not.toBeInTheDocument();
        expect(defaultProps.onClose).toHaveBeenCalled();
    });

    test('handles null pendingAction without onClose prop', () => {
        render(<ActionDialogManager {...defaultProps} onClose={undefined} pendingAction={null}/>);
        expect(screen.queryByTestId('mock-dialog')).not.toBeInTheDocument();
    });

    test('handles invalid pendingAction without onClose prop', () => {
        render(<ActionDialogManager {...defaultProps} onClose={undefined} pendingAction={{}}/>);
        expect(screen.queryByTestId('mock-dialog')).not.toBeInTheDocument();
    });

    test('handles pendingAction with null action without onClose prop', () => {
        render(
            <ActionDialogManager
                {...defaultProps}
                onClose={undefined}
                pendingAction={{action: null}}
            />
        );
        expect(screen.queryByTestId('mock-dialog')).not.toBeInTheDocument();
    });

    test('handles pendingAction with non-string action without onClose prop', () => {
        render(
            <ActionDialogManager
                {...defaultProps}
                onClose={undefined}
                pendingAction={{action: 42}}
            />
        );
        expect(screen.queryByTestId('mock-dialog')).not.toBeInTheDocument();
    });

    test('handles unsupported action without onClose prop', () => {
        render(
            <ActionDialogManager
                {...defaultProps}
                onClose={undefined}
                pendingAction={{action: 'invalid'}}
                supportedActions={['freeze']}
            />
        );
        expect(screen.queryByTestId('mock-dialog')).not.toBeInTheDocument();
    });

    test('logs warning for invalid non-null pendingAction', () => {
        render(<ActionDialogManager {...defaultProps} pendingAction={{}}/>);
        expect(console.warn).toHaveBeenCalledWith('Invalid pendingAction provided:', {});
        expect(defaultProps.onClose).toHaveBeenCalled();
    });

    test('opens FreezeDialog when pendingAction is freeze', async () => {
        render(<ActionDialogManager {...defaultProps} pendingAction={{action: 'freeze'}}/>);
        const dialog = await screen.findByTestId('freeze-dialog');
        expect(dialog).toBeInTheDocument();
    });

    test('opens SimpleConfirmDialog for unknown action', async () => {
        render(<ActionDialogManager {...defaultProps} pendingAction={{action: 'other'}}/>);
        expect(await screen.findByText('Confirm Other')).toBeInTheDocument();
        expect(screen.getByText(/Are you sure you want to other on test-target\?/)).toBeInTheDocument();
    });

    test('closes dialog and calls onClose when Cancel is clicked', async () => {
        render(<ActionDialogManager {...defaultProps} pendingAction={{action: 'freeze'}}/>);
        await screen.findByTestId('freeze-dialog');
        fireEvent.click(screen.getByText('Cancel'));
        expect(defaultProps.onClose).toHaveBeenCalled();
    });

    test('updates checkbox and confirms freeze', async () => {
        render(<ActionDialogManager {...defaultProps} pendingAction={{action: 'freeze'}}/>);
        const checkbox = await screen.findByTestId('freeze-checkbox');
        fireEvent.click(checkbox);
        fireEvent.click(screen.getByText('Confirm'));
        expect(defaultProps.handleConfirm).toHaveBeenCalledWith('freeze');
    });

    test('handles unprovision checkboxes properly', async () => {
        render(
            <ActionDialogManager
                {...defaultProps}
                pendingAction={{action: 'unprovision', node: 'test-node'}}
            />
        );
        const dataLossCheckbox = await screen.findByTestId('unprovision-dataLoss-checkbox');
        const serviceInterruptionCheckbox = await screen.findByTestId('unprovision-serviceInterruption-checkbox');
        fireEvent.click(dataLossCheckbox);
        fireEvent.click(serviceInterruptionCheckbox);
        fireEvent.click(screen.getByText('Confirm'));
        expect(defaultProps.handleConfirm).toHaveBeenCalledWith('unprovision');
    });

    test('handles invalid setCheckboxes value for unprovision', async () => {
        const {UnprovisionDialog} = await import('../ActionDialogs');
        render(<ActionDialogManager {...defaultProps} pendingAction={{action: 'unprovision'}}/>);
        await screen.findByTestId('unprovision-dialog');
        const mockCall = UnprovisionDialog.mock.calls[0];
        expect(mockCall[0].setCheckboxes).toBeDefined();
        mockCall[0].setCheckboxes(null);
        expect(console.error).toHaveBeenCalledWith('setCheckboxes for unprovision received invalid value:', null);
    });

    test('ignores unsupported action and calls onClose', () => {
        render(
            <ActionDialogManager
                {...defaultProps}
                pendingAction={{action: 'invalid'}}
                supportedActions={['freeze']}
            />
        );
        expect(console.warn).toHaveBeenCalledWith('Unsupported action: invalid');
        expect(defaultProps.onClose).toHaveBeenCalled();
    });

    test('re-initializes dialog when pendingAction changes', async () => {
        const {rerender} = render(
            <ActionDialogManager {...defaultProps} pendingAction={{action: 'stop'}}/>
        );
        await screen.findByTestId('stop-dialog');
        rerender(<ActionDialogManager {...defaultProps} pendingAction={{action: 'freeze'}}/>);
        await screen.findByTestId('freeze-dialog');
    });

    test('handles delete dialog checkboxes correctly', async () => {
        render(<ActionDialogManager {...defaultProps} pendingAction={{action: 'delete'}}/>);
        await screen.findByTestId('delete-dialog');
        fireEvent.click(screen.getByTestId('delete-configLoss-checkbox'));
        fireEvent.click(screen.getByTestId('delete-clusterwide-checkbox'));
        fireEvent.click(screen.getByText('Confirm'));
        expect(defaultProps.handleConfirm).toHaveBeenCalledWith('delete');
    });

    test('handles switch dialog correctly', async () => {
        render(<ActionDialogManager {...defaultProps} pendingAction={{action: 'switch'}}/>);
        await screen.findByTestId('switch-dialog');
        fireEvent.click(screen.getByTestId('switch-checkbox'));
        fireEvent.click(screen.getByText('Confirm'));
        expect(defaultProps.handleConfirm).toHaveBeenCalledWith('switch');
    });

    test('handles giveback dialog correctly', async () => {
        render(<ActionDialogManager {...defaultProps} pendingAction={{action: 'giveback'}}/>);
        await screen.findByTestId('giveback-dialog');
        fireEvent.click(screen.getByTestId('giveback-checkbox'));
        fireEvent.click(screen.getByText('Confirm'));
        expect(defaultProps.handleConfirm).toHaveBeenCalledWith('giveback');
    });

    test('handles console dialog with detailed information', async () => {
        const consoleProps = {
            ...defaultProps,
            pendingAction: {action: 'console', rid: 'test-resource', node: 'test-node'},
            seats: 1, setSeats: vi.fn(), greetTimeout: '5s', setGreetTimeout: vi.fn(),
        };
        render(<ActionDialogManager {...consoleProps} />);
        await screen.findByTestId('mock-dialog');
        expect(screen.getByRole('heading', {level: 2, name: 'Open Console'})).toBeInTheDocument();
        const dialogContent = screen.getByTestId('mock-dialog').textContent;
        expect(dialogContent).toMatch(/Resource:.*test-resource/);
        expect(dialogContent).toMatch(/Node:.*test-node/);

        const seatsInput = screen.getByTestId('number-of-seats-input');
        const greetTimeoutInput = screen.getByTestId('greet-timeout-input');

        fireEvent.change(seatsInput, {target: {value: '2'}});
        expect(consoleProps.setSeats).toHaveBeenCalledWith(2);

        consoleProps.setSeats.mockClear();
        fireEvent.change(seatsInput, {target: {value: ''}});
        expect(consoleProps.setSeats).toHaveBeenCalledWith(1);

        consoleProps.setSeats.mockClear();
        fireEvent.change(seatsInput, {target: {value: 'abc'}});
        expect(consoleProps.setSeats).toHaveBeenCalledWith(1);

        fireEvent.change(greetTimeoutInput, {target: {value: '10s'}});
        expect(consoleProps.setGreetTimeout).toHaveBeenCalledWith('10s');

        fireEvent.click(screen.getByRole('button', {name: 'Open Console'}));
        expect(defaultProps.handleConfirm).toHaveBeenCalledWith('console');
    });

    test('handles console dialog without resource and node information', async () => {
        const consoleProps = {
            ...defaultProps,
            pendingAction: {action: 'console'},
            seats: 1, setSeats: vi.fn(), greetTimeout: '5s', setGreetTimeout: vi.fn(),
        };
        render(<ActionDialogManager {...consoleProps} />);
        await screen.findByTestId('mock-dialog');
        expect(screen.getByRole('heading', {level: 2, name: 'Open Console'})).toBeInTheDocument();
        expect(screen.queryByText(/Resource:/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Node:/)).not.toBeInTheDocument();
    });

    test('handles simpleConfirm fallback dialog', async () => {
        render(<ActionDialogManager {...defaultProps} pendingAction={{action: 'other'}}/>);
        expect(await screen.findByText('Confirm Other')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', {name: 'Confirm'}));
        expect(defaultProps.handleConfirm).toHaveBeenCalledWith('other');
    });

    test('handles purge dialog correctly', async () => {
        render(<ActionDialogManager {...defaultProps} pendingAction={{action: 'purge'}}/>);
        await screen.findByTestId('purge-dialog');
        fireEvent.click(screen.getByTestId('purge-dataLoss-checkbox'));
        fireEvent.click(screen.getByTestId('purge-configLoss-checkbox'));
        fireEvent.click(screen.getByTestId('purge-serviceInterruption-checkbox'));
        fireEvent.click(screen.getByText('Confirm'));
        expect(defaultProps.handleConfirm).toHaveBeenCalledWith('purge');
    });

    test('covers setCheckboxes branches for unprovision', async () => {
        const {UnprovisionDialog} = await import('../ActionDialogs');
        render(<ActionDialogManager {...defaultProps} pendingAction={{action: 'unprovision'}}/>);
        await screen.findByTestId('unprovision-dialog');
        const setCheckboxes = UnprovisionDialog.mock.calls[UnprovisionDialog.mock.calls.length - 1][0].setCheckboxes;
        setCheckboxes((prev) => ({...prev, dataLoss: true, extra: true}));
        setCheckboxes({serviceInterruption: true, invalidKey: false});
        setCheckboxes(42);
        expect(console.error).toHaveBeenCalledWith('setCheckboxes for unprovision received invalid value:', 42);
    });

    test('covers setCheckboxes branches for purge', async () => {
        const {PurgeDialog} = await import('../ActionDialogs');
        render(<ActionDialogManager {...defaultProps} pendingAction={{action: 'purge'}}/>);
        await screen.findByTestId('purge-dialog');
        const setCheckboxes = PurgeDialog.mock.calls[PurgeDialog.mock.calls.length - 1][0].setCheckboxes;
        setCheckboxes((prev) => ({...prev, dataLoss: true, extra: true}));
        setCheckboxes({configLoss: true, invalidKey: false});
        setCheckboxes(42);
        expect(console.error).toHaveBeenCalledWith('setCheckboxes for purge received invalid value:', 42);
    });

    test('covers setCheckboxes branches for delete', async () => {
        const {DeleteDialog} = await import('../ActionDialogs');
        render(<ActionDialogManager {...defaultProps} pendingAction={{action: 'delete'}}/>);
        await screen.findByTestId('delete-dialog');
        const setCheckboxes = DeleteDialog.mock.calls[DeleteDialog.mock.calls.length - 1][0].setCheckboxes;
        setCheckboxes((prev) => ({...prev, configLoss: true, extra: true}));
        setCheckboxes({clusterwide: true, invalidKey: false});
        setCheckboxes(42);
        expect(console.error).toHaveBeenCalledWith('setCheckboxes for delete received invalid value:', 42);
    });

    test('does not log warnings in production environment', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        render(<ActionDialogManager {...defaultProps} pendingAction={{}}/>);
        expect(console.warn).not.toHaveBeenCalled();
        render(
            <ActionDialogManager
                {...defaultProps}
                pendingAction={{action: 'invalid'}}
                supportedActions={[]}
            />
        );
        expect(console.warn).not.toHaveBeenCalled();
        process.env.NODE_ENV = originalEnv;
    });

    const dialogCases = [
        {action: 'freeze', checkbox: 'freeze-checkbox', dialog: 'freeze-dialog'},
        {action: 'stop', checkbox: 'stop-checkbox', dialog: 'stop-dialog'},
        {action: 'unprovision', checkbox: 'unprovision-dataLoss-checkbox', dialog: 'unprovision-dialog'},
        {action: 'purge', checkbox: 'purge-dataLoss-checkbox', dialog: 'purge-dialog'},
        {action: 'delete', checkbox: 'delete-configLoss-checkbox', dialog: 'delete-dialog'},
        {action: 'switch', checkbox: 'switch-checkbox', dialog: 'switch-dialog'},
        {action: 'giveback', checkbox: 'giveback-checkbox', dialog: 'giveback-dialog'},
    ];

    test.each(dialogCases)(
        'covers both branches of if (onClose) for $action dialog',
        async ({action, checkbox, dialog}) => {
            let {unmount} = render(
                <ActionDialogManager {...defaultProps} pendingAction={{action}}/>
            );
            await screen.findByTestId(dialog);
            fireEvent.click(screen.getByText('Cancel'));
            expect(defaultProps.onClose).toHaveBeenCalled();
            unmount();

            defaultProps.onClose.mockClear();
            defaultProps.handleConfirm.mockClear();
            ({unmount} = render(
                <ActionDialogManager {...defaultProps} pendingAction={{action}}/>
            ));
            await screen.findByTestId(dialog);
            if (checkbox) fireEvent.click(screen.getByTestId(checkbox));
            fireEvent.click(screen.getByText('Confirm'));
            expect(defaultProps.handleConfirm).toHaveBeenCalledWith(action);
            expect(defaultProps.onClose).toHaveBeenCalled();
            unmount();

            const propsNoClose = {...defaultProps, onClose: undefined};
            ({unmount} = render(
                <ActionDialogManager {...propsNoClose} pendingAction={{action}}/>
            ));
            await screen.findByTestId(dialog);
            fireEvent.click(screen.getByText('Cancel'));
            unmount();

            defaultProps.handleConfirm.mockClear();
            ({unmount} = render(
                <ActionDialogManager {...propsNoClose} pendingAction={{action}}/>
            ));
            await screen.findByTestId(dialog);
            if (checkbox) fireEvent.click(screen.getByTestId(checkbox));
            fireEvent.click(screen.getByText('Confirm'));
            expect(defaultProps.handleConfirm).toHaveBeenCalledWith(action);
            unmount();
        }
    );

    test('covers both branches of if (onClose) for console dialog', async () => {
        const baseConsoleProps = {
            ...defaultProps, seats: 1, setSeats: vi.fn(), greetTimeout: '5s', setGreetTimeout: vi.fn(),
        };
        let {unmount} = render(
            <ActionDialogManager {...baseConsoleProps} pendingAction={{action: 'console'}}/>
        );
        await screen.findByTestId('mock-dialog');
        fireEvent.click(screen.getByText('Cancel'));
        expect(defaultProps.onClose).toHaveBeenCalled();
        unmount();

        defaultProps.onClose.mockClear();
        ({unmount} = render(
            <ActionDialogManager {...baseConsoleProps} pendingAction={{action: 'console'}}/>
        ));
        await screen.findByTestId('mock-dialog');
        fireEvent.click(screen.getByRole('button', {name: 'Open Console'}));
        expect(defaultProps.onClose).toHaveBeenCalled();
        unmount();

        const propsNoClose = {...baseConsoleProps, onClose: undefined};
        ({unmount} = render(
            <ActionDialogManager {...propsNoClose} pendingAction={{action: 'console'}}/>
        ));
        await screen.findByTestId('mock-dialog');
        fireEvent.click(screen.getByText('Cancel'));
        unmount();

        ({unmount} = render(
            <ActionDialogManager {...propsNoClose} pendingAction={{action: 'console'}}/>
        ));
        await screen.findByTestId('mock-dialog');
        fireEvent.click(screen.getByRole('button', {name: 'Open Console'}));
        unmount();
    });

    test('covers both branches of if (onClose) for simpleConfirm dialog', async () => {
        let {unmount} = render(
            <ActionDialogManager {...defaultProps} pendingAction={{action: 'other'}}/>
        );
        await screen.findByText('Confirm Other');
        fireEvent.click(screen.getByText('Cancel'));
        expect(defaultProps.onClose).toHaveBeenCalled();
        unmount();

        defaultProps.onClose.mockClear();
        ({unmount} = render(
            <ActionDialogManager {...defaultProps} pendingAction={{action: 'other'}}/>
        ));
        await screen.findByText('Confirm Other');
        fireEvent.click(screen.getByRole('button', {name: 'Confirm'}));
        expect(defaultProps.onClose).toHaveBeenCalled();
        unmount();

        const propsNoClose = {...defaultProps, onClose: undefined};
        ({unmount} = render(
            <ActionDialogManager {...propsNoClose} pendingAction={{action: 'other'}}/>
        ));
        await screen.findByText('Confirm Other');
        fireEvent.click(screen.getByText('Cancel'));
        unmount();

        ({unmount} = render(
            <ActionDialogManager {...propsNoClose} pendingAction={{action: 'other'}}/>
        ));
        await screen.findByText('Confirm Other');
        fireEvent.click(screen.getByRole('button', {name: 'Confirm'}));
        unmount();
    });

    test('covers default setSeats and setGreetTimeout functions', async () => {
        render(<ActionDialogManager {...defaultProps} pendingAction={{action: 'console'}}/>);
        await screen.findByTestId('mock-dialog');
        const seatsInput = screen.getByTestId('number-of-seats-input');
        const greetTimeoutInput = screen.getByTestId('greet-timeout-input');
        fireEvent.change(seatsInput, {target: {value: '3'}});
        fireEvent.change(greetTimeoutInput, {target: {value: '15s'}});
    });
});

describe('ConsoleDialog', () => {
    test('renders with disabled state', () => {
        render(
            <ConsoleDialog
                open={true}
                onClose={vi.fn()}
                onConfirm={vi.fn()}
                seats={1}
                setSeats={vi.fn()}
                greetTimeout="5s"
                setGreetTimeout={vi.fn()}
                disabled={true}
                pendingAction={{rid: 'res', node: 'node'}}
            />
        );
        const cancelButton = screen.getByRole('button', {name: 'Cancel'});
        const confirmButton = screen.getByRole('button', {name: 'Open Console'});
        expect(cancelButton).toBeDisabled();
        expect(confirmButton).toBeDisabled();
    });
});

describe('SimpleConfirmDialog', () => {
    test('renders with non-string action (covers typeof !== string branch)', () => {
        render(
            <SimpleConfirmDialog
                open={true}
                onClose={vi.fn()}
                onConfirm={vi.fn()}
                action={null}
                target="test-target"
                disabled={false}
                cancelDisabled={false}
            />
        );
        expect(screen.getByText('Confirm Action')).toBeInTheDocument();
        expect(screen.getByText(/Are you sure you want to perform this action on test-target\?/)).toBeInTheDocument();
    });

    test('renders with empty-string action (covers && action short-circuit)', () => {
        render(
            <SimpleConfirmDialog
                open={true}
                onClose={vi.fn()}
                onConfirm={vi.fn()}
                action=""
                target="test-target"
                disabled={false}
                cancelDisabled={false}
            />
        );
        expect(screen.getByText('Confirm Action')).toBeInTheDocument();
        expect(screen.getByText(/Are you sure you want to perform this action on test-target\?/)).toBeInTheDocument();
    });

    test('renders with string action (covers && action TRUE branch)', () => {
        render(
            <SimpleConfirmDialog
                open={true}
                onClose={vi.fn()}
                onConfirm={vi.fn()}
                action="delete"
                target="test-target"
                disabled={false}
                cancelDisabled={false}
            />
        );
        expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
        expect(screen.getByText(/Are you sure you want to delete on test-target\?/)).toBeInTheDocument();
    });
});
