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
        render(
            <GridNamespaces
                namespaceCount={4}
                namespaceSubtitle="ns1: 10 | ns2: 5"
                onClick={mockOnClick}
            />
        );

        expect(screen.getByText('Namespaces')).toBeInTheDocument();
        expect(screen.getByText('4')).toBeInTheDocument();
        expect(screen.getByText('ns1: 10 | ns2: 5')).toBeInTheDocument();

        const card = screen.getByText('Namespaces').closest('div');
        fireEvent.click(card);
        expect(mockOnClick).toHaveBeenCalled();
    });

    test('GridHeartbeats renders correctly and handles click', () => {
        render(
            <GridHeartbeats
                heartbeatCount={8}
                onClick={mockOnClick}
            />
        );

        expect(screen.getByText('Heartbeats')).toBeInTheDocument();
        expect(screen.getByText('8')).toBeInTheDocument();

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
        const statusCount = {up: 0, warn: 0, down: 0, unknown: 0};
        render(
            <GridObjects
                objectCount={0}
                statusCount={statusCount}
                onClick={mockOnClick}
            />
        );

        expect(screen.getByText('Objects')).toBeInTheDocument();
        expect(screen.getByText('0')).toBeInTheDocument();
        expect(screen.getByText('🟢 0 | 🟡 0 | 🔴 0')).toBeInTheDocument();
    });

    test('GridNamespaces handles empty subtitle', () => {
        render(
            <GridNamespaces
                namespaceCount={0}
                namespaceSubtitle=""
                onClick={mockOnClick}
            />
        );

        expect(screen.getByText('Namespaces')).toBeInTheDocument();
        expect(screen.getByText('0')).toBeInTheDocument();
    });
});