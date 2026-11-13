import React, {useState} from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, test} from 'vitest';
import {ConfigEditor} from '../ConfigEditor';

const Editor = ({start}) => {
    const [value, setValue] = useState(start);
    return <ConfigEditor label="Configuration" value={value} onChange={setValue}/>;
};

const tokens = (kind) => [...document.querySelectorAll(`[data-config-editor] pre [data-config-token=${kind}]`)].map((e) => e.textContent);

describe('ConfigEditor', () => {
    test('the text edited, painted under it as it is typed: sections, keys, scopes, references, comments', () => {
        render(<Editor start={'# a note\n[DEFAULT]\nnodes@n1 = {clustername}\n'}/>);
        const area = screen.getByRole('textbox', {name: 'Configuration'});
        expect(area).toHaveValue('# a note\n[DEFAULT]\nnodes@n1 = {clustername}\n');
        // The painted text, under the textarea, said to nobody: one textbox, the value its own.
        expect(document.querySelector('[data-config-editor] pre')).toHaveAttribute('aria-hidden', 'true');
        expect(tokens('comment')).toEqual(['# a note']);
        expect(tokens('section')).toEqual(['[DEFAULT]']);
        expect(tokens('key')).toEqual(['nodes@n1']);
        expect(tokens('scope')).toEqual(['@n1']);
        expect(tokens('reference')).toEqual(['{clustername}']);
        fireEvent.change(area, {target: {value: '[fs#1]\ntype = flag\n'}});
        expect(tokens('section')).toEqual(['[fs#1]']);
        expect(tokens('key')).toEqual(['type']);
        expect(tokens('comment')).toEqual([]);
    });
});
