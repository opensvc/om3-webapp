import React from 'react';
import {render, screen, waitFor, act} from '@testing-library/react';
import ConfigSection from '../ConfigSection';
import userEvent from '@testing-library/user-event';
import {URL_OBJECT} from '../../config/apiPath.js';
import {within} from '@testing-library/react';

// Mock dependencies
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useParams: jest.fn(),
}));

// Mock Material-UI components
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
            <div role="alert" data-severity={severity} {...props}>
                {children}
            </div>
        ),
        Button: ({children, onClick, disabled, variant, component, htmlFor, ...props}) => (
            <button
                onClick={onClick}
                disabled={disabled}
                data-variant={variant}
                {...(component === 'label' ? {htmlFor} : {})}
                {...props}
            >
                {children}
            </button>
        ),
        TextField: ({label, value, onChange, disabled, type, inputProps, InputLabelProps, ...props}) => (
            <input
                type={type || 'text'}
                role="combobox"
                aria-label={InputLabelProps?.['aria-label'] || label || 'autocomplete-input'}
                aria-controls="text-field-options"
                aria-expanded={!!value}
                placeholder={props.placeholder || label || ''}
                value={value || ''}
                onChange={onChange}
                disabled={disabled}
                {...inputProps}
                {...props}
            />
        ),
        Autocomplete: ({options, getOptionLabel, onChange, multiple, renderInput, value, freeSolo, ...props}) => {
            const [inputValue, setInputValue] = useState(multiple
                ? (Array.isArray(value) ? value.map(item => typeof item === 'string' ? item : getOptionLabel(item)).join(', ') : '')
                : (value ? (typeof value === 'string' ? value : getOptionLabel(value)) : ''));
            const handleChange = (e) => {
                const inputText = e.target.value;
                setInputValue(inputText);
                const inputValues = multiple ? inputText.split(',').map((v) => v.trim()).filter(Boolean) : [inputText.trim()];
                let selectedOptions = inputValues.map((val) => {
                    const option = options.find((opt) => (typeof opt === 'string' ? opt : getOptionLabel(opt)) === val);
                    if (!option) {
                        if (freeSolo) {
                            return val;
                        } else if (multiple) {
                            if (options.length > 0 && typeof options[0] === 'object') {
                                return {option: val, section: val.includes('.') ? val.split('.')[0] : ''};
                            } else {
                                return val;
                            }
                        } else {
                            return null;
                        }
                    }
                    return option;
                }).filter(Boolean);
                onChange({}, multiple ? selectedOptions : selectedOptions[0] || (freeSolo ? inputText : null));
                const newValue = multiple
                    ? selectedOptions.map(item => typeof item === 'string' ? item : getOptionLabel(item)).join(', ')
                    : selectedOptions[0] ? (typeof selectedOptions[0] === 'string' ? selectedOptions[0] : getOptionLabel(selectedOptions[0])) : (freeSolo ? inputText : '');
                setInputValue(newValue);
                e.target.value = newValue;
            };

            const renderInputProps = renderInput({}) || {};
            const inputLabel = renderInputProps.InputLabelProps?.['aria-label'] || renderInputProps.label || 'autocomplete-input';

            return (
                <div {...props} data-testid="autocomplete">
                    {renderInput({
                        InputProps: {
                            endAdornment: <span>v</span>,
                        },
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
            <span
                style={{fontWeight: variant === 'body2' && fontWeight ? 'bold' : undefined, color, ...sx}}
                {...props}
            >
                {children}
            </span>
        ),
        Box: ({children, sx, ...props}) => <div style={sx} {...props}>{children}</div>,
        Tooltip: ({children, title}) => <span title={title}>{children}</span>,
        IconButton: ({children, onClick, disabled, 'aria-label': ariaLabel, ...props}) => (
            <button
                onClick={onClick}
                disabled={disabled}
                aria-label={ariaLabel}
                {...props}
            >
                {children}
            </button>
        ),
        TableContainer: ({children, ...props}) => <div {...props}>{children}</div>,
        Table: ({children, ...props}) => <table {...props}>{children}</table>,
        TableHead: ({children, ...props}) => <thead {...props}>{children}</thead>,
        TableBody: ({children, ...props}) => <tbody {...props}>{children}</tbody>,
        TableRow: ({children, ...props}) => <tr {...props}>{children}</tr>,
        TableCell: ({children, ...props}) => <td {...props}>{children}</td>,
        Paper: ({children, ...props}) => <div {...props}>{children}</div>,
    };
    const useMock = () => mocks.Autocomplete;
    useMock();
    return mocks;
});

// Mock Material-UI icons
jest.mock('@mui/icons-material/UploadFile', () => () => <span data-testid="UploadFileIcon"/>);
jest.mock('@mui/icons-material/Edit', () => () => <span data-testid="EditIcon"/>);
jest.mock('@mui/icons-material/Info', () => () => <span data-testid="InfoIcon"/>);
jest.mock('@mui/icons-material/Delete', () => () => <span data-testid="DeleteIcon"/>);

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
};
Object.defineProperty(global, 'localStorage', {value: mockLocalStorage});

