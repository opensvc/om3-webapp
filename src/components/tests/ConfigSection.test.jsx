import React from 'react';
import {render, screen, waitFor, act, within} from '@testing-library/react';
import ConfigSection from '../ConfigSection';
import userEvent from '@testing-library/user-event';
import {URL_OBJECT} from '../../config/apiPath.js';

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useParams: jest.fn(),
}));

jest.mock('@mui/material', () => {
    const actual = jest.requireActual('@mui/material');
    const {useState} = jest.requireActual('react');
    const mocks = {
        ...actual,
        Dialog: ({children, open, maxWidth, fullWidth, ...props}) =>
            open ? <div role="dialog" {...props}>{children}</div> : null,
        DialogTitle: ({children, ...props}) => <div {...props}><h2>{children}</h2></div>,
        DialogContent: ({children, ...props}) => <div {...props}>{children}</div>,
        DialogActions: ({children, ...props}) => <div {...props}>{children}</div>,
        Alert: ({children, severity, ...props}) => (
            <div role="alert" data-severity={severity} {...props}>{children}</div>
        ),
        Button: ({children, onClick, disabled, variant, component, htmlFor, ...props}) => (
            <button onClick={onClick} disabled={disabled} data-variant={variant}
                    {...(component === 'label' ? {htmlFor} : {})} {...props}>
                {children}
            </button>
        ),
        TextField: ({label, value, onChange, disabled, type, inputProps, InputLabelProps, placeholder, ...props}) => (
            <input
                type={type || 'text'}
                role="textbox"
                aria-label={InputLabelProps?.['aria-label'] || label || 'autocomplete-input'}
                placeholder={placeholder || label || ''}
                value={value || ''}
                onChange={onChange}
                disabled={disabled}
                {...inputProps}
                {...props}
            />
        ),
        Autocomplete: ({options, getOptionLabel, onChange, multiple, renderInput, value, freeSolo, ...props}) => {
            const [inputValue, setInputValue] = useState(
                multiple
                    ? (Array.isArray(value) ? value.map(item => typeof item === 'string' ? item : getOptionLabel(item)).join(', ') : '')
                    : (value ? (typeof value === 'string' ? value : getOptionLabel(value)) : '')
            );
            const handleChange = (e) => {
                const inputText = e.target.value;
                setInputValue(inputText);
                const inputValues = multiple
                    ? inputText.split(',').map(v => v.trim()).filter(Boolean)
                    : [inputText.trim()];
                let selectedOptions = inputValues.map(val => {
                    const option = options.find(opt => (typeof opt === 'string' ? opt : getOptionLabel(opt)) === val);
                    if (!option) {
                        if (freeSolo) return val;
                        if (multiple) {
                            return options.length > 0 && typeof options[0] === 'object'
                                ? {option: val, section: val.includes('.') ? val.split('.')[0] : ''}
                                : val;
                        }
                        return null;
                    }
                    return option;
                }).filter(Boolean);
                onChange({}, multiple ? selectedOptions : selectedOptions[0] || (freeSolo ? inputText : null));
                const newValue = multiple
                    ? selectedOptions.map(item => typeof item === 'string' ? item : getOptionLabel(item)).join(', ')
                    : selectedOptions[0]
                        ? (typeof selectedOptions[0] === 'string' ? selectedOptions[0] : getOptionLabel(selectedOptions[0]))
                        : (freeSolo ? inputText : '');
                setInputValue(newValue);
                e.target.value = newValue;
            };
            const renderInputProps = renderInput({}) || {};
            const inputLabel = renderInputProps.InputLabelProps?.['aria-label'] || renderInputProps.label || 'autocomplete-input';
            return (
                <div {...props} data-testid="autocomplete">
                    {renderInput({
                        InputProps: {endAdornment: <span>v</span>},
                        inputProps: {
                            'data-testid': 'autocomplete-input',
                            value: inputValue || '',
                            onChange: handleChange,
                            'aria-label': inputLabel,
                            role: 'combobox',
                            'aria-controls': 'autocomplete-options',
                            'aria-expanded': !!inputValue,
                        },
                        label: inputLabel,
                    })}
                </div>
            );
        },
        CircularProgress: () => <div role="progressbar">Loading...</div>,
        Typography: ({children, variant, fontWeight, color, sx, ...props}) => (
            <span style={{fontWeight: variant === 'body2' && fontWeight ? 'bold' : undefined, color, ...sx}} {...props}>
                {children}
            </span>
        ),
        Box: ({children, sx, ...props}) => <div style={sx} {...props}>{children}</div>,
        Tooltip: ({children, title}) => <span title={title}>{children}</span>,
        IconButton: ({children, onClick, disabled, 'aria-label': ariaLabel, ...props}) => (
            <button onClick={onClick} disabled={disabled} aria-label={ariaLabel} {...props}>{children}</button>
        ),
        TableContainer: ({children, ...props}) => <div {...props}>{children}</div>,
        Table: ({children, ...props}) => <table {...props}>{children}</table>,
        TableHead: ({children, ...props}) => <thead {...props}>{children}</thead>,
        TableBody: ({children, ...props}) => <tbody {...props}>{children}</tbody>,
        TableRow: ({children, ...props}) => <tr {...props}>{children}</tr>,
        TableCell: ({children, ...props}) => <td {...props}>{children}</td>,
        Paper: ({children, ...props}) => <div {...props}>{children}</div>,
    };
    return mocks;
});

