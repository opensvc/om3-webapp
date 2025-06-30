import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom';
import {GridNodes, GridObjects, GridNamespaces, GridHeartbeats, GridPools} from '../ClusterStatGrids.jsx';

describe('ClusterStatGrids', () => {
    const mockOnClick = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
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

        const card = screen.getByText('Nodes').closest('div');
        fireEvent.click(card);
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

        const card = screen.getByText('Namespaces').closest('div');
        fireEvent.click(card);
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

        // Check the styles of the beating/stale chips
        const beatingChip = beatingChipLabel.closest('.MuiChip-root');
        const staleChip = staleChipLabel.closest('.MuiChip-root');
        expect(beatingChip).toHaveStyle('background-color: green');
        expect(staleChip).toHaveStyle('background-color: red');

        // Check the chips for states (only those with count > 0)
        const runningChipLabel = screen.getByText('Running 3');
        const stoppedChipLabel = screen.getByText('Stopped 2');
        const failedChipLabel = screen.getByText('Failed 1');
        const unknownChipLabel = screen.getByText('Unknown 2');
        expect(runningChipLabel).toBeInTheDocument();
        expect(stoppedChipLabel).toBeInTheDocument();
        expect(failedChipLabel).toBeInTheDocument();
        expect(unknownChipLabel).toBeInTheDocument();
        expect(screen.queryByText('Warning 0')).not.toBeInTheDocument();

        // Check the styles of the state chips
        const runningChip = runningChipLabel.closest('.MuiChip-root');
        const stoppedChip = stoppedChipLabel.closest('.MuiChip-root');
        const failedChip = failedChipLabel.closest('.MuiChip-root');
        const unknownChip = unknownChipLabel.closest('.MuiChip-root');
        expect(runningChip).toHaveStyle('background-color: green');
        expect(stoppedChip).toHaveStyle('background-color: orange');
        expect(failedChip).toHaveStyle('background-color: red');
        expect(unknownChip).toHaveStyle('background-color: grey');

        // Check clicks on the chips
        fireEvent.click(beatingChipLabel);
        expect(mockOnClick).toHaveBeenCalledWith('beating', null);

        fireEvent.click(staleChipLabel);
        expect(mockOnClick).toHaveBeenCalledWith('stale', null);

        fireEvent.click(runningChipLabel);
        expect(mockOnClick).toHaveBeenCalledWith(null, 'running');

        fireEvent.click(stoppedChipLabel);
        expect(mockOnClick).toHaveBeenCalledWith(null, 'stopped');

        fireEvent.click(failedChipLabel);
        expect(mockOnClick).toHaveBeenCalledWith(null, 'failed');

        fireEvent.click(unknownChipLabel);
        expect(mockOnClick).toHaveBeenCalledWith(null, 'unknown');

        // Check click on the entire card
        const card = screen.getByText('Heartbeats').closest('div');
        fireEvent.click(card);
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

        const card = screen.getByText('Pools').closest('div');
        fireEvent.click(card);
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

        // Find the root Chip element
        const upChip = upChipLabel.closest('.MuiChip-root');
        const warnChip = warnChipLabel.closest('.MuiChip-root');
        const downChip = downChipLabel.closest('.MuiChip-root');

        // Verify styles with color values
        expect(upChip).toHaveStyle('background-color: green');
        expect(warnChip).toHaveStyle('background-color: orange');
        expect(downChip).toHaveStyle('background-color: red');

        const card = screen.getByText('Objects').closest('div');
        fireEvent.click(card);
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
        expect(mockOnClick).toHaveBeenCalledWith('up');

        fireEvent.click(screen.getByText('Warn 2'));
        expect(mockOnClick).toHaveBeenCalledWith('warn');

        fireEvent.click(screen.getByText('Down 1'));
        expect(mockOnClick).toHaveBeenCalledWith('down');
    });
});
