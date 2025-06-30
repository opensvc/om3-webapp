import {render, screen, waitFor, fireEvent} from '@testing-library/react';
import NodesTable from '../NodesTable.jsx';
import * as useFetchDaemonStatusModule from '../../hooks/useFetchDaemonStatus.jsx';
import * as useEventStoreModule from '../../hooks/useEventStore.js';
import * as eventSourceManager from '../../eventSourceManager';
import {BrowserRouter} from 'react-router-dom';

jest.mock('../NodeRow.jsx', () => (props) => (
    <tr>
        <td>
            <input
                type="checkbox"
                checked={props.isSelected}
                onChange={(e) => props.onSelect(e, props.nodename)}
            />
        </td>
        <td>{props.nodename}</td>
        <td>
            <button onClick={() => props.onAction(props.nodename, 'action/freeze')}>
                Trigger
            </button>
        </td>
    </tr>
));

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => jest.fn(),
}));

describe('NodesTable', () => {
    beforeEach(() => {
        // Mock daemon status
        jest.spyOn(useFetchDaemonStatusModule, 'default').mockReturnValue({
            daemon: {nodename: 'node-1'},
            fetchNodes: jest.fn(),
        });

        // Mock store data
        jest.spyOn(useEventStoreModule, 'default').mockImplementation((selector) =>
            selector({
                nodeStatus: {
                    'node-1': {state: 'idle'},
                    'node-2': {state: 'busy'},
                },
                nodeStats: {
                    'node-1': {score: 42},
                    'node-2': {score: 18},
                },
                nodeMonitor: {
                    'node-1': {},
                    'node-2': {},
                },
            })
        );

        // Mock EventSource
        jest.spyOn(eventSourceManager, 'startEventReception').mockImplementation(() => {
        });
        jest.spyOn(eventSourceManager, 'closeEventSource').mockImplementation(() => {
        });

        localStorage.setItem('authToken', 'test-token');
    });

    afterEach(() => {
        localStorage.clear();
        jest.restoreAllMocks();
    });

    const renderWithRouter = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);

    test('displays a loader when no node data is available', () => {
        jest.spyOn(useEventStoreModule, 'default').mockImplementation((selector) =>
            selector({
                nodeStatus: {},
                nodeStats: {},
                nodeMonitor: {},
            })
        );

        renderWithRouter(<NodesTable/>);
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    test('displays node names in the table', async () => {
        renderWithRouter(<NodesTable/>);
        expect(await screen.findByText('node-1')).toBeInTheDocument();
        expect(await screen.findByText('node-2')).toBeInTheDocument();
    });

    test('enables "Actions on selected nodes" button when a node is selected', async () => {
        renderWithRouter(<NodesTable/>);
        const checkboxes = await screen.findAllByRole('checkbox');
        fireEvent.click(checkboxes[1]); // select node-1

        const button = screen.getByRole('button', {name: /actions on selected nodes/i});
        expect(button).toBeEnabled();
    });

    test('opens a confirmation dialog when an action is triggered', async () => {
        renderWithRouter(<NodesTable/>);
        const triggerButtons = await screen.findAllByText('Trigger');

        // Click the first Trigger button (e.g., for node-1)
        fireEvent.click(triggerButtons[0]);

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText(/Confirm action\/freeze Action/i)).toBeInTheDocument();
        });
    });

    test('executes the action and displays a success snackbar', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({ok: true, json: () => ({})})
        );

        renderWithRouter(<NodesTable/>);
        const triggerButtons = await screen.findAllByText('Trigger');

        // Click the first Trigger button (e.g., for node-1)
        fireEvent.click(triggerButtons[0]);

        const confirmBtn = await screen.findByRole('button', {name: 'OK'});
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(screen.getByText(/✅ action\/freeze on node-1 succeeded/i)).toBeInTheDocument();
        });
    });
});
