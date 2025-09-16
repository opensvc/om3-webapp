import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import ActionDialogManager from '../ActionDialogManager';
import {
    FreezeDialog,
    StopDialog,
    UnprovisionDialog,
    PurgeDialog,
    DeleteDialog,
    SwitchDialog,
    GivebackDialog,
} from '../ActionDialogs';

jest.mock('@mui/material', () => ({
    Dialog: ({open, children}) => (open ? <div data-testid="mock-dialog">{children}</div> : null),
    DialogTitle: ({children}) => <h2>{children}</h2>,
    DialogContent: ({children}) => <div>{children}</div>,
    DialogActions: ({children}) => <div>{children}</div>,
    Button: ({onClick, disabled, children}) => (
        <button onClick={onClick} disabled={disabled}>
            {children}
        </button>
    ),
    Checkbox: ({checked, onChange, 'aria-label': ariaLabel}) => (
        <input
            type="checkbox"
            checked={checked}
            onChange={onChange}
            aria-label={ariaLabel}
        />
    ),
    FormControlLabel: ({control, label}) => (
        <div>
            {control}
            <span>{label}</span>
        </div>
    ),
    Typography: ({children}) => <span>{children}</span>,
}));

jest.mock('../ActionDialogs', () => ({
    FreezeDialog: jest.fn((props) =>
        props.open ? (
            <div data-testid="freeze-dialog">
                <button onClick={props.onClose} disabled={props.cancelDisabled}>Cancel</button>
                <button onClick={props.onConfirm} disabled={props.disabled}>Confirm</button>
                <input
                    type="checkbox"
                    checked={props.checked}
                    onChange={(e) => props.setChecked(e.target.checked)}
                    data-testid="freeze-checkbox"
                />
                <span>{props.pendingAction?.action}</span>
                <span>{props.target}</span>
            </div>
        ) : null
    ),
    StopDialog: jest.fn((props) =>
        props.open ? (
            <div data-testid="stop-dialog">
                <button onClick={props.onClose} disabled={props.cancelDisabled}>Cancel</button>
                <button onClick={props.onConfirm} disabled={props.disabled}>Confirm</button>
                <input
                    type="checkbox"
                    checked={props.checked}
                    onChange={(e) => props.setChecked(e.target.checked)}
                    data-testid="stop-checkbox"
                />
                <span>{props.pendingAction?.action}</span>
                <span>{props.target}</span>
            </div>
        ) : null
    ),
    UnprovisionDialog: jest.fn((props) =>
        props.open ? (
            <div data-testid="unprovision-dialog">
                <button onClick={props.onClose} disabled={props.cancelDisabled}>Cancel</button>
                <button onClick={props.onConfirm} disabled={props.disabled}>Confirm</button>
                <input
                    type="checkbox"
                    checked={props.checkboxes.dataLoss}
                    onChange={(e) => props.setCheckboxes({...props.checkboxes, dataLoss: e.target.checked})}
                    data-testid="unprovision-dataLoss-checkbox"
                />
                <span>{props.pendingAction?.action}</span>
                <span>{props.target}</span>
            </div>
        ) : null
    ),
    PurgeDialog: jest.fn((props) =>
        props.open ? (
            <div data-testid="purge-dialog">
                <button onClick={props.onClose} disabled={props.cancelDisabled}>Cancel</button>
                <button onClick={props.onConfirm} disabled={props.disabled}>Confirm</button>
                <input
                    type="checkbox"
                    checked={props.checkboxes.dataLoss}
                    onChange={(e) => props.setCheckboxes({...props.checkboxes, dataLoss: e.target.checked})}
                    data-testid="purge-dataLoss-checkbox"
                />
                <span>{props.pendingAction?.action}</span>
                <span>{props.target}</span>
            </div>
        ) : null
    ),
    DeleteDialog: jest.fn((props) =>
        props.open ? (
            <div data-testid="delete-dialog">
                <button onClick={props.onClose} disabled={props.cancelDisabled}>Cancel</button>
                <button onClick={props.onConfirm} disabled={props.disabled}>Confirm</button>
                <input
                    type="checkbox"
                    checked={props.checkboxes.configLoss}
                    onChange={(e) => props.setCheckboxes({...props.checkboxes, configLoss: e.target.checked})}
                    data-testid="delete-configLoss-checkbox"
                />
                <span>{props.pendingAction?.action}</span>
                <span>{props.target}</span>
            </div>
        ) : null
    ),
    SwitchDialog: jest.fn((props) =>
        props.open ? (
            <div data-testid="switch-dialog">
                <button onClick={props.onClose} disabled={props.cancelDisabled}>Cancel</button>
                <button onClick={props.onConfirm} disabled={props.disabled}>Confirm</button>
                <input
                    type="checkbox"
                    checked={props.checked}
                    onChange={(e) => props.setChecked(e.target.checked)}
                    data-testid="switch-checkbox"
                />
                <span>{props.pendingAction?.action}</span>
                <span>{props.target}</span>
            </div>
        ) : null
    ),
    GivebackDialog: jest.fn((props) =>
        props.open ? (
            <div data-testid="giveback-dialog">
                <button onClick={props.onClose} disabled={props.cancelDisabled}>Cancel</button>
                <button onClick={props.onConfirm} disabled={props.disabled}>Confirm</button>
                <input
                    type="checkbox"
                    checked={props.checked}
                    onChange={(e) => props.setChecked(e.target.checked)}
                    data-testid="giveback-checkbox"
                />
                <span>{props.pendingAction?.action}</span>
                <span>{props.target}</span>
            </div>
        ) : null
    ),
}));