describe('ConfigSection Component', () => {
    const user = userEvent.setup();
    const setConfigNode = jest.fn();
    const openSnackbar = jest.fn();
    const setConfigDialogOpen = jest.fn();

    beforeEach(() => {
        jest.setTimeout(30000);
        jest.clearAllMocks();
        mockLocalStorage.getItem.mockImplementation(() => 'mock-token');
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/cfg/cfg1',
        });

        global.fetch = jest.fn((url, options) => {
            const headers = options?.headers || {};
            if (url.includes('/config/file')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    text: () =>
                        Promise.resolve(`
[DEFAULT]
nodes = *
orchestrate = ha
[fs#1]
size = 10GB
                    `),
                    json: () => Promise.resolve({}),
                    headers: new Headers({Authorization: headers.Authorization || ''}),
                });
            }
            if (url.includes('/config/keywords')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            items: [
                                {
                                    option: 'nodes',
                                    section: 'DEFAULT',
                                    text: 'Nodes to deploy the service',
                                    converter: 'string',
                                    scopable: true,
                                    default: '*',
                                },
                                {
                                    option: 'size',
                                    section: 'fs',
                                    text: 'Size of filesystem',
                                    converter: 'string',
                                    scopable: false,
                                    default: '1GB',
                                },
                                {
                                    option: 'orchestrate',
                                    section: 'DEFAULT',
                                    text: 'Orchestration mode',
                                    converter: 'string',
                                    scopable: true,
                                    default: 'ha',
                                },
                                {
                                    option: 'roles',
                                    section: 'DEFAULT',
                                    text: 'Comma-separated roles',
                                    converter: 'converters.TListLowercase',
                                    scopable: true,
                                    default: '',
                                },
                            ],
                        }),
                    headers: new Headers({
                        Authorization: headers.Authorization || '',
                        'Content-Length': '1024',
                    }),
                });
            }
            if (url.includes('/config?set=') || url.includes('/config?unset=') || url.includes('/config?delete=')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({}),
                    text: () => Promise.resolve(''),
                    headers: new Headers({Authorization: headers.Authorization || ''}),
                });
            }
            if (url.includes('/config')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
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
                ok: true,
                status: 200,
                json: () => Promise.resolve({}),
                text: () => Promise.resolve(''),
                headers: new Headers({Authorization: headers.Authorization || ''}),
            });
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.resetAllMocks();
    });

    // Helper function to find buttons by their text content
    const getViewConfigButton = () => screen.getByText('View Configuration');
    const getUploadButton = () => screen.getByRole('button', {name: /Upload new configuration file/i});
    const getManageParamsButton = () => screen.getByRole('button', {name: /Manage configuration parameters/i});
    const getKeywordsButton = () => screen.getByRole('button', {name: /View configuration keywords/i});

    test('displays configuration button', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                configDialogOpen={false}
                setConfigDialogOpen={setConfigDialogOpen}
            />
        );

        expect(getViewConfigButton()).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('opens configuration dialog when button is clicked', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                configDialogOpen={false}
                setConfigDialogOpen={setConfigDialogOpen}
            />
        );

        const viewConfigButton = getViewConfigButton();
        await act(async () => {
            await user.click(viewConfigButton);
        });

        expect(setConfigDialogOpen).toHaveBeenCalledWith(true);
    });

    test('displays configuration dialog content when open', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                configDialogOpen={true}
                setConfigDialogOpen={setConfigDialogOpen}
            />
        );

        // Wait for the dialog to appear
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        }, {timeout: 5000});

        // Check for dialog title
        expect(screen.getByText('Configuration')).toBeInTheDocument();

        // Check for configuration content
        await waitFor(() => {
            expect(screen.getByText(/nodes = \*/i)).toBeInTheDocument();
        }, {timeout: 10000});

        await waitFor(() => {
            expect(screen.getByText(/orchestrate = ha/i)).toBeInTheDocument();
        }, {timeout: 10000});

        await waitFor(() => {
            expect(screen.getByText(/size = 10GB/i)).toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('displays error when fetching configuration fails', async () => {
        global.fetch.mockImplementationOnce(() =>
            Promise.resolve({
                ok: false,
                status: 500,
                text: () => Promise.resolve('Server error'),
            })
        );

        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                configDialogOpen={true}
                setConfigDialogOpen={setConfigDialogOpen}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        }, {timeout: 10000});

        expect(screen.getByRole('alert')).toHaveTextContent(/Failed to fetch config: HTTP 500/i);
    });

    test('displays loading indicator while fetching configuration', async () => {
        global.fetch.mockImplementation(() => new Promise(() => {
        })); // Simulates a pending request

        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                configDialogOpen={true}
                setConfigDialogOpen={setConfigDialogOpen}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        }, {timeout: 5000});
    });

    test('updates configuration file successfully', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                configDialogOpen={true}
                setConfigDialogOpen={setConfigDialogOpen}
            />
        );

        // Wait for the configuration dialog to appear
        await waitFor(() => {
            const dialogs = screen.getAllByRole('dialog');
            expect(dialogs.length).toBeGreaterThan(0);
        }, {timeout: 5000});

        // Click upload button
        const uploadButton = getUploadButton();
        await act(async () => {
            await user.click(uploadButton);
        });

        // Wait for update config dialog to appear
        await waitFor(() => {
            expect(screen.getByText(/Update Configuration/i)).toBeInTheDocument();
        }, {timeout: 5000});

        // Find file input and upload file
        const fileInput = document.querySelector('#update-config-file-upload');
        const testFile = new File(['[DEFAULT]\nnodes = node2'], 'config.ini');
        await act(async () => {
            await user.upload(fileInput, testFile);
        });

        await waitFor(() => {
            expect(screen.getByText('config.ini')).toBeInTheDocument();
        }, {timeout: 5000});

        // Find and click update button
        const updateButton = screen.getByRole('button', {name: /Update/i});
        await act(async () => {
            await user.click(updateButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Updating configuration…', 'info');
        }, {timeout: 10000});

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Configuration updated successfully');
        }, {timeout: 10000});

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining(`${URL_OBJECT}/root/cfg/cfg1/config/file`),
            expect.objectContaining({
                method: 'PUT',
                headers: expect.objectContaining({
                    Authorization: 'Bearer mock-token',
                    'Content-Type': 'application/octet-stream',
                }),
                body: testFile,
            })
        );

        await waitFor(() => {
            expect(screen.queryByText('Update Configuration')).not.toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('handles update config with missing file', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                configDialogOpen={true}
                setConfigDialogOpen={setConfigDialogOpen}
            />
        );

        // Wait for the configuration dialog to appear
        await waitFor(() => {
            const dialogs = screen.getAllByRole('dialog');
            expect(dialogs.length).toBeGreaterThan(0);
        }, {timeout: 5000});

        const uploadButton = getUploadButton();
        await act(async () => {
            await user.click(uploadButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/Update Configuration/i)).toBeInTheDocument();
        }, {timeout: 5000});

        const updateButton = screen.getByRole('button', {name: /Update/i});
        expect(updateButton).toBeDisabled();
        expect(openSnackbar).not.toHaveBeenCalled();
    });

    test('handles update config with missing token', async () => {
        mockLocalStorage.getItem.mockImplementation(() => null);

        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                configDialogOpen={true}
                setConfigDialogOpen={setConfigDialogOpen}
            />
        );

        // Wait for the configuration dialog to appear
        await waitFor(() => {
            const dialogs = screen.getAllByRole('dialog');
            expect(dialogs.length).toBeGreaterThan(0);
        }, {timeout: 5000});

        const uploadButton = getUploadButton();
        await act(async () => {
            await user.click(uploadButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/Update Configuration/i)).toBeInTheDocument();
        }, {timeout: 5000});

        const fileInput = document.querySelector('#update-config-file-upload');
        const testFile = new File(['new config content'], 'config.ini');
        await act(async () => {
            await user.upload(fileInput, testFile);
        });

        const updateButton = screen.getByRole('button', {name: /Update/i});
        await act(async () => {
            await user.click(updateButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Auth token not found.', 'error');
        }, {timeout: 10000});

        expect(global.fetch).not.toHaveBeenCalledWith(
            expect.stringContaining(`${URL_OBJECT}/root/cfg/cfg1/config/file`),
            expect.any(Object)
        );

        // The update dialog should still be open
        await waitFor(() => {
            expect(screen.getByText('Update Configuration')).toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('handles update config with API failure', async () => {
        mockLocalStorage.getItem.mockImplementation(() => 'mock-token');
        global.fetch.mockImplementation((url, options) => {
            const headers = options?.headers || {};
            if (url.includes('/config/file')) {
                return Promise.resolve({
                    ok: false,
                    status: 500,
                    text: () => Promise.resolve('Server error'),
                    headers: new Headers({Authorization: headers.Authorization || ''}),
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                text: () => Promise.resolve(''),
                headers: new Headers({Authorization: headers.Authorization || ''}),
            });
        });

        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                configDialogOpen={true}
                setConfigDialogOpen={setConfigDialogOpen}
            />
        );

        // Wait for the configuration dialog to appear
        await waitFor(() => {
            const dialogs = screen.getAllByRole('dialog');
            expect(dialogs.length).toBeGreaterThan(0);
        }, {timeout: 5000});

        const uploadButton = getUploadButton();
        await act(async () => {
            await user.click(uploadButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/Update Configuration/i)).toBeInTheDocument();
        }, {timeout: 5000});

        const fileInput = document.querySelector('#update-config-file-upload');
        const testFile = new File(['new config content'], 'config.ini');
        await act(async () => {
            await user.upload(fileInput, testFile);
        });

        const updateButton = screen.getByRole('button', {name: /Update/i});
        await act(async () => {
            await user.click(updateButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Updating configuration…', 'info');
        }, {timeout: 10000});

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Error: Failed to update config: 500', 'error');
        }, {timeout: 10000});

        await waitFor(() => {
            expect(screen.queryByText('Update Configuration')).not.toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('handles add parameters with invalid parameter', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                configDialogOpen={true}
                setConfigDialogOpen={setConfigDialogOpen}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        }, {timeout: 5000});

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/Manage Configuration Parameters/i)).toBeInTheDocument();
        }, {timeout: 10000});

        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, {timeout: 10000});

        const comboboxes = screen.getAllByRole('combobox', {name: /autocomplete-input/i});
        const addParamsInput = comboboxes[0]; // First combobox for add parameters
        await act(async () => {
            await user.type(addParamsInput, 'invalid_param{Enter}');
        });

        await waitFor(() => {
            expect(addParamsInput).toHaveValue('invalid_param');
        }, {timeout: 5000});

        const addButton = screen.getByRole('button', {name: /Add Parameter/i});
        await act(async () => {
            await user.click(addButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Invalid parameter: invalid_param', 'error');
        }, {timeout: 10000});
    });

    test('handles add parameters with invalid index for indexed parameter', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                configDialogOpen={true}
                setConfigDialogOpen={setConfigDialogOpen}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        }, {timeout: 5000});

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/Manage Configuration Parameters/i)).toBeInTheDocument();
        }, {timeout: 10000});

        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, {timeout: 10000});

        const comboboxes = screen.getAllByRole('combobox', {name: /autocomplete-input/i});
        const addParamsInput = comboboxes[0];
        await act(async () => {
            await user.type(addParamsInput, 'fs.size{Enter}');
        });

        await waitFor(() => {
            expect(addParamsInput).toHaveValue('fs.size');
        }, {timeout: 5000});

        const addButton = screen.getByRole('button', {name: /Add Parameter/i});
        await act(async () => {
            await user.click(addButton);
        });

        await waitFor(() => {
            expect(screen.getByText('size')).toBeInTheDocument();
        }, {timeout: 5000});

        const sectionInput = screen.getByPlaceholderText('Index e.g. 1');

        await act(async () => {
            await user.clear(sectionInput);
            await user.type(sectionInput, '-1');
        });

        const valueInput = screen.getByLabelText('Value');
        await act(async () => {
            await user.type(valueInput, '20GB');
        });

        const applyButton = screen.getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Invalid index for size: must be a non-negative integer', 'error');
        }, {timeout: 10000});
    });

    test('handles add parameters successfully with indexed section', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                configDialogOpen={true}
                setConfigDialogOpen={setConfigDialogOpen}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        }, {timeout: 5000});

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/Manage Configuration Parameters/i)).toBeInTheDocument();
        }, {timeout: 10000});

        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, {timeout: 10000});

        const comboboxes = screen.getAllByRole('combobox', {name: /autocomplete-input/i});
        const addParamsInput = comboboxes[0]; // First combobox for add parameters
        await act(async () => {
            await user.type(addParamsInput, 'fs.size{Enter}');
        });

        await waitFor(() => {
            expect(addParamsInput).toHaveValue('fs.size');
        }, {timeout: 5000});

        const addButton = screen.getByRole('button', {name: /Add Parameter/i});
        await act(async () => {
            await user.click(addButton);
        });

        await waitFor(() => {
            expect(screen.getByText('size')).toBeInTheDocument();
        }, {timeout: 5000});

        const sectionInput = screen.getByPlaceholderText('Index e.g. 1');
        await act(async () => {
            await user.type(sectionInput, '2');
        });

        const valueInput = screen.getByLabelText('Value');
        await act(async () => {
            await user.type(valueInput, '20GB');
        });

        const applyButton = screen.getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Successfully added 1 parameter(s)', 'success');
        }, {timeout: 10000});
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining(`${URL_OBJECT}/root/cfg/cfg1/config?set=fs%232.size=20GB`),
            expect.objectContaining({
                method: 'PATCH',
                headers: expect.objectContaining({
                    Authorization: 'Bearer mock-token',
                }),
            })
        );
        await waitFor(() => {
            expect(screen.queryByText(/Manage Configuration Parameters/i)).not.toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('handles unset parameters successfully', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                configDialogOpen={true}
                setConfigDialogOpen={setConfigDialogOpen}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        }, {timeout: 5000});

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/Manage Configuration Parameters/i)).toBeInTheDocument();
        }, {timeout: 10000});

        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, {timeout: 10000});

        const comboboxes = screen.getAllByRole('combobox', {name: /autocomplete-input/i});
        const unsetParamsInput = comboboxes[1]; // Second combobox for unset parameters
        await act(async () => {
            await user.type(unsetParamsInput, 'nodes{Enter}');
        });

        await waitFor(() => {
            expect(unsetParamsInput).toHaveValue('nodes');
        }, {timeout: 10000});

        const applyButton = screen.getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Successfully unset 1 parameter(s)', 'success');
        }, {timeout: 10000});
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining(`${URL_OBJECT}/root/cfg/cfg1/config?unset=nodes`),
            expect.objectContaining({
                method: 'PATCH',
                headers: expect.objectContaining({
                    Authorization: 'Bearer mock-token',
                }),
            })
        );
        await waitFor(() => {
            expect(screen.queryByText(/Manage Configuration Parameters/i)).not.toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('handles unset parameters with API failure', async () => {
        global.fetch.mockImplementation((url, options) => {
            const headers = options?.headers || {};
            if (url.includes('/config?unset=')) {
                return Promise.resolve({
                    ok: false,
                    status: 500,
                    json: () => Promise.resolve({}),
                    headers: new Headers({Authorization: headers.Authorization || ''}),
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers({Authorization: headers.Authorization || ''}),
            });
        });

        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                configDialogOpen={true}
                setConfigDialogOpen={setConfigDialogOpen}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        }, {timeout: 5000});

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/Manage Configuration Parameters/i)).toBeInTheDocument();
        }, {timeout: 10000});

        const comboboxes = screen.getAllByRole('combobox', {name: /autocomplete-input/i});
        const unsetParamsInput = comboboxes[1]; // Second combobox for unset parameters
        await act(async () => {
            await user.type(unsetParamsInput, 'nodes{Enter}');
        });

        await waitFor(() => {
            expect(unsetParamsInput).toHaveValue('nodes');
        }, {timeout: 10000});

        const applyButton = screen.getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith(
                'Error unsetting parameter nodes: Failed to unset parameter nodes: 500',
                'error'
            );
        }, {timeout: 10000});
        await waitFor(() => {
            expect(screen.getByText(/Manage Configuration Parameters/i)).toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('handles delete sections successfully', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                configDialogOpen={true}
                setConfigDialogOpen={setConfigDialogOpen}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        }, {timeout: 5000});

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/Manage Configuration Parameters/i)).toBeInTheDocument();
        }, {timeout: 10000});

        const comboboxes = screen.getAllByRole('combobox', {name: /autocomplete-input/i});
        const deleteSectionsInput = comboboxes[2]; // Third combobox for delete sections
        await act(async () => {
            await user.type(deleteSectionsInput, 'fs#1{Enter}');
        });

        await waitFor(() => {
            expect(deleteSectionsInput).toHaveValue('fs#1');
        }, {timeout: 10000});

        const applyButton = screen.getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Successfully deleted 1 section(s)', 'success');
        }, {timeout: 10000});
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining(`${URL_OBJECT}/root/cfg/cfg1/config?delete=fs%231`),
            expect.objectContaining({
                method: 'PATCH',
                headers: expect.objectContaining({
                    Authorization: 'Bearer mock-token',
                }),
            })
        );
        await waitFor(() => {
            expect(screen.queryByText(/Manage Configuration Parameters/i)).not.toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('handles delete sections with API failure', async () => {
        global.fetch.mockImplementation((url, options) => {
            const headers = options?.headers || {};
            if (url.includes('/config?delete=')) {
                return Promise.resolve({
                    ok: false,
                    status: 500,
                    json: () => Promise.resolve({}),
                    headers: new Headers({Authorization: headers.Authorization || ''}),
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers({Authorization: headers.Authorization || ''}),
            });
        });

        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                configDialogOpen={true}
                setConfigDialogOpen={setConfigDialogOpen}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        }, {timeout: 5000});

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/Manage Configuration Parameters/i)).toBeInTheDocument();
        }, {timeout: 10000});

        const comboboxes = screen.getAllByRole('combobox', {name: /autocomplete-input/i});
        const deleteSectionsInput = comboboxes[2];
        await act(async () => {
            await user.type(deleteSectionsInput, 'fs#1{Enter}');
        });

        await waitFor(() => {
            expect(deleteSectionsInput).toHaveValue('fs#1');
        }, {timeout: 10000});

        const applyButton = screen.getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Error deleting section fs#1: Failed to delete section fs#1: 500', 'error');
        }, {timeout: 10000});
        await waitFor(() => {
            expect(screen.getByText(/Manage Configuration Parameters/i)).toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('handles manage params submit with no selections', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                configDialogOpen={true}
                setConfigDialogOpen={setConfigDialogOpen}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        }, {timeout: 5000});

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/Manage Configuration Parameters/i)).toBeInTheDocument();
        }, {timeout: 10000});

        const applyButton = screen.getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('No selection made', 'error');
        }, {timeout: 10000});
        await waitFor(() => {
            expect(screen.getByText(/Manage Configuration Parameters/i)).toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('closes configuration dialog when close button is clicked', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                configDialogOpen={true}
                setConfigDialogOpen={setConfigDialogOpen}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        }, {timeout: 5000});

        const closeButton = screen.getByRole('button', {name: /Close/i});
        await act(async () => {
            await user.click(closeButton);
        });

        expect(setConfigDialogOpen).toHaveBeenCalledWith(false);
    });
});
