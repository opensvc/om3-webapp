import {describe, expect, test} from 'vitest';
import {commonVersion, nodeColumns, nodeLayout} from '../node-layout';

const keys = (step) => nodeColumns(nodeLayout(step)).map((c) => c.labelKey.split('.').pop());

describe('nodeLayout and nodeColumns', () => {
    test('the whole table, then a step at a time: labels, version, env, the figures grouped, the dates', () => {
        expect(keys(0)).toEqual(['name', 'state', 'score', 'load15m', 'memAvail', 'swapAvail', 'version', 'env', 'labels', 'bootedAt', 'updatedAt']);
        expect(keys(1)).toEqual(['name', 'state', 'score', 'load15m', 'memAvail', 'swapAvail', 'version', 'env', 'bootedAt', 'updatedAt']);
        expect(keys(2)).toEqual(['name', 'state', 'score', 'load15m', 'memAvail', 'swapAvail', 'env', 'bootedAt', 'updatedAt']);
        expect(keys(3)).toEqual(['name', 'state', 'score', 'load15m', 'memAvail', 'swapAvail', 'bootedAt', 'updatedAt']);
        expect(keys(4)).toEqual(['name', 'state', 'metrics', 'bootedAt', 'updatedAt']);
        expect(keys(5)).toEqual(['name', 'state', 'metrics']);
    });
});

describe('commonVersion', () => {
    test('the version most nodes run; a tie, the api node\'s, else the highest; none, undefined', () => {
        expect(commonVersion(['3.0.1', '3.0.2', '3.0.2', undefined], '3.0.1')).toBe('3.0.2');
        expect(commonVersion(['3.0.1', '3.0.2'], '3.0.1')).toBe('3.0.1');
        expect(commonVersion(['3.0.9', '3.0.10'], undefined)).toBe('3.0.10');
        expect(commonVersion([undefined, ''], 'x')).toBeUndefined();
    });
});