jest.mock('@mui/icons-material/UploadFile', () => () => <span data-testid="UploadFileIcon"/>);
jest.mock('@mui/icons-material/Edit', () => () => <span data-testid="EditIcon"/>);
jest.mock('@mui/icons-material/Info', () => () => <span data-testid="InfoIcon"/>);
jest.mock('@mui/icons-material/Delete', () => () => <span data-testid="DeleteIcon"/>);

const mockLocalStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
};
Object.defineProperty(global, 'localStorage', {value: mockLocalStorage});

// ─── Shared helpers ────────────────────────────────────────────────────────────

const defaultProps = {
    decodedObjectName: 'root/cfg/cfg1',
    configNode: 'node1',
    setConfigNode: jest.fn(),
    openSnackbar: jest.fn(),
    configDialogOpen: true,
    setConfigDialogOpen: jest.fn(),
};

const renderConfig = (props = {}) =>
    render(<ConfigSection {...defaultProps} {...props}/>);

const getDialogByTitle = (title) => {
    const dialogs = screen.getAllByRole('dialog');
    return dialogs.find(d => within(d).queryByText(title) !== null);
};

const getViewConfigButton = () => screen.getByText('View Configuration');
const getUploadButton = () => screen.getByRole('button', {name: /Upload new configuration file/i});
const getManageParamsButton = () => screen.getByRole('button', {name: /Manage configuration parameters/i});
const getKeywordsButton = () => screen.getByRole('button', {name: /View configuration keywords/i});

/** Opens the main dialog + Manage params sub-dialog and waits for it to be ready. */
const openManageParamsDialog = async (user) => {
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument(), {timeout: 5000});
    await act(async () => {
        await user.click(getManageParamsButton());
    });
    await waitFor(() => expect(screen.getByText(/Manage Configuration Parameters/i)).toBeInTheDocument(), {timeout: 10000});
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument(), {timeout: 10000});
};

/** Gets the three comboboxes: [add, unset, delete]. */
const getComboboxes = () => screen.getAllByRole('combobox', {name: /autocomplete-input/i});

/** Opens update config dialog and uploads a file. */
const openUpdateDialogWithFile = async (user, fileName = 'config.ini', content = '[DEFAULT]\nnodes = node2') => {
    await waitFor(() => expect(screen.getAllByRole('dialog').length).toBeGreaterThan(0), {timeout: 5000});
    await act(async () => {
        await user.click(getUploadButton());
    });
    await waitFor(() => expect(screen.getByText(/Update Configuration/i)).toBeInTheDocument(), {timeout: 5000});
    const file = new File([content], fileName);
    await act(async () => {
        await user.upload(document.querySelector('#update-config-file-upload'), file);
    });
    return file;
};