describe('ActionDialogManager', () => {
    const defaultProps = {
        pendingAction: null,
        handleConfirm: jest.fn(),
        target: 'test-target',
        supportedActions: ['freeze', 'stop', 'unprovision', 'purge', 'delete', 'switch', 'giveback', 'other'],
        onClose: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {
        });
        jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        jest.spyOn(console, 'error').mockImplementation(() => {
        });
    });

    afterEach(() => {
        console.log.mockRestore();
        console.warn.mockRestore();
        console.error.mockRestore();
    });

    test('renders without crashing when no pendingAction is provided', async () => {
        render(<ActionDialogManager {...defaultProps} pendingAction={null}/>);
        await waitFor(() => {
            expect(screen.queryByTestId('mock-dialog')).not.toBeInTheDocument();
            expect(defaultProps.onClose).toHaveBeenCalled();
        });
    });

    test('logs warning for invalid non-null pendingAction', async () => {
        render(<ActionDialogManager {...defaultProps} pendingAction={{}}/>);
        await waitFor(() => {
            expect(console.warn).toHaveBeenCalledWith('Invalid pendingAction provided:', {});
            expect(defaultProps.onClose).toHaveBeenCalled();
        });
    });

    test('opens FreezeDialog when pendingAction is "freeze"', async () => {
        render(<ActionDialogManager {...defaultProps} pendingAction={{action: 'freeze'}}/>);
        await waitFor(() => {
            expect(screen.getByTestId('freeze-dialog')).toBeInTheDocument();
        });
    });

    test('opens SimpleConfirmDialog for unknown action in dialogConfig', async () => {
        render(<ActionDialogManager {...defaultProps} pendingAction={{action: 'other'}}/>);
        await waitFor(() => {
            expect(screen.getByText('Confirm Other')).toBeInTheDocument();
            expect(screen.getByText(/Are you sure you want to other on test-target\?/)).toBeInTheDocument();
        });
    });

    test('closes dialog and calls onClose when Cancel is clicked', async () => {
        render(<ActionDialogManager {...defaultProps} pendingAction={{action: 'freeze'}}/>);
        await waitFor(() => {
            expect(screen.getByTestId('freeze-dialog')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('Cancel'));
        await waitFor(() => {
            expect(defaultProps.onClose).toHaveBeenCalled();
        });
    });

    test('updates checkbox and confirms freeze', async () => {
        render(<ActionDialogManager {...defaultProps} pendingAction={{action: 'freeze'}}/>);
        await waitFor(() => screen.getByTestId('freeze-checkbox'));
        fireEvent.click(screen.getByTestId('freeze-checkbox'));
        fireEvent.click(screen.getByText('Confirm'));
        expect(defaultProps.handleConfirm).toHaveBeenCalledWith('freeze');
    });

    test('handles unprovision checkboxes properly', async () => {
        render(<ActionDialogManager {...defaultProps} pendingAction={{action: 'unprovision'}}/>);
        await waitFor(() => screen.getByTestId('unprovision-dataLoss-checkbox'));
        fireEvent.click(screen.getByTestId('unprovision-dataLoss-checkbox'));
        fireEvent.click(screen.getByText('Confirm'));
        expect(defaultProps.handleConfirm).toHaveBeenCalledWith('unprovision');
    });

    test('handles invalid setCheckboxes value for unprovision', async () => {
        render(<ActionDialogManager {...defaultProps} pendingAction={{action: 'unprovision'}}/>);
        await waitFor(() => screen.getByTestId('unprovision-dialog'));
        UnprovisionDialog.mock.calls[0][0].setCheckboxes(null);
        expect(console.error).toHaveBeenCalledWith('setCheckboxes for unprovision received invalid value:', null);
    });

    test('ignores unsupported action and calls onClose', async () => {
        render(<ActionDialogManager {...defaultProps} pendingAction={{action: 'invalid'}}
                                    supportedActions={['freeze']}/>);
        await waitFor(() => {
            expect(defaultProps.onClose).toHaveBeenCalled();
            expect(console.warn).toHaveBeenCalledWith('Unsupported action: invalid');
        });
    });

    test('re-initializes dialog when pendingAction changes', async () => {
        const {rerender} = render(<ActionDialogManager {...defaultProps} pendingAction={{action: 'stop'}}/>);
        await waitFor(() => {
            expect(screen.getByTestId('stop-dialog')).toBeInTheDocument();
        });

        // Change to another dialog
        rerender(<ActionDialogManager {...defaultProps} pendingAction={{action: 'freeze'}}/>);
        await waitFor(() => {
            expect(screen.getByTestId('freeze-dialog')).toBeInTheDocument();
        });
    });
    test('handles delete dialog checkboxes correctly', async () => {
        render(<ActionDialogManager {...defaultProps} pendingAction={{action: 'delete'}}/>);
        await waitFor(() => {
            expect(screen.getByTestId('delete-dialog')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('delete-configLoss-checkbox'));
        fireEvent.click(screen.getByText('Confirm'));

        expect(defaultProps.handleConfirm).toHaveBeenCalledWith('delete');
    });
    test('handles switch dialog correctly', async () => {
        render(<ActionDialogManager {...defaultProps} pendingAction={{action: 'switch'}}/>);
        await waitFor(() => {
            expect(screen.getByTestId('switch-dialog')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('switch-checkbox'));
        fireEvent.click(screen.getByText('Confirm'));

        expect(defaultProps.handleConfirm).toHaveBeenCalledWith('switch');
    });
    test('handles giveback dialog correctly', async () => {
        render(<ActionDialogManager {...defaultProps} pendingAction={{action: 'giveback'}}/>);
        await waitFor(() => {
            expect(screen.getByTestId('giveback-dialog')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('giveback-checkbox'));
        fireEvent.click(screen.getByText('Confirm'));

        expect(defaultProps.handleConfirm).toHaveBeenCalledWith('giveback');
    });
    test('handles simpleConfirm fallback dialog', async () => {
        render(<ActionDialogManager {...defaultProps} pendingAction={{action: 'other'}}/>);
        await waitFor(() => {
            expect(screen.getByText('Confirm Other')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Confirm'));
        expect(defaultProps.handleConfirm).toHaveBeenCalledWith('other');
    });

});

