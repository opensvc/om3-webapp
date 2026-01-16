import React from 'react';
import {render, screen, waitFor, act} from '@testing-library/react';
import ConfigSection from '../ConfigSection';
import userEvent from '@testing-library/user-event';
import {URL_OBJECT, URL_NODE} from '../../config/apiPath.js';
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
        Collapse: ({children, in: inProp, ...props}) =>
            inProp ? <div data-testid="collapse-content">{children}</div> : null,

        Accordion: ({children, expanded, onChange, ...props}) => (
            <div data-testid="accordion" className={expanded ? 'expanded' : ''} {...props}>
                {children}
            </div>
        ),
        AccordionSummary: ({children, id, onChange, expanded, ...props}) => (
            <div
                role="button"
                data-testid="accordion-summary"
                aria-expanded={expanded ? 'true' : 'false'}
                onClick={() => onChange?.({}, !expanded)}
                {...props}
            >
                {children}
            </div>
        ),
        AccordionDetails: ({children, ...props}) => (
            <div data-testid="accordion-details" {...props}>
                {children}
            </div>
        ),
        Dialog: ({children, open, maxWidth, fullWidth, ...props}) =>
            open ? <div role="dialog" {...props}>{children}</div> : null,
        DialogTitle: ({children, ...props}) => <div {...props}>{children}</div>,
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
        IconButton: ({children, onClick, disabled, ...props}) => (
            <button onClick={onClick} disabled={disabled} {...props}>
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
jest.mock('@mui/icons-material/ExpandMore', () => () => <span data-testid="ExpandMoreIcon"/>);
jest.mock('@mui/icons-material/ExpandLess', () => () => <span data-testid="ExpandLessIcon"/>);
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

    const getUploadButton = () => screen.getByRole('button', {name: /Upload new configuration file/i});
    const getManageParamsButton = () => screen.getByRole('button', {name: /Manage configuration parameters/i});
    const getKeywordsButton = () => screen.getByRole('button', {name: /View configuration keywords/i});

    test('displays configuration with horizontal scrolling', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/nodes = \*/i)).toBeInTheDocument();
        }, {timeout: 10000});
        await waitFor(() => {
            expect(screen.getByText(/orchestrate = ha/i)).toBeInTheDocument();
        }, {timeout: 10000});
        await waitFor(() => {
            expect(screen.getByText(/size = 10GB/i)).toBeInTheDocument();
        }, {timeout: 10000});

        const configContent = screen.getByTestId('collapse-content');
        expect(configContent).toBeInTheDocument();

        const scrollableBox = configContent.querySelector('div[style*="overflow-x: auto"]');
        expect(scrollableBox).toBeInTheDocument();
        expect(scrollableBox).toHaveStyle({'overflow-x': 'auto'});
    }, 15000);

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
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/Failed to fetch config: HTTP 500/i);
        }, {timeout: 10000});
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
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        }, {timeout: 5000});
    });

    test('displays no configuration when configNode is missing', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode=""
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/No node available to fetch configuration/i);
        }, {timeout: 5000});

        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('updates configuration file successfully', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const uploadButton = getUploadButton();
        await act(async () => {
            await user.click(uploadButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Update Configuration/i);
        }, {timeout: 5000});

        // eslint-disable-next-line testing-library/no-node-access
        const fileInput = document.querySelector('#update-config-file-upload');
        const testFile = new File(['[DEFAULT]\nnodes = node2'], 'config.ini');
        await act(async () => {
            await user.upload(fileInput, testFile);
        });

        await waitFor(() => {
            expect(screen.getByText('config.ini')).toBeInTheDocument();
        }, {timeout: 5000});

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
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('handles update config with missing file', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const uploadButton = getUploadButton();
        await act(async () => {
            await user.click(uploadButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Update Configuration/i);
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
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const uploadButton = getUploadButton();
        await act(async () => {
            await user.click(uploadButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Update Configuration/i);
        }, {timeout: 5000});

        // eslint-disable-next-line testing-library/no-node-access
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

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
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
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const uploadButton = getUploadButton();
        await act(async () => {
            await user.click(uploadButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Update Configuration/i);
        }, {timeout: 5000});

        // eslint-disable-next-line testing-library/no-node-access
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
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('parses object path with edge cases', async () => {
        render(
            <ConfigSection
                decodedObjectName={null}
                configNode=""
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('No node available to fetch configuration');
        }, {timeout: 5000});

        jest.clearAllMocks();

        render(
            <ConfigSection
                decodedObjectName="cluster"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining(`${URL_NODE}/node1/instance/path/root/ccfg/cluster/config/file`),
                expect.any(Object)
            );
        }, {timeout: 10000});
    });

    test('debounces fetchConfig calls', async () => {
        const onToggle = jest.fn();
        const {rerender} = render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={onToggle}
            />
        );

        await act(async () => {
            rerender(
                <ConfigSection
                    decodedObjectName="root/cfg/cfg1"
                    configNode="node1"
                    setConfigNode={setConfigNode}
                    openSnackbar={openSnackbar}
                    expanded={true}
                    onToggle={onToggle}
                />
            );
        });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(1);
        }, {timeout: 2000});
    });

    test('displays keywords dialog and its content', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const keywordsButton = getKeywordsButton();
        await act(async () => {
            await user.click(keywordsButton);
        });

        await waitFor(() => {
            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveTextContent(/Configuration Keywords/i);
        }, {timeout: 10000});

        const dialog = screen.getByRole('dialog');
        const table = within(dialog).getByRole('table');

        await waitFor(() => {
            expect(within(table).getByRole('row', {name: /nodes/})).toBeInTheDocument();
        }, {timeout: 10000});

        await waitFor(() => {
            expect(within(table).getByRole('row', {name: /size/})).toBeInTheDocument();
        }, {timeout: 10000});

        const nodesRow = within(table).getByRole('row', {name: /nodes/});
        expect(within(nodesRow).getByText('Nodes to deploy the service')).toBeInTheDocument();
        expect(within(nodesRow).getByText('string')).toBeInTheDocument();
        expect(within(nodesRow).getByText('DEFAULT')).toBeInTheDocument();
        expect(within(nodesRow).getByText('Yes')).toBeInTheDocument();

        const sizeRow = within(table).getByRole('row', {name: /size/});
        expect(within(sizeRow).getByText('Size of filesystem')).toBeInTheDocument();
        expect(within(sizeRow).getByText('fs')).toBeInTheDocument();
        expect(within(sizeRow).getByText('No')).toBeInTheDocument();

        const closeButton = screen.getByRole('button', {name: /Close/i});
        await act(async () => {
            await user.click(closeButton);
        });

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        }, {timeout: 5000});
    });

    test('handles keywords fetch timeout', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/config/keywords')) {
                return new Promise((resolve, reject) => {
                    setTimeout(() => {
                        const error = new Error('Request timed out');
                        error.name = 'AbortError';
                        reject(error);
                    }, 1000);
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers(),
            });
        });

        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const keywordsButton = getKeywordsButton();
        await act(async () => {
            await user.click(keywordsButton);
        });

        await waitFor(() => {
            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveTextContent(/Configuration Keywords/i);
        }, {timeout: 2000});

        await waitFor(() => {
            const alert = within(screen.getByRole('dialog')).getByRole('alert');
            expect(alert).toHaveTextContent(/Request timed out after 60 seconds/i);
        }, {timeout: 2000});
    });

    test('handles keywords fetch with invalid response', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/config/keywords')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({}),
                    headers: new Headers({'Content-Length': '0'}),
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers(),
            });
        });

        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const keywordsButton = getKeywordsButton();
        await act(async () => {
            await user.click(keywordsButton);
        });
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Configuration Keywords/i);
        }, {timeout: 10000});
        await waitFor(() => {
            const dialog = screen.getByRole('dialog');
            const alert = within(dialog).getByRole('alert');
            expect(alert).toHaveTextContent(/Invalid response format: missing items/i);
        }, {timeout: 10000});
    });

    test('displays no keywords when none are available', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/config/keywords')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({items: []}),
                    headers: new Headers(),
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers(),
            });
        });

        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const keywordsButton = getKeywordsButton();
        await act(async () => {
            await user.click(keywordsButton);
        });
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Configuration Keywords/i);
        }, {timeout: 10000});
        await waitFor(() => {
            const dialog = screen.getByRole('dialog');
            const table = within(dialog).getByRole('table');
            const rows = within(table).getAllByRole('row');
            expect(rows).toHaveLength(1); // Only header row
        }, {timeout: 10000});
    });

    test('handles add parameters with invalid parameter', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Manage Configuration Parameters/i);
        }, {timeout: 10000});

        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, {timeout: 10000});

        const dialog = screen.getByRole('dialog');
        const comboboxes = within(dialog).getAllByRole('combobox', {name: /autocomplete-input/i});
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
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Manage Configuration Parameters/i);
        }, {timeout: 10000});

        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, {timeout: 10000});

        const dialog = screen.getByRole('dialog');
        const comboboxes = within(dialog).getAllByRole('combobox', {name: /autocomplete-input/i});
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

        const applyButton = within(dialog).getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Invalid index for size: must be a non-negative integer', 'error');
        }, {timeout: 10000});
    });

    test('handles add parameters with missing section for non-DEFAULT keyword', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Manage Configuration Parameters/i);
        }, {timeout: 10000});

        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, {timeout: 10000});

        const dialog = screen.getByRole('dialog');
        const comboboxes = within(dialog).getAllByRole('combobox', {name: /autocomplete-input/i});
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
            await user.clear(sectionInput);
        });

        const valueInput = screen.getByLabelText('Value');
        await act(async () => {
            await user.type(valueInput, '20GB');
        });

        const applyButton = within(dialog).getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Section index is required for parameter: size', 'error');
        }, {timeout: 10000});
    });

    test('handles add parameters successfully with indexed section', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Manage Configuration Parameters/i);
        }, {timeout: 10000});

        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, {timeout: 10000});

        const dialog = screen.getByRole('dialog');
        const comboboxes = within(dialog).getAllByRole('combobox', {name: /autocomplete-input/i});
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

        const applyButton = within(dialog).getByRole('button', {name: /Apply/i});
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
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('handles unset parameters successfully', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Manage Configuration Parameters/i);
        }, {timeout: 10000});

        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, {timeout: 10000});

        const dialog = screen.getByRole('dialog');
        const comboboxes = within(dialog).getAllByRole('combobox', {name: /autocomplete-input/i});
        const unsetParamsInput = comboboxes[1]; // Second combobox for unset parameters
        await act(async () => {
            await user.type(unsetParamsInput, 'nodes{Enter}');
        });

        await waitFor(() => {
            expect(unsetParamsInput).toHaveValue('nodes');
        }, {timeout: 10000});

        const applyButton = within(dialog).getByRole('button', {name: /Apply/i});
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
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Manage Configuration Parameters/i);
        }, {timeout: 10000});

        const dialog = screen.getByRole('dialog');
        const comboboxes = within(dialog).getAllByRole('combobox', {name: /autocomplete-input/i});
        const unsetParamsInput = comboboxes[1]; // Second combobox for unset parameters
        await act(async () => {
            await user.type(unsetParamsInput, 'nodes{Enter}');
        });

        await waitFor(() => {
            expect(unsetParamsInput).toHaveValue('nodes');
        }, {timeout: 10000});

        const applyButton = within(dialog).getByRole('button', {name: /Apply/i});
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
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('handles getUniqueSections with null keywordsData', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/config/keywords')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({items: null}),
                    headers: new Headers(),
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers(),
            });
        });

        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Manage Configuration Parameters/i);
        }, {timeout: 10000});
        const comboboxes = within(screen.getByRole('dialog')).getAllByRole('combobox', {
            name: /autocomplete-input/i,
        });
        const addParamsInput = comboboxes[0];
        await waitFor(() => {
            expect(addParamsInput).toHaveValue('');
        }, {timeout: 10000});
    });

    test('handles getExistingSections with null existingParams', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/config') && !url.includes('file') && !url.includes('set') && !url.includes('unset') && !url.includes('delete')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({items: null}),
                    headers: new Headers(),
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers(),
            });
        });

        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Manage Configuration Parameters/i);
        }, {timeout: 10000});
        const comboboxes = within(screen.getByRole('dialog')).getAllByRole('combobox', {
            name: /autocomplete-input/i,
        });
        const deleteSectionsInput = comboboxes[2];
        await waitFor(() => {
            expect(deleteSectionsInput).toHaveValue('');
        }, {timeout: 10000});
    });

    test('handles duplicate keywords in keywords dialog', async () => {
        global.fetch.mockImplementation((url) => {
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
                                    option: 'nodes',
                                    section: 'DEFAULT',
                                    text: 'Duplicate nodes entry',
                                    converter: 'string',
                                    scopable: false,
                                    default: 'none',
                                },
                            ],
                        }),
                    headers: new Headers({'Content-Length': '1024'}),
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers(),
            });
        });

        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const keywordsButton = getKeywordsButton();
        await act(async () => {
            await user.click(keywordsButton);
        });

        await waitFor(() => {
            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveTextContent(/Configuration Keywords/i);
        }, {timeout: 10000});
        await waitFor(() => {
            const dialog = screen.getByRole('dialog');
            const table = within(dialog).getByRole('table');
            const rows = within(table).getAllByRole('row');
            expect(rows).toHaveLength(2); // Header row + one data row (duplicate filtered)
        }, {timeout: 10000});
        await waitFor(() => {
            const dialog = screen.getByRole('dialog');
            const table = within(dialog).getByRole('table');
            const nodesRow = within(table).getByRole('row', {name: /nodes/});
            expect(within(nodesRow).getByText('Nodes to deploy the service')).toBeInTheDocument();
        }, {timeout: 10000});
        await waitFor(() => {
            const dialog = screen.getByRole('dialog');
            const table = within(dialog).getByRole('table');
            const nodesRow = within(table).getByRole('row', {name: /nodes/});
            expect(within(nodesRow).queryByText('Duplicate nodes entry')).not.toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('handles update config with no configNode', async () => {
        global.fetch.mockImplementation((url, options) => {
            const headers = options?.headers || {};
            if (url.includes('/config/file')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    text: () => Promise.resolve(''),
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
                configNode=""
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const uploadButton = getUploadButton();
        await act(async () => {
            await user.click(uploadButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Update Configuration/i);
        }, {timeout: 5000});
        // eslint-disable-next-line testing-library/no-node-access
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
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('handles unset parameters with missing token', async () => {
        mockLocalStorage.getItem.mockImplementation(() => null);
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Manage Configuration Parameters/i);
        }, {timeout: 10000});

        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, {timeout: 10000});

        const dialog = screen.getByRole('dialog');
        const comboboxes = within(dialog).getAllByRole('combobox', {name: /autocomplete-input/i});
        const unsetParamsInput = comboboxes[1]; // Second combobox for unset parameters
        await act(async () => {
            await user.type(unsetParamsInput, 'nodes{Enter}');
        });

        await waitFor(() => {
            expect(unsetParamsInput).toHaveValue('nodes');
        }, {timeout: 10000});

        const applyButton = within(dialog).getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Auth token not found.', 'error');
        }, {timeout: 10000});
        expect(global.fetch).not.toHaveBeenCalledWith(
            expect.stringContaining(`${URL_OBJECT}/root/cfg/cfg1/config?unset=nodes`),
            expect.any(Object)
        );
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('handles delete sections with missing token', async () => {
        mockLocalStorage.getItem.mockImplementation(() => null);
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Manage Configuration Parameters/i);
        }, {timeout: 10000});

        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, {timeout: 10000});

        const dialog = screen.getByRole('dialog');
        const comboboxes = within(dialog).getAllByRole('combobox', {name: /autocomplete-input/i});
        const deleteSectionsInput = comboboxes[2]; // Third combobox for delete sections
        await act(async () => {
            await user.type(deleteSectionsInput, 'fs#1{Enter}');
        });

        await waitFor(() => {
            expect(deleteSectionsInput).toHaveValue('fs#1');
        }, {timeout: 10000});

        const applyButton = within(dialog).getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Auth token not found.', 'error');
        }, {timeout: 10000});
        expect(global.fetch).not.toHaveBeenCalledWith(
            expect.stringContaining(`${URL_OBJECT}/root/cfg/cfg1/config?delete=fs%231`),
            expect.any(Object)
        );
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('handles add parameters with indexed section', async () => {
        global.fetch.mockImplementation((url, options) => {
            const headers = options?.headers || {};
            if (url.includes('/config/keywords')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            items: [
                                {
                                    option: 'timeout',
                                    section: 'task',
                                    text: 'Task timeout duration',
                                    converter: 'string',
                                    scopable: false,
                                    default: '30s',
                                },
                            ],
                        }),
                    headers: new Headers({Authorization: headers.Authorization || '', 'Content-Length': '1024'}),
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
                    json: () => Promise.resolve({items: []}),
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
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Manage Configuration Parameters/i);
        }, {timeout: 10000});

        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, {timeout: 10000});

        const dialog = screen.getByRole('dialog');
        const comboboxes = within(dialog).getAllByRole('combobox', {name: /autocomplete-input/i});
        const addParamsInput = comboboxes[0]; // First combobox for add parameters
        await act(async () => {
            await user.type(addParamsInput, 'task.timeout{Enter}');
        });

        await waitFor(() => {
            expect(addParamsInput).toHaveValue('task.timeout');
        }, {timeout: 5000});

        const addButton = screen.getByRole('button', {name: /Add Parameter/i});
        await act(async () => {
            await user.click(addButton);
        });

        await waitFor(() => {
            expect(screen.getByText('timeout')).toBeInTheDocument();
        }, {timeout: 5000});

        const sectionInput = screen.getByPlaceholderText('Index e.g. 1');
        await act(async () => {
            await user.clear(sectionInput);
            await user.type(sectionInput, '1');
        });

        const valueInput = screen.getByLabelText('Value');
        await act(async () => {
            await user.type(valueInput, '60s');
        });

        const applyButton = within(dialog).getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Successfully added 1 parameter(s)', 'success');
        }, {timeout: 10000});
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining(`${URL_OBJECT}/root/cfg/cfg1/config?set=task%231.timeout=60s`),
            expect.objectContaining({
                method: 'PATCH',
                headers: expect.objectContaining({
                    Authorization: 'Bearer mock-token',
                }),
            })
        );
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('handles delete sections successfully', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Manage Configuration Parameters/i);
        }, {timeout: 10000});

        const dialog = screen.getByRole('dialog');
        const comboboxes = within(dialog).getAllByRole('combobox', {name: /autocomplete-input/i});
        const deleteSectionsInput = comboboxes[2]; // Third combobox for delete sections
        await act(async () => {
            await user.type(deleteSectionsInput, 'fs#1{Enter}');
        });

        await waitFor(() => {
            expect(deleteSectionsInput).toHaveValue('fs#1');
        }, {timeout: 10000});

        const applyButton = within(dialog).getByRole('button', {name: /Apply/i});
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
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Manage Configuration Parameters/i);
        }, {timeout: 10000});

        const dialog = screen.getByRole('dialog');
        const comboboxes = within(dialog).getAllByRole('combobox', {name: /autocomplete-input/i});
        const deleteSectionsInput = comboboxes[2];
        await act(async () => {
            await user.type(deleteSectionsInput, 'fs#1{Enter}');
        });

        await waitFor(() => {
            expect(deleteSectionsInput).toHaveValue('fs#1');
        }, {timeout: 10000});

        const applyButton = within(dialog).getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Error deleting section fs#1: Failed to delete section fs#1: 500', 'error');
        }, {timeout: 10000});
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('handles manage params submit with no selections', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Manage Configuration Parameters/i);
        }, {timeout: 10000});

        const dialog = screen.getByRole('dialog');
        const applyButton = within(dialog).getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('No selection made', 'error');
        }, {timeout: 10000});
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('handles fetchConfig error with network failure', async () => {
        global.fetch.mockImplementationOnce(() =>
            Promise.reject(new Error('Network error'))
        );

        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/Failed to fetch config: Network error/i);
        }, {timeout: 10000});
    });

    test('handles fetchKeywords with network error', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/config/keywords')) {
                return Promise.reject(new Error('Network error'));
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers(),
            });
        });

        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const keywordsButton = getKeywordsButton();
        await act(async () => {
            await user.click(keywordsButton);
        });

        await waitFor(() => {
            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveTextContent(/Configuration Keywords/i);
        }, {timeout: 10000});
        await waitFor(() => {
            const dialog = screen.getByRole('dialog');
            const alert = within(dialog).getByRole('alert');
            expect(alert).toHaveTextContent(/Failed to fetch keywords: Network error/i);
        }, {timeout: 10000});
    });

    test('handles fetchExistingParams with network error', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/config') && !url.includes('file') && !url.includes('set') && !url.includes('unset') && !url.includes('delete')) {
                return Promise.reject(new Error('Network error'));
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers(),
            });
        });

        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Manage Configuration Parameters/i);
        }, {timeout: 10000});
        await waitFor(() => {
            const dialog = screen.getByRole('dialog');
            const alerts = within(dialog).getAllByRole('alert');
            const existingParamsError = alerts.find(alert =>
                alert.textContent.includes('Failed to fetch existing parameters')
            );
            expect(existingParamsError).toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('handles add parameters with decimal index', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Manage Configuration Parameters/i);
        }, {timeout: 10000});

        const dialog = screen.getByRole('dialog');
        const comboboxes = within(dialog).getAllByRole('combobox', {name: /autocomplete-input/i});
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
            await user.type(sectionInput, '1.5'); // Decimal index
        });

        const valueInput = screen.getByLabelText('Value');
        await act(async () => {
            await user.type(valueInput, '20GB');
        });

        const applyButton = within(dialog).getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Invalid index for size: must be a non-negative integer', 'error');
        }, {timeout: 10000});
    });

    test('handles unset parameters with undefined option', async () => {
        const originalFetch = global.fetch;
        global.fetch = jest.fn((url) => {
            if (url.includes('/config') && !url.includes('file') && !url.includes('set') && !url.includes('unset') && !url.includes('delete')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({
                        items: [
                            {keyword: 'valid.param', value: 'test'},
                        ],
                    }),
                    headers: new Headers(),
                });
            }
            if (url.includes('/config/keywords')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({items: []}),
                    headers: new Headers(),
                });
            }
            return originalFetch(url);
        });

        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Manage Configuration Parameters/i);
        }, {timeout: 10000});

        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, {timeout: 10000});

        const dialog = screen.getByRole('dialog');
        const applyButton = within(dialog).getByRole('button', {name: /Apply/i});

        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('No selection made', 'error');
        }, {timeout: 10000});

        global.fetch = originalFetch;
    });

    test('debounces fetchConfig calls within 1 second', async () => {
        const onToggle = jest.fn();
        const {rerender} = render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={onToggle}
            />
        );

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        rerender(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={onToggle}
            />
        );

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });
    }, 15000);

    test('handles fetchConfig with network error', async () => {
        global.fetch.mockImplementationOnce(() =>
            Promise.reject(new Error('Network failure'))
        );

        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/Failed to fetch config: Network failure/i);
        }, {timeout: 10000});
    });

    test('handles parseObjectPath with various input formats', async () => {
        render(
            <ConfigSection
                decodedObjectName={null}
                configNode=""
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('No node available to fetch configuration');
        }, {timeout: 5000});

        render(
            <ConfigSection
                decodedObjectName={123}
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/instance/path/root/svc//config/file'),
                expect.any(Object)
            );
        }, {timeout: 10000});
    });

    test('handles parseObjectPath with single part object name', async () => {
        render(
            <ConfigSection
                decodedObjectName="cluster"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/instance/path/root/ccfg/cluster/config/file'),
                expect.any(Object)
            );
        }, {timeout: 10000});
    });

    test('handles parseObjectPath with two part object name', async () => {
        render(
            <ConfigSection
                decodedObjectName="svc/service1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/instance/path/root/svc/service1/config/file'),
                expect.any(Object)
            );
        }, {timeout: 10000});
    });

    test('handles reducer default case in useConfig', async () => {

        const {rerender} = render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        rerender(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node2"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/node2/instance/path/root/cfg/cfg1/config/file'),
                expect.any(Object)
            );
        }, {timeout: 10000});
    });

    test('handles manage params dialog state reset on close', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Manage Configuration Parameters/i);
        }, {timeout: 10000});

        const dialog = screen.getByRole('dialog');
        const comboboxes = within(dialog).getAllByRole('combobox', {name: /autocomplete-input/i});
        const addParamsInput = comboboxes[0];

        await act(async () => {
            await user.type(addParamsInput, 'nodes{Enter}');
        });

        const addButton = screen.getByRole('button', {name: /Add Parameter/i});
        await act(async () => {
            await user.click(addButton);
        });

        const cancelButton = within(dialog).getByRole('button', {name: /Cancel/i});
        await act(async () => {
            await user.click(cancelButton);
        });

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        }, {timeout: 5000});

        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Manage Configuration Parameters/i);
        }, {timeout: 10000});

        const newDialog = screen.getByRole('dialog');
        expect(within(newDialog).queryByText('nodes')).not.toBeInTheDocument();
    });

    test('handles add parameters with zero index for indexed parameter', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Manage Configuration Parameters/i);
        }, {timeout: 10000});

        const dialog = screen.getByRole('dialog');
        const comboboxes = within(dialog).getAllByRole('combobox', {name: /autocomplete-input/i});
        const addParamsInput = comboboxes[0];
        await act(async () => {
            await user.type(addParamsInput, 'fs.size{Enter}');
        });

        const addButton = screen.getByRole('button', {name: /Add Parameter/i});
        await act(async () => {
            await user.click(addButton);
        });

        const sectionInput = screen.getByPlaceholderText('Index e.g. 1');
        await act(async () => {
            await user.clear(sectionInput);
            await user.type(sectionInput, '0'); // Index 0
        });

        const valueInput = screen.getByLabelText('Value');
        await act(async () => {
            await user.type(valueInput, '5GB');
        });

        const applyButton = within(dialog).getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Successfully added 1 parameter(s)', 'success');
        }, {timeout: 10000});
    });

    test('handles add parameters with TListLowercase converter - invalid comma-separated values', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Manage Configuration Parameters/i);
        }, {timeout: 10000});

        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, {timeout: 10000});

        const dialog = screen.getByRole('dialog');
        const comboboxes = within(dialog).getAllByRole('combobox', {name: /autocomplete-input/i});
        const addParamsInput = comboboxes[0];

        await act(async () => {
            await user.type(addParamsInput, 'DEFAULT.roles{Enter}');
        });

        const addButton = screen.getByRole('button', {name: /Add Parameter/i});
        await act(async () => {
            await user.click(addButton);
        });

        await waitFor(() => {
            expect(screen.getByText('roles')).toBeInTheDocument();
        }, {timeout: 5000});

        const valueInput = screen.getByLabelText('Value');
        await act(async () => {
            await user.type(valueInput, 'admin,,user'); // Empty value in comma-separated list
        });

        const applyButton = within(dialog).getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith(
                expect.stringContaining('Invalid value for roles: must be comma-separated lowercase strings'),
                'error'
            );
        }, {timeout: 10000});
    });

    test('handles add parameters with TListLowercase converter - valid comma-separated values', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Manage Configuration Parameters/i);
        }, {timeout: 10000});

        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, {timeout: 10000});

        const dialog = screen.getByRole('dialog');
        const comboboxes = within(dialog).getAllByRole('combobox', {name: /autocomplete-input/i});
        const addParamsInput = comboboxes[0];

        await act(async () => {
            await user.type(addParamsInput, 'DEFAULT.roles{Enter}');
        });

        const addButton = screen.getByRole('button', {name: /Add Parameter/i});
        await act(async () => {
            await user.click(addButton);
        });

        const valueInput = screen.getByLabelText('Value');
        await act(async () => {
            await user.type(valueInput, 'admin,user,guest'); // Valid comma-separated values
        });

        const applyButton = within(dialog).getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Successfully added 1 parameter(s)', 'success');
        }, {timeout: 10000});
    });

    test('handles add parameters with TListLowercase converter - no commas', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Manage Configuration Parameters/i);
        }, {timeout: 10000});

        const dialog = screen.getByRole('dialog');
        const comboboxes = within(dialog).getAllByRole('combobox', {name: /autocomplete-input/i});
        const addParamsInput = comboboxes[0];

        await act(async () => {
            await user.type(addParamsInput, 'DEFAULT.roles{Enter}');
        });

        const addButton = screen.getByRole('button', {name: /Add Parameter/i});
        await act(async () => {
            await user.click(addButton);
        });

        const valueInput = screen.getByLabelText('Value');
        await act(async () => {
            await user.type(valueInput, 'single_role'); // No commas - should pass without validation
        });

        const applyButton = within(dialog).getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Successfully added 1 parameter(s)', 'success');
        }, {timeout: 10000});
    });

    test('handles unset parameters with network error', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/config?unset=')) {
                return Promise.reject(new Error('Network failure'));
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers(),
            });
        });

        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Manage Configuration Parameters/i);
        }, {timeout: 10000});

        const dialog = screen.getByRole('dialog');
        const comboboxes = within(dialog).getAllByRole('combobox', {name: /autocomplete-input/i});
        const unsetParamsInput = comboboxes[1];

        await act(async () => {
            await user.type(unsetParamsInput, 'nodes{Enter}');
        });

        const applyButton = within(dialog).getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith(
                expect.stringContaining('Error unsetting parameter nodes: Network failure'),
                'error'
            );
        }, {timeout: 10000});
    });

    test('handles delete sections with network error', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/config?delete=')) {
                return Promise.reject(new Error('Network failure'));
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({items: []}),
                headers: new Headers(),
            });
        });

        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Manage Configuration Parameters/i);
        }, {timeout: 10000});

        const dialog = screen.getByRole('dialog');
        const comboboxes = within(dialog).getAllByRole('combobox', {name: /autocomplete-input/i});
        const deleteSectionsInput = comboboxes[2];

        await act(async () => {
            await user.type(deleteSectionsInput, 'fs#1{Enter}');
        });

        const applyButton = within(dialog).getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith(
                expect.stringContaining('Error deleting section fs#1: Network failure'),
                'error'
            );
        }, {timeout: 10000});
    });

    test('handles update config with network error', async () => {
        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/config/file') && options?.method === 'PUT') {
                return Promise.reject(new Error('Network failure'));
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                text: () => Promise.resolve(''),
                json: () => Promise.resolve({items: []}),
                headers: new Headers(),
            });
        });

        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const uploadButton = getUploadButton();
        await act(async () => {
            await user.click(uploadButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Update Configuration/i);
        }, {timeout: 5000});

        const fileInput = document.querySelector('#update-config-file-upload');
        const testFile = new File(['[DEFAULT]\nnodes = node2'], 'config.ini');
        await act(async () => {
            await user.upload(fileInput, testFile);
        });

        const updateButton = screen.getByRole('button', {name: /Update/i});
        await act(async () => {
            await user.click(updateButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Error: Network failure', 'error');
        }, {timeout: 10000});
    });

    test('handles remove parameter in manage params dialog', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
                expanded={true}
                onToggle={jest.fn()}
            />
        );

        const manageParamsButton = getManageParamsButton();
        await act(async () => {
            await user.click(manageParamsButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Manage Configuration Parameters/i);
        }, {timeout: 10000});

        const dialog = screen.getByRole('dialog');
        const comboboxes = within(dialog).getAllByRole('combobox', {name: /autocomplete-input/i});
        const addParamsInput = comboboxes[0];

        await act(async () => {
            await user.type(addParamsInput, 'DEFAULT.orchestrate{Enter}');
        });

        const addButton = screen.getByRole('button', {name: /Add Parameter/i});
        await act(async () => {
            await user.click(addButton);
        });

        await waitFor(() => {
            expect(screen.getByText('orchestrate')).toBeInTheDocument();
        }, {timeout: 5000});

        const removeButton = screen.getByRole('button', {name: /Remove parameter/i});
        await act(async () => {
            await user.click(removeButton);
        });

        await waitFor(() => {
            expect(screen.queryByText('orchestrate')).not.toBeInTheDocument();
        }, {timeout: 5000});
    });
});