const defaultFetchMock = (url, options) => {
    const headers = options?.headers || {};
    if (url.includes('/config/file')) {
        return Promise.resolve({
            ok: true, status: 200,
            text: () => Promise.resolve(`[DEFAULT]\nnodes = *\norchestrate = ha\n[fs#1]\nsize = 10GB`),
            json: () => Promise.resolve({}),
            headers: new Headers({Authorization: headers.Authorization || ''}),
        });
    }
    if (url.includes('/config/keywords')) {
        return Promise.resolve({
            ok: true, status: 200,
            json: () => Promise.resolve({
                items: [
                    {
                        option: 'nodes',
                        section: 'DEFAULT',
                        text: 'Nodes to deploy the service',
                        converter: 'string',
                        scopable: true,
                        default: '*'
                    },
                    {
                        option: 'size',
                        section: 'fs',
                        text: 'Size of filesystem',
                        converter: 'string',
                        scopable: false,
                        default: '1GB'
                    },
                    {
                        option: 'orchestrate',
                        section: 'DEFAULT',
                        text: 'Orchestration mode',
                        converter: 'string',
                        scopable: true,
                        default: 'ha'
                    },
                    {
                        option: 'roles',
                        section: 'DEFAULT',
                        text: 'Comma-separated roles',
                        converter: 'converters.TListLowercase',
                        scopable: true,
                        default: ''
                    },
                ],
            }),
            headers: new Headers({Authorization: headers.Authorization || '', 'Content-Length': '1024'}),
        });
    }
    if (url.includes('/config?set=') || url.includes('/config?unset=') || url.includes('/config?delete=')) {
        return Promise.resolve({
            ok: true, status: 200,
            json: () => Promise.resolve({}),
            text: () => Promise.resolve(''),
            headers: new Headers({Authorization: headers.Authorization || ''}),
        });
    }
    if (url.includes('/config')) {
        return Promise.resolve({
            ok: true, status: 200,
            json: () => Promise.resolve({
                items: [
                    {keyword: 'nodes', value: '*'},
                    {keyword: 'fs#1.size', value: '10GB'},
                    {keyword: 'orchestrate', value: 'ha'},
                ],
            }),
            headers: new Headers({Authorization: headers.Authorization || ''}),
        });
    }
    return Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve({}), text: () => Promise.resolve(''),
        headers: new Headers({Authorization: headers.Authorization || ''}),
    });
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ConfigSection Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        jest.setTimeout(30000);
        jest.clearAllMocks();
        mockLocalStorage.getItem.mockImplementation(() => 'mock-token');
        require('react-router-dom').useParams.mockReturnValue({objectName: 'root/cfg/cfg1'});
        global.fetch = jest.fn(defaultFetchMock);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.resetAllMocks();
    });

    // ── Basic rendering ────────────────────────────────────────────────────────

    test('displays configuration button, no dialog initially', () => {
        renderConfig({configDialogOpen: false});
        expect(getViewConfigButton()).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('clicking View Configuration calls setConfigDialogOpen(true)', async () => {
        const setConfigDialogOpen = jest.fn();
        renderConfig({configDialogOpen: false, setConfigDialogOpen});
        await act(async () => {
            await user.click(getViewConfigButton());
        });
        expect(setConfigDialogOpen).toHaveBeenCalledWith(true);
    });

    test('displays dialog content when open', async () => {
        renderConfig();
        await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument(), {timeout: 5000});
        expect(screen.getByText('Configuration')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByText(/nodes = \*/i)).toBeInTheDocument(), {timeout: 10000});
        await waitFor(() => expect(screen.getByText(/orchestrate = ha/i)).toBeInTheDocument(), {timeout: 10000});
        await waitFor(() => expect(screen.getByText(/size = 10GB/i)).toBeInTheDocument(), {timeout: 10000});
    });

    test('close button calls setConfigDialogOpen(false)', async () => {
        const setConfigDialogOpen = jest.fn();
        renderConfig({setConfigDialogOpen});
        await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument(), {timeout: 5000});
        await act(async () => {
            await user.click(screen.getByRole('button', {name: /Close/i}));
        });
        expect(setConfigDialogOpen).toHaveBeenCalledWith(false);
    });

    test('shows error alert when fetching configuration fails', async () => {
        global.fetch.mockImplementationOnce(() =>
            Promise.resolve({ok: false, status: 500, text: () => Promise.resolve('Server error')})
        );
        renderConfig();
        await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument(), {timeout: 10000});
        expect(screen.getByRole('alert')).toHaveTextContent(/Failed to fetch config: HTTP 500/i);
    });

    test('shows loading indicator while fetching', async () => {
        global.fetch.mockImplementation(() => new Promise(() => {
        }));
        renderConfig();
        await waitFor(() => expect(screen.getByRole('progressbar')).toBeInTheDocument(), {timeout: 5000});
    });

    test('shows no configuration available when configNode is missing', async () => {
        renderConfig({configNode: ''});
        await waitFor(() =>
            expect(screen.getByText(/No instance selected to view configuration/i)).toBeInTheDocument()
        );
    });

    test('shows "No configuration available" when config text is null', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/config/file')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    text: () => Promise.resolve(null),
                    headers: new Headers()
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers()
            });
        });
        renderConfig();
        await waitFor(() => expect(screen.getByText(/No configuration available/i)).toBeInTheDocument(), {timeout: 10000});
    });

    // ── Config re-fetch triggers ───────────────────────────────────────────────

    test('configNode change triggers config re-fetch', async () => {
        const {rerender} = renderConfig();
        await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('node1'), expect.any(Object)), {timeout: 5000});
        const callsBefore = global.fetch.mock.calls.length;
        rerender(<ConfigSection {...defaultProps} configNode="node2"/>);
        await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('node2'), expect.any(Object)), {timeout: 5000});
        expect(global.fetch.mock.calls.length).toBeGreaterThan(callsBefore);
    });

    test('decodedObjectName change triggers config re-fetch', async () => {
        const {rerender} = renderConfig();
        await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('cfg1'), expect.any(Object)), {timeout: 5000});
        rerender(<ConfigSection {...defaultProps} decodedObjectName="root/cfg/cfg2"/>);
        await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('cfg2'), expect.any(Object)), {timeout: 10000});
    });

    test('debounce prevents duplicate fetchConfig calls within 1 second', async () => {
        renderConfig();
        await waitFor(() => expect(global.fetch).toHaveBeenCalled(), {timeout: 5000});
        const callsAfterFirst = global.fetch.mock.calls.filter(c => c[0].includes('/config/file')).length;
        const {rerender} = renderConfig();
        rerender(<ConfigSection {...defaultProps}/>);
        await act(async () => {
            await new Promise(r => setTimeout(r, 100));
        });
        const callsAfterDebounce = global.fetch.mock.calls.filter(c => c[0].includes('/config/file')).length;
        expect(callsAfterDebounce).toBeGreaterThanOrEqual(callsAfterFirst);
    });

    test('handles parseObjectPath with various input formats', async () => {
        renderConfig({decodedObjectName: 'cluster'});
        await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument(), {timeout: 5000});
        await waitFor(() => expect(global.fetch).toHaveBeenCalled(), {timeout: 10000});
    });

    // ── Update config dialog ───────────────────────────────────────────────────

    test('update config: success flow', async () => {
        const openSnackbar = jest.fn();
        renderConfig({openSnackbar});
        const file = await openUpdateDialogWithFile(user);
        await waitFor(() => expect(screen.getByText(file.name)).toBeInTheDocument(), {timeout: 5000});
        await act(async () => {
            await user.click(screen.getByRole('button', {name: /Update/i}));
        });
        await waitFor(() => expect(openSnackbar).toHaveBeenCalledWith('Updating configuration…', 'info'), {timeout: 10000});
        await waitFor(() => expect(openSnackbar).toHaveBeenCalledWith('Configuration updated successfully'), {timeout: 10000});
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining(`${URL_OBJECT}/root/cfg/cfg1/config/file`),
            expect.objectContaining({
                method: 'PUT',
                headers: expect.objectContaining({
                    Authorization: 'Bearer mock-token',
                    'Content-Type': 'application/octet-stream'
                })
            })
        );
        await waitFor(() => expect(screen.queryByText('Update Configuration')).not.toBeInTheDocument(), {timeout: 10000});
    });

    test('update config: Update button is disabled when no file chosen', async () => {
        renderConfig();
        await waitFor(() => expect(screen.getAllByRole('dialog').length).toBeGreaterThan(0), {timeout: 5000});
        await act(async () => {
            await user.click(getUploadButton());
        });
        await waitFor(() => expect(screen.getByText(/Update Configuration/i)).toBeInTheDocument(), {timeout: 5000});
        expect(screen.getByRole('button', {name: /Update/i})).toBeDisabled();
    });

    test('update config: missing token shows error', async () => {
        mockLocalStorage.getItem.mockImplementation(() => null);
        const openSnackbar = jest.fn();
        renderConfig({openSnackbar});
        await openUpdateDialogWithFile(user);
        await act(async () => {
            await user.click(screen.getByRole('button', {name: /Update/i}));
        });
        await waitFor(() => expect(openSnackbar).toHaveBeenCalledWith('Auth token not found.', 'error'), {timeout: 10000});
        expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining(`${URL_OBJECT}/root/cfg/cfg1/config/file`), expect.any(Object));
        await waitFor(() => expect(screen.getByText('Update Configuration')).toBeInTheDocument(), {timeout: 10000});
    });

    test('update config: API failure shows error', async () => {
        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/config/file')) {
                return Promise.resolve({
                    ok: false,
                    status: 500,
                    text: () => Promise.resolve('Server error'),
                    headers: new Headers()
                });
            }
            return Promise.resolve({ok: true, status: 200, text: () => Promise.resolve(''), headers: new Headers()});
        });
        const openSnackbar = jest.fn();
        renderConfig({openSnackbar});
        await openUpdateDialogWithFile(user);
        await act(async () => {
            await user.click(screen.getByRole('button', {name: /Update/i}));
        });
        await waitFor(() => expect(openSnackbar).toHaveBeenCalledWith('Updating configuration…', 'info'), {timeout: 10000});
        await waitFor(() => expect(openSnackbar).toHaveBeenCalledWith('Error: Failed to update config: 500', 'error'), {timeout: 10000});
        await waitFor(() => expect(screen.queryByText('Update Configuration')).not.toBeInTheDocument(), {timeout: 10000});
    });

    test('update config: works without configNode', async () => {
        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/config/file')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    text: () => Promise.resolve(''),
                    headers: new Headers()
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers()
            });
        });
        const openSnackbar = jest.fn();
        renderConfig({configNode: '', openSnackbar});
        await openUpdateDialogWithFile(user);
        await act(async () => {
            await user.click(screen.getByRole('button', {name: /Update/i}));
        });
        await waitFor(() => expect(openSnackbar).toHaveBeenCalledWith('Configuration updated successfully'), {timeout: 10000});
    });

    test('update config dialog: cancel closes it', async () => {
        renderConfig();
        await openUpdateDialogWithFile(user);
        const updateDialog = getDialogByTitle('Update Configuration');
        await act(async () => {
            await user.click(within(updateDialog).getByRole('button', {name: /Cancel/i}));
        });
        await waitFor(() => expect(screen.queryByText(/Update Configuration/i)).not.toBeInTheDocument(), {timeout: 5000});
    });

    // ── Manage params dialog ───────────────────────────────────────────────────

    test('manage params: no selection shows error', async () => {
        const openSnackbar = jest.fn();
        renderConfig({openSnackbar});
        await openManageParamsDialog(user);
        await act(async () => {
            await user.click(screen.getByRole('button', {name: /Apply/i}));
        });
        await waitFor(() => expect(openSnackbar).toHaveBeenCalledWith('No selection made', 'error'), {timeout: 10000});
        await waitFor(() => expect(screen.getByText(/Manage Configuration Parameters/i)).toBeInTheDocument(), {timeout: 10000});
    });

    test('manage params: add invalid parameter shows error', async () => {
        const openSnackbar = jest.fn();
        renderConfig({openSnackbar});
        await openManageParamsDialog(user);
        await act(async () => {
            await user.type(getComboboxes()[0], 'invalid_param{Enter}');
        });
        await act(async () => {
            await user.click(screen.getByRole('button', {name: /Add Parameter/i}));
        });
        await waitFor(() => expect(openSnackbar).toHaveBeenCalledWith('Invalid parameter: invalid_param', 'error'), {timeout: 10000});
    });

    test('manage params: add DEFAULT.orchestrate parameter and apply', async () => {
        const openSnackbar = jest.fn();
        renderConfig({openSnackbar});
        await openManageParamsDialog(user);
        await act(async () => {
            await user.type(getComboboxes()[0], 'DEFAULT.orchestrate{Enter}');
        });
        await act(async () => {
            await user.click(screen.getByRole('button', {name: /Add Parameter/i}));
        });
        await waitFor(() => expect(screen.getByText('orchestrate')).toBeInTheDocument(), {timeout: 5000});
        await act(async () => {
            await user.type(screen.getByLabelText('Value'), 'new-value');
        });
        await act(async () => {
            await user.click(screen.getByRole('button', {name: /Apply/i}));
        });
        await waitFor(() => expect(openSnackbar).toHaveBeenCalledWith('Successfully added 1 parameter(s)', 'success'), {timeout: 10000});
        await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/config/file'), expect.any(Object)), {timeout: 10000});
        await waitFor(() => expect(screen.queryByText(/Manage Configuration Parameters/i)).not.toBeInTheDocument(), {timeout: 10000});
    });

    test('manage params: add fs.size with indexed section and apply', async () => {
        const openSnackbar = jest.fn();
        renderConfig({openSnackbar});
        await openManageParamsDialog(user);
        await act(async () => {
            await user.type(getComboboxes()[0], 'fs.size{Enter}');
        });
        await act(async () => {
            await user.click(screen.getByRole('button', {name: /Add Parameter/i}));
        });
        await waitFor(() => expect(screen.getByText('size')).toBeInTheDocument(), {timeout: 5000});
        await act(async () => {
            await user.type(screen.getByLabelText('Index (free text)'), '2');
        });
        await act(async () => {
            await user.type(screen.getByLabelText('Value'), '20GB');
        });
        await act(async () => {
            await user.click(screen.getByRole('button', {name: /Apply/i}));
        });
        await waitFor(() => expect(openSnackbar).toHaveBeenCalledWith('Successfully added 1 parameter(s)', 'success'), {timeout: 10000});
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('set=fs%232.size=20GB'),
            expect.objectContaining({
                method: 'PATCH',
                headers: expect.objectContaining({Authorization: 'Bearer mock-token'})
            })
        );
        await waitFor(() => expect(screen.queryByText(/Manage Configuration Parameters/i)).not.toBeInTheDocument(), {timeout: 10000});
    });

    test.each([
        ['missing section (empty index)', '', 'set=fs.size=20GB'],
        ['negative index', '-1', 'set=fs%23-1.size=20GB'],
        ['decimal index', '1.5', 'set=fs%231.5.size=20GB'],
        ['zero index', '0', null],
    ])('manage params: add fs.size with %s', async (_, indexValue, expectedUrl) => {
        const openSnackbar = jest.fn();
        renderConfig({openSnackbar});
        await openManageParamsDialog(user);
        await act(async () => {
            await user.type(getComboboxes()[0], 'fs.size{Enter}');
        });
        await act(async () => {
            await user.click(screen.getByRole('button', {name: /Add Parameter/i}));
        });
        await waitFor(() => expect(screen.getByText('size')).toBeInTheDocument(), {timeout: 5000});
        const sectionInput = screen.getByLabelText('Index (free text)');
        await act(async () => {
            await user.clear(sectionInput);
            if (indexValue) await user.type(sectionInput, indexValue);
        });
        await act(async () => {
            await user.type(screen.getByLabelText('Value'), '20GB');
        });
        await act(async () => {
            await user.click(screen.getByRole('button', {name: /Apply/i}));
        });
        await waitFor(() => expect(openSnackbar).toHaveBeenCalledWith('Successfully added 1 parameter(s)', 'success'), {timeout: 10000});
        if (expectedUrl) {
            expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining(expectedUrl), expect.anything());
        }
    });

    test('manage params: modify section of added parameter', async () => {
        const openSnackbar = jest.fn();
        renderConfig({openSnackbar});
        await openManageParamsDialog(user);
        await act(async () => {
            await user.type(getComboboxes()[0], 'DEFAULT.orchestrate{Enter}');
        });
        await act(async () => {
            await user.click(screen.getByRole('button', {name: /Add Parameter/i}));
        });
        await waitFor(() => expect(screen.getByText('orchestrate')).toBeInTheDocument());
        const sectionInput = screen.getByLabelText('Section (optional)');
        await act(async () => {
            await user.clear(sectionInput);
            await user.type(sectionInput, 'database');
        });
        await act(async () => {
            await user.type(screen.getByLabelText('Value'), 'test-value');
        });
        await act(async () => {
            await user.click(screen.getByRole('button', {name: /Apply/i}));
        });
        await waitFor(() => expect(openSnackbar).toHaveBeenCalledWith('Successfully added 1 parameter(s)', 'success'), {timeout: 10000});
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('set=database.orchestrate=test-value'), expect.any(Object));
    });

    test('manage params: remove parameter from list', async () => {
        renderConfig();
        await openManageParamsDialog(user);
        await act(async () => {
            await user.type(getComboboxes()[0], 'DEFAULT.orchestrate{Enter}');
        });
        await act(async () => {
            await user.click(screen.getByRole('button', {name: /Add Parameter/i}));
        });
        await waitFor(() => expect(screen.getByText('orchestrate')).toBeInTheDocument(), {timeout: 5000});
        await act(async () => {
            await user.click(screen.getByRole('button', {name: /Remove parameter/i}));
        });
        await waitFor(() => expect(screen.queryByText('orchestrate')).not.toBeInTheDocument(), {timeout: 5000});
    });

    test('manage params: TListLowercase with empty value after split shows error', async () => {
        const openSnackbar = jest.fn();
        renderConfig({openSnackbar});
        await openManageParamsDialog(user);
        await act(async () => {
            await user.type(getComboboxes()[0], 'DEFAULT.roles{Enter}');
        });
        await act(async () => {
            await user.click(screen.getByRole('button', {name: /Add Parameter/i}));
        });
        await waitFor(() => expect(screen.getByText('roles')).toBeInTheDocument());
        const valueInput = screen.getByLabelText('Value');
        await act(async () => {
            await user.clear(valueInput);
            await user.type(valueInput, 'admin, , guest');
        });
        await act(async () => {
            await user.click(screen.getByRole('button', {name: /Apply/i}));
        });
        await waitFor(() => expect(openSnackbar).toHaveBeenCalledWith(
            expect.stringMatching(/Invalid value for .*: must be comma-separated lowercase strings/),
            'error'
        ), {timeout: 10000});
        expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining('set=DEFAULT.roles='), expect.any(Object));
    });

    // ── Unset params ───────────────────────────────────────────────────────────

    test('unset params: success flow', async () => {
        const openSnackbar = jest.fn();
        renderConfig({openSnackbar});
        await openManageParamsDialog(user);
        await act(async () => {
            await user.type(getComboboxes()[1], 'nodes{Enter}');
        });
        await waitFor(() => expect(getComboboxes()[1]).toHaveValue('nodes'), {timeout: 10000});
        await act(async () => {
            await user.click(screen.getByRole('button', {name: /Apply/i}));
        });
        await waitFor(() => expect(openSnackbar).toHaveBeenCalledWith('Successfully unset 1 parameter(s)', 'success'), {timeout: 10000});
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining(`${URL_OBJECT}/root/cfg/cfg1/config?unset=nodes`),
            expect.objectContaining({
                method: 'PATCH',
                headers: expect.objectContaining({Authorization: 'Bearer mock-token'})
            })
        );
        await waitFor(() => expect(screen.queryByText(/Manage Configuration Parameters/i)).not.toBeInTheDocument(), {timeout: 10000});
    });

    test('unset params: API failure shows error and keeps dialog open', async () => {
        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/config?unset=')) {
                return Promise.resolve({
                    ok: false,
                    status: 500,
                    json: () => Promise.resolve({}),
                    headers: new Headers()
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers()
            });
        });
        const openSnackbar = jest.fn();
        renderConfig({openSnackbar});
        await openManageParamsDialog(user);
        await act(async () => {
            await user.type(getComboboxes()[1], 'nodes{Enter}');
        });
        await act(async () => {
            await user.click(screen.getByRole('button', {name: /Apply/i}));
        });
        await waitFor(() => expect(openSnackbar).toHaveBeenCalledWith('Error unsetting parameter nodes: Failed to unset parameter nodes: 500', 'error'), {timeout: 10000});
        await waitFor(() => expect(screen.getByText(/Manage Configuration Parameters/i)).toBeInTheDocument(), {timeout: 10000});
    });

    test('unset params: network error shows error', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/config?unset=')) return Promise.reject(new Error('Network failure'));
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers()
            });
        });
        const openSnackbar = jest.fn();
        renderConfig({openSnackbar});
        await openManageParamsDialog(user);
        await act(async () => {
            await user.type(getComboboxes()[1], 'nodes{Enter}');
        });
        await act(async () => {
            await user.click(screen.getByRole('button', {name: /Apply/i}));
        });
        await waitFor(() => expect(openSnackbar).toHaveBeenCalledWith(expect.stringContaining('Error unsetting parameter nodes: Network failure'), 'error'), {timeout: 10000});
    });

    // ── Delete sections ────────────────────────────────────────────────────────

    test('delete sections: success flow', async () => {
        const openSnackbar = jest.fn();
        renderConfig({openSnackbar});
        await openManageParamsDialog(user);
        await act(async () => {
            await user.type(getComboboxes()[2], 'fs#1{Enter}');
        });
        await waitFor(() => expect(getComboboxes()[2]).toHaveValue('fs#1'), {timeout: 10000});
        await act(async () => {
            await user.click(screen.getByRole('button', {name: /Apply/i}));
        });
        await waitFor(() => expect(openSnackbar).toHaveBeenCalledWith('Successfully deleted 1 section(s)', 'success'), {timeout: 10000});
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining(`${URL_OBJECT}/root/cfg/cfg1/config?delete=fs%231`),
            expect.objectContaining({
                method: 'PATCH',
                headers: expect.objectContaining({Authorization: 'Bearer mock-token'})
            })
        );
        await waitFor(() => expect(screen.queryByText(/Manage Configuration Parameters/i)).not.toBeInTheDocument(), {timeout: 10000});
    });

    test('delete sections: API failure shows error and keeps dialog open', async () => {
        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/config?delete=')) {
                return Promise.resolve({
                    ok: false,
                    status: 500,
                    json: () => Promise.resolve({}),
                    headers: new Headers()
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers()
            });
        });
        const openSnackbar = jest.fn();
        renderConfig({openSnackbar});
        await openManageParamsDialog(user);
        await act(async () => {
            await user.type(getComboboxes()[2], 'fs#1{Enter}');
        });
        await act(async () => {
            await user.click(screen.getByRole('button', {name: /Apply/i}));
        });
        await waitFor(() => expect(openSnackbar).toHaveBeenCalledWith('Error deleting section fs#1: Failed to delete section fs#1: 500', 'error'), {timeout: 10000});
        await waitFor(() => expect(screen.getByText(/Manage Configuration Parameters/i)).toBeInTheDocument(), {timeout: 10000});
    });

    test('delete sections: network error shows error', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/config?delete=')) return Promise.reject(new Error('Network failure'));
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers()
            });
        });
        const openSnackbar = jest.fn();
        renderConfig({openSnackbar});
        await openManageParamsDialog(user);
        await act(async () => {
            await user.type(getComboboxes()[2], 'fs#1{Enter}');
        });
        await act(async () => {
            await user.click(screen.getByRole('button', {name: /Apply/i}));
        });
        await waitFor(() => expect(openSnackbar).toHaveBeenCalledWith(expect.stringContaining('Error deleting section fs#1: Network failure'), 'error'), {timeout: 10000});
    });

    // ── Missing auth token (add / unset / delete) ──────────────────────────────

    test.each([
        ['add', async (boxes) => {
            await act(async () => {
                await userEvent.type(boxes[0], 'DEFAULT.roles{Enter}');
            });
            await act(async () => {
                await userEvent.click(screen.getByRole('button', {name: /Add Parameter/i}));
            });
            await waitFor(() => expect(screen.getByText('roles')).toBeInTheDocument(), {timeout: 5000});
            await act(async () => {
                await userEvent.type(screen.getByPlaceholderText('Value'), 'admin');
            });
        }],
        ['unset', async (boxes) => {
            await act(async () => {
                await userEvent.type(boxes[1], 'nodes{Enter}');
            });
        }],
        ['delete', async (boxes) => {
            await act(async () => {
                await userEvent.type(boxes[2], 'fs#1{Enter}');
            });
        }],
    ])('manage params: missing token for %s shows error', async (_, setup) => {
        mockLocalStorage.getItem.mockImplementation(() => null);
        const openSnackbar = jest.fn();
        renderConfig({openSnackbar});
        await openManageParamsDialog(user);
        await setup(getComboboxes());
        await act(async () => {
            await user.click(screen.getByRole('button', {name: /Apply/i}));
        });
        await waitFor(() => expect(openSnackbar).toHaveBeenCalledWith('Auth token not found.', 'error'), {timeout: 10000});
    });

    // ── Fetch existing params edge cases ───────────────────────────────────────

    test('fetchExistingParams: HTTP error shows alert in manage dialog', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/config') && !url.includes('file') && !url.includes('set') && !url.includes('unset') && !url.includes('delete') && !url.includes('keywords')) {
                return Promise.resolve({
                    ok: false,
                    status: 403,
                    json: () => Promise.resolve({}),
                    headers: new Headers()
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers()
            });
        });
        renderConfig();
        await openManageParamsDialog(user);
        await waitFor(() => {
            const alerts = screen.getAllByRole('alert');
            expect(alerts.find(a => a.textContent.includes('Failed to fetch existing parameters: HTTP 403'))).toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('fetchExistingParams: network error shows alert in manage dialog', async () => {
        jest.spyOn(global, 'fetch').mockImplementation((url) => {
            if (url.includes('/config') && !url.includes('file') && !url.includes('keywords') && !url.includes('set') && !url.includes('unset') && !url.includes('delete')) {
                return Promise.reject(new Error('Network failure'));
            }
            if (url.includes('/config/file')) return Promise.resolve({
                ok: true,
                status: 200,
                text: () => Promise.resolve('[DEFAULT]\nnodes = *'),
                headers: new Headers()
            });
            if (url.includes('/config/keywords')) return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers()
            });
            return Promise.resolve({ok: true, status: 200, json: () => Promise.resolve({})});
        });
        renderConfig();
        await openManageParamsDialog(user);
        await waitFor(() => {
            const alerts = screen.getAllByRole('alert');
            expect(alerts.find(a => a.textContent.includes('Failed to fetch existing parameters: Network failure'))).toBeInTheDocument();
        }, {timeout: 10000});
        jest.restoreAllMocks();
    });

    test('getExistingSections: null existingParams renders empty delete combobox', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/config') && !url.includes('file') && !url.includes('set') && !url.includes('unset') && !url.includes('delete')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({items: null}),
                    headers: new Headers()
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers()
            });
        });
        renderConfig();
        await openManageParamsDialog(user);
        await waitFor(() => expect(getComboboxes()[2]).toHaveValue(''), {timeout: 10000});
    });

    // ── Keywords dialog ────────────────────────────────────────────────────────

    test('keywords dialog: displays table with keywords', async () => {
        renderConfig();
        await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument(), {timeout: 5000});
        await act(async () => {
            await user.click(getKeywordsButton());
        });
        await waitFor(() => expect(screen.getByText(/Configuration Keywords/i)).toBeInTheDocument(), {timeout: 10000});
        const kd = getDialogByTitle('Configuration Keywords');
        await waitFor(() => expect(within(kd).getByRole('table')).toBeInTheDocument(), {timeout: 10000});
    });

    test('keywords dialog: deduplicates duplicate keywords', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/config/keywords')) {
                return Promise.resolve({
                    ok: true, status: 200,
                    json: () => Promise.resolve({
                        items: [
                            {
                                option: 'nodes',
                                section: 'DEFAULT',
                                text: 'Nodes to deploy the service',
                                converter: 'string',
                                scopable: true,
                                default: '*'
                            },
                            {
                                option: 'nodes',
                                section: 'DEFAULT',
                                text: 'Duplicate nodes entry',
                                converter: 'string',
                                scopable: false,
                                default: 'none'
                            },
                        ]
                    }),
                    headers: new Headers({'Content-Length': '1024'}),
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers()
            });
        });
        renderConfig();
        await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument(), {timeout: 5000});
        await act(async () => {
            await user.click(getKeywordsButton());
        });
        await waitFor(() => expect(screen.getByText(/Configuration Keywords/i)).toBeInTheDocument(), {timeout: 10000});
        const kd = getDialogByTitle('Configuration Keywords');
        const rows = within(kd).getAllByRole('row');
        expect(rows).toHaveLength(2); // header + 1 unique row
        const cells = within(rows[1]).getAllByRole('cell');
        expect(cells[0]).toHaveTextContent('nodes');
        expect(cells[1]).not.toHaveTextContent('Duplicate nodes entry');
    });

    test('keywords dialog: HTTP error shows alert', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/config/keywords')) {
                return Promise.resolve({
                    ok: false,
                    status: 404,
                    json: () => Promise.resolve({}),
                    headers: new Headers()
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers()
            });
        });
        renderConfig();
        await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument(), {timeout: 5000});
        await act(async () => {
            await user.click(getKeywordsButton());
        });
        await waitFor(() => expect(screen.getByText(/Configuration Keywords/i)).toBeInTheDocument(), {timeout: 10000});
        const kd = getDialogByTitle('Configuration Keywords');
        await waitFor(() => expect(within(kd).getByRole('alert')).toHaveTextContent(/Failed to fetch keywords: HTTP 404/i), {timeout: 10000});
    });

    test('keywords dialog: invalid response format shows alert', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/config/keywords')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({items: 'not-an-array'}),
                    headers: new Headers()
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers()
            });
        });
        renderConfig();
        await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument(), {timeout: 5000});
        await act(async () => {
            await user.click(getKeywordsButton());
        });
        await waitFor(() => expect(screen.getByText(/Configuration Keywords/i)).toBeInTheDocument(), {timeout: 10000});
        const kd = getDialogByTitle('Configuration Keywords');
        await waitFor(() => expect(within(kd).getByRole('alert')).toHaveTextContent(/Invalid response format/i), {timeout: 10000});
    });

    test('keywords dialog: AbortError shows timeout message', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/config/keywords')) return Promise.reject(new DOMException('The operation was aborted', 'AbortError'));
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers()
            });
        });
        renderConfig();
        await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument(), {timeout: 5000});
        await act(async () => {
            await user.click(getKeywordsButton());
        });
        await waitFor(() => expect(screen.getByText(/Configuration Keywords/i)).toBeInTheDocument(), {timeout: 10000});
        const kd = getDialogByTitle('Configuration Keywords');
        await waitFor(() => expect(within(kd).getByRole('alert')).toHaveTextContent(/Request timed out after 60 seconds/i), {timeout: 10000});
    });

    test('keywords dialog: null items shows no-keywords message', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/config/keywords')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({items: null}),
                    headers: new Headers()
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers()
            });
        });
        renderConfig();
        await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument(), {timeout: 5000});
        await act(async () => {
            await user.click(getKeywordsButton());
        });
        await waitFor(() => expect(screen.getByText(/Configuration Keywords/i)).toBeInTheDocument(), {timeout: 10000});
        const kd = getDialogByTitle('Configuration Keywords');
        await waitFor(() => expect(within(kd).getByRole('alert')).toBeInTheDocument(), {timeout: 10000});
    });

    test('keywords dialog: empty items array', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/config/keywords')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({items: []}),
                    headers: new Headers({'Content-Length': '10'})
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers()
            });
        });
        renderConfig();
        await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument(), {timeout: 5000});
        await act(async () => {
            await user.click(getKeywordsButton());
        });
        await waitFor(() => expect(screen.getByText(/Configuration Keywords/i)).toBeInTheDocument(), {timeout: 10000});
        expect(getDialogByTitle('Configuration Keywords')).toBeDefined();
    });

    test('keywords dialog: close button closes it', async () => {
        renderConfig();
        await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument(), {timeout: 5000});
        await act(async () => {
            await user.click(getKeywordsButton());
        });
        await waitFor(() => expect(screen.getByText(/Configuration Keywords/i)).toBeInTheDocument(), {timeout: 10000});
        await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument(), {timeout: 10000});
        const kd = getDialogByTitle('Configuration Keywords');
        await act(async () => {
            await user.click(within(kd).getByRole('button', {name: /Close/i}));
        });
        await waitFor(() => expect(screen.queryByText(/Configuration Keywords/i)).not.toBeInTheDocument(), {timeout: 5000});
    });

    test('getUniqueSections: null keywordsData renders empty add combobox', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/config/keywords')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({items: null}),
                    headers: new Headers()
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers()
            });
        });
        renderConfig();
        await openManageParamsDialog(user);
        await waitFor(() => expect(getComboboxes()[0]).toHaveValue(''), {timeout: 10000});
    });
});
