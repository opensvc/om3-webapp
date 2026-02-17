import React from 'react';
import {render, screen, fireEvent, within} from '@testing-library/react';
import '@testing-library/jest-dom';
import {GridNodes, GridObjects, GridNamespaces, GridHeartbeats, GridPools, GridNetworks} from '../ClusterStatGrids.jsx';

jest.mock('../../eventSourceManager', () => ({
    prepareForNavigation: jest.fn(),
}));

jest.useFakeTimers();

describe('ClusterStatGrids', () => {
    const mockOnClick = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        jest.clearAllTimers();
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    test('GridNodes renders correctly and handles click', () => {
        render(
            <GridNodes
                nodeCount={5}
                frozenCount={2}
                onClick={mockOnClick}
            />
        );

        expect(screen.getByText('Nodes')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText('Frozen 2')).toBeInTheDocument();

        // Click on the card
        fireEvent.click(screen.getByText('Nodes'));
        jest.runAllTimers();
        expect(mockOnClick).toHaveBeenCalled();

        // Click on the chip
        fireEvent.click(screen.getByText('Frozen 2'));
        jest.runAllTimers();
        expect(mockOnClick).toHaveBeenCalledTimes(2);
    });

    test('GridNamespaces renders correctly and handles click', () => {
        const mockNamespaceSubtitle = [
            {namespace: 'ns1', status: {up: 5, warn: 3, down: 2, 'n/a': 1, unprovisioned: 0}},
            {namespace: 'ns2', status: {up: 3, warn: 1, down: 1, 'n/a': 0, unprovisioned: 2}}
        ];

        render(
            <GridNamespaces
                namespaceCount={4}
                namespaceSubtitle={mockNamespaceSubtitle}
                onClick={mockOnClick}
            />
        );

        expect(screen.getByText('Namespaces')).toBeInTheDocument();
        expect(screen.getByText('4')).toBeInTheDocument();
        expect(screen.getByText('ns1')).toBeInTheDocument();
        expect(screen.getByText('ns2')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Namespaces'));
        jest.runAllTimers();
        expect(mockOnClick).toHaveBeenCalled();
    });

    test('GridHeartbeats renders chips grouped by base ID and applies correct colors', () => {
        const perHeartbeatStats = {
            '1.rx': {running: 2, beating: 2},   // healthy
            '1.tx': {running: 3, beating: 3},   // healthy
            '2.rx': {running: 1, beating: 1},   // healthy
            '2.tx': {running: 4, beating: 2},   // unhealthy (beating < running)
            '3.rx': {running: 0, beating: 0},   // ignored (zero)
            '3.tx': {running: 0, beating: 0},   // ignored
            '4.rx': {running: 5, beating: 5},   // healthy
            '4.tx': {running: 5, beating: 5},   // healthy
        };

        render(
            <GridHeartbeats
                heartbeatCount={3} // groups: 1, 2, 4 (3 ignored)
                perHeartbeatStats={perHeartbeatStats}
                nodeCount={3}
                onClick={mockOnClick}
            />
        );

        expect(screen.getByText('Heartbeats')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument(); // heartbeatCount

        // Find chips by role
        const chip1 = screen.getByRole('button', {name: '1'});
        const chip2 = screen.getByRole('button', {name: '2'});
        const chip4 = screen.getByRole('button', {name: '4'});

        expect(chip1).toBeInTheDocument();
        expect(chip2).toBeInTheDocument();
        expect(chip4).toBeInTheDocument();

        // Check colors
        expect(chip1).toHaveStyle('background-color: green');
        expect(chip2).toHaveStyle('background-color: red');
        expect(chip4).toHaveStyle('background-color: green');
    });

    test('GridHeartbeats handles chip click correctly', () => {
        const perHeartbeatStats = {
            '1.rx': {running: 2, beating: 2},
            '1.tx': {running: 3, beating: 3},
        };

        render(
            <GridHeartbeats
                heartbeatCount={1}
                perHeartbeatStats={perHeartbeatStats}
                nodeCount={3}
                onClick={mockOnClick}
            />
        );

        const chip = screen.getByRole('button', {name: '1'});
        fireEvent.click(chip);
        jest.runAllTimers();

        expect(mockOnClick).toHaveBeenCalledWith(null, null, '1');
    });

    test('GridHeartbeats handles card click correctly', () => {
        render(
            <GridHeartbeats
                heartbeatCount={0}
                perHeartbeatStats={{}}
                nodeCount={3}
                onClick={mockOnClick}
            />
        );

        fireEvent.click(screen.getByText('Heartbeats'));
        jest.runAllTimers();

        expect(mockOnClick).toHaveBeenCalledWith();
    });

    test('GridHeartbeats does not render chips for groups where all streams have running=0 and beating=0', () => {
        const perHeartbeatStats = {
            '1.rx': {running: 0, beating: 0},
            '1.tx': {running: 0, beating: 0},
            '2.rx': {running: 3, beating: 3},
        };

        render(
            <GridHeartbeats
                heartbeatCount={1} // only group 2 counted
                perHeartbeatStats={perHeartbeatStats}
                nodeCount={3}
                onClick={mockOnClick}
            />
        );

        // Group 1 should not appear as a chip
        expect(screen.queryByRole('button', {name: '1'})).not.toBeInTheDocument();
        // Group 2 should appear
        expect(screen.getByRole('button', {name: '2'})).toBeInTheDocument();
    });

    test('GridHeartbeats renders correctly when perHeartbeatStats is empty', () => {
        render(
            <GridHeartbeats
                heartbeatCount={0}
                perHeartbeatStats={{}}
                nodeCount={3}
                onClick={mockOnClick}
            />
        );

        expect(screen.getByText('Heartbeats')).toBeInTheDocument();
        expect(screen.getByText('0')).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    test('GridHeartbeats handles single node scenario with same health logic (no special treatment)', () => {
        const perHeartbeatStats = {
            '1.rx': {running: 2, beating: 2}, // healthy
            '1.tx': {running: 2, beating: 1}, // unhealthy
        };

        render(
            <GridHeartbeats
                heartbeatCount={1}
                perHeartbeatStats={perHeartbeatStats}
                nodeCount={1}
                onClick={mockOnClick}
            />
        );

        const chip = screen.getByRole('button', {name: '1'});
        expect(chip).toHaveStyle('background-color: red');
    });

    test('GridPools renders correctly and handles click', () => {
        render(
            <GridPools
                poolCount={3}
                onClick={mockOnClick}
            />
        );

        expect(screen.getByText('Pools')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Pools'));
        jest.runAllTimers();
        expect(mockOnClick).toHaveBeenCalled();
    });

    test('GridNodes handles zero values', () => {
        render(
            <GridNodes
                nodeCount={0}
                frozenCount={0}
                onClick={mockOnClick}
            />
        );

        expect(screen.getByText('Nodes')).toBeInTheDocument();
        expect(screen.getByText('0')).toBeInTheDocument();
        expect(screen.getByText('Frozen 0')).toBeInTheDocument();
    });

    test('GridObjects handles zero values', () => {
        const statusCount = {up: 0, warn: 0, down: 0, unprovisioned: 0};
        render(
            <GridObjects
                objectCount={0}
                statusCount={statusCount}
                onClick={mockOnClick}
            />
        );

        expect(screen.getByText('Objects')).toBeInTheDocument();
        expect(screen.getByText('0')).toBeInTheDocument();
        expect(screen.queryByText(/Up \d+/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Warn \d+/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Down \d+/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Unprovisioned \d+/)).not.toBeInTheDocument();
    });

    test('GridObjects renders correctly with non-zero values and handles click', () => {
        const statusCount = {up: 5, warn: 2, down: 1, unprovisioned: 0};
        render(
            <GridObjects
                objectCount={8}
                statusCount={statusCount}
                onClick={mockOnClick}
            />
        );

        expect(screen.getByText('Objects')).toBeInTheDocument();
        expect(screen.getByText('8')).toBeInTheDocument();
        const upChipLabel = screen.getByText('Up 5');
        const warnChipLabel = screen.getByText('Warn 2');
        const downChipLabel = screen.getByText('Down 1');

        expect(upChipLabel).toBeInTheDocument();
        expect(warnChipLabel).toBeInTheDocument();
        expect(downChipLabel).toBeInTheDocument();

        fireEvent.click(screen.getByText('Objects'));
        jest.runAllTimers();
        expect(mockOnClick).toHaveBeenCalled();
    });

    test('GridObjects chips call onClick with correct status', () => {
        const statusCount = {up: 5, warn: 2, down: 1, unprovisioned: 3};
        render(
            <GridObjects
                objectCount={11}
                statusCount={statusCount}
                onClick={mockOnClick}
            />
        );

        fireEvent.click(screen.getByText('Up 5'));
        jest.runAllTimers();
        expect(mockOnClick).toHaveBeenCalledWith('up');

        fireEvent.click(screen.getByText('Warn 2'));
        jest.runAllTimers();
        expect(mockOnClick).toHaveBeenCalledWith('warn');

        fireEvent.click(screen.getByText('Down 1'));
        jest.runAllTimers();
        expect(mockOnClick).toHaveBeenCalledWith('down');

        fireEvent.click(screen.getByText('Unprovisioned 3'));
        jest.runAllTimers();
        expect(mockOnClick).toHaveBeenCalledWith('unprovisioned');
    });

    test('GridNetworks renders correctly with networks and handles click', () => {
        const mockNetworks = [
            {name: 'network1', size: 100, used: 50, free: 50},
            {name: 'network2', size: 200, used: 182, free: 18}
        ];

        render(
            <GridNetworks
                networks={mockNetworks}
                onClick={mockOnClick}
            />
        );

        expect(screen.getByText('Networks')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('network1 (50.0% used)')).toBeInTheDocument();
        expect(screen.getByText('network2 (91.0% used)')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Networks'));
        jest.runAllTimers();
        expect(mockOnClick).toHaveBeenCalled();
    });

    test('GridNetworks handles empty networks array', () => {
        render(
            <GridNetworks
                networks={[]}
                onClick={mockOnClick}
            />
        );

        expect(screen.getByText('Networks')).toBeInTheDocument();
        expect(screen.getByText('0')).toBeInTheDocument();
    });

    test('GridNetworks handles network with zero size', () => {
        const mockNetworks = [
            {name: 'network1', size: 0, used: 0, free: 0}
        ];

        render(
            <GridNetworks
                networks={mockNetworks}
                onClick={mockOnClick}
            />
        );

        expect(screen.getByText('Networks')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('network1 (0% used)')).toBeInTheDocument();
    });

    test('GridNetworks handles network with no size property', () => {
        const mockNetworks = [
            {name: 'network1', used: 10, free: 90}
        ];

        render(
            <GridNetworks
                networks={mockNetworks}
                onClick={mockOnClick}
            />
        );

        expect(screen.getByText('Networks')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('network1 (0% used)')).toBeInTheDocument();
    });

    test('GridObjects handles all status types', () => {
        const statusCount = {up: 1, warn: 1, down: 1, unprovisioned: 1};
        render(
            <GridObjects
                objectCount={4}
                statusCount={statusCount}
                onClick={mockOnClick}
            />
        );

        expect(screen.getByText('Up 1')).toBeInTheDocument();
        expect(screen.getByText('Warn 1')).toBeInTheDocument();
        expect(screen.getByText('Down 1')).toBeInTheDocument();
        expect(screen.getByText('Unprovisioned 1')).toBeInTheDocument();
    });

    test('GridNamespaces handles namespace with only some status types', () => {
        const mockNamespaceSubtitle = [
            {namespace: 'ns1', status: {up: 5, warn: 0, down: 0, 'n/a': 0, unprovisioned: 0}}
        ];

        render(
            <GridNamespaces
                namespaceCount={1}
                namespaceSubtitle={mockNamespaceSubtitle}
                onClick={mockOnClick}
            />
        );

        const ns1Chip = screen.getByText('ns1');
        const chipContainer = ns1Chip.closest('.MuiBox-root');
        const statusIndicators = within(chipContainer).getAllByRole('button', {hidden: true});

        expect(statusIndicators).toHaveLength(1);
    });
});
