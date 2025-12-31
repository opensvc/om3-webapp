import {TextEncoder, TextDecoder} from 'util';
import '@testing-library/jest-dom';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
    console.error = jest.fn();
    console.warn = jest.fn();
});

afterAll(() => {
    console.error = originalError;
    console.warn = originalWarn;
});