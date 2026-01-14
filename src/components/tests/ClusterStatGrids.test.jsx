import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
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
                unfrozenCount={3}
                onClick={mockOnClick}
            />
        );

        expect(screen.getByText('Nodes')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText('Frozen: 2 | Unfrozen: 3')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Nodes'));
        jest.runAllTimers();
        expect(mockOnClick).toHaveBeenCalled();
    });

    test('GridNamespaces renders correctly and handles click', () => {
        const mockNamespaceSubtitle = [
            {namespace: 'ns1', count: 10, status: {up: 5, warn: 3, down: 2}},
            {namespace: 'ns2', count: 5, status: {up: 3, warn: 1, down: 1}}
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

    test('GridHeartbeats renders correctly and handles click', () => {
        const stateCount = {running: 3, stopped: 2, failed: 1, warning: 0, unknown: 2};
        render(
            <GridHeartbeats
                heartbeatCount={8}
                beatingCount={4}
                nonBeatingCount={4}
                stateCount={stateCount}
                onClick={mockOnClick}
            />
        );

        // Check the title and total heartbeat count
        expect(screen.getByText('Heartbeats')).toBeInTheDocument();
        expect(screen.getByText('8')).toBeInTheDocument();

        // Check the chips for beating and stale
        const beatingChipLabel = screen.getByText('Beating 4');
        const staleChipLabel = screen.getByText('Stale 4');
        expect(beatingChipLabel).toBeInTheDocument();
        expect(staleChipLabel).toBeInTheDocument();

        fireEvent.click(beatingChipLabel);
        jest.runAllTimers();
        expect(mockOnClick).toHaveBeenCalledWith('beating', null);

        fireEvent.click(staleChipLabel);
        jest.runAllTimers();
        expect(mockOnClick).toHaveBeenCalledWith('stale', null);

        // Check the chips for states (only those with count > 0)
        const runningChipLabel = screen.getByText('Running 3');
        const stoppedChipLabel = screen.getByText('Stopped 2');
        const failedChipLabel = screen.getByText('Failed 1');
        const unknownChipLabel = screen.getByText('Unknown 2');

        fireEvent.click(runningChipLabel);
        jest.runAllTimers();
        expect(mockOnClick).toHaveBeenCalledWith(null, 'running');

        fireEvent.click(stoppedChipLabel);
        jest.runAllTimers();
        expect(mockOnClick).toHaveBeenCalledWith(null, 'stopped');

        fireEvent.click(failedChipLabel);
        jest.runAllTimers();
        expect(mockOnClick).toHaveBeenCalledWith(null, 'failed');

        fireEvent.click(unknownChipLabel);
        jest.runAllTimers();
        expect(mockOnClick).toHaveBeenCalledWith(null, 'unknown');

        // Check click on the entire card
        fireEvent.click(screen.getByText('Heartbeats'));
        jest.runAllTimers();
        expect(mockOnClick).toHaveBeenCalled();
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
                unfrozenCount={0}
                onClick={mockOnClick}
            />
        );

        expect(screen.getByText('Nodes')).toBeInTheDocument();
        expect(screen.getByText('0')).toBeInTheDocument();
        expect(screen.getByText('Frozen: 0 | Unfrozen: 0')).toBeInTheDocument();
    });

    test('GridObjects handles zero values', () => {
        const statusCount = {up: 0, warn: 0, down: 0};
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
    });

    test('GridObjects renders correctly with non-zero values and handles click', () => {
        const statusCount = {up: 5, warn: 2, down: 1};
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

    test('GridNamespaces handles empty subtitle', () => {
        render(
            <GridNamespaces
                namespaceCount={0}
                namespaceSubtitle={[]}
                onClick={mockOnClick}
            />
        );

        expect(screen.getByText('Namespaces')).toBeInTheDocument();
        expect(screen.getByText('0')).toBeInTheDocument();
    });

    test('GridObjects chips call onClick with correct status', () => {
        const statusCount = {up: 5, warn: 2, down: 1};
        render(
            <GridObjects
                objectCount={8}
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
    });

    test('GridHeartbeats renders correctly for single node', () => {
        const stateCount = {running: 3, stopped: 0, failed: 0, warning: 0, unknown: 0};
        render(
            <GridHeartbeats
                heartbeatCount={3}
                beatingCount={3}
                nonBeatingCount={0}
                stateCount={stateCount}
                nodeCount={1}
                onClick={mockOnClick}
            />
        );

        expect(screen.getByText('Heartbeats')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
        const beatingChipLabel = screen.getByText('Beating 3');
        expect(beatingChipLabel).toBeInTheDocument();
        expect(screen.queryByText(/Stale \d+/)).not.toBeInTheDocument();

        const beatingChip = beatingChipLabel.closest('.MuiChip-root');
        expect(beatingChip).toHaveAttribute('title', 'Healthy (Single Node)');

        fireEvent.click(beatingChipLabel);
        jest.runAllTimers();
        expect(mockOnClick).toHaveBeenCalledWith('beating', null);
    });

    test('GridNetworks renders correctly with networks and handles click', () => {
        const mockNetworks = [
            {name: 'network1', size: 100, used: 50, free: 50}, // 50% free
            {name: 'network2', size: 200, used: 182, free: 18} // 9% free (<10%)
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
});
