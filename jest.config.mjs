export default {
    testEnvironment: "jest-environment-jsdom",
    setupFilesAfterEnv: ['./setupTests.js'],
    transform: {
        "^.+\\.(js|jsx|ts|tsx)$": ["babel-jest", {
            presets: [
                ['@babel/preset-env', {targets: {node: 'current'}}],
                '@babel/preset-typescript',
                ['@babel/preset-react', {runtime: 'automatic'}]
            ]
        }],
    },
    moduleNameMapper: {
        "\\.(css|less|scss|sass)$": "identity-obj-proxy",
        "^@/(.*)$": "<rootDir>/src/$1"
    },
    transformIgnorePatterns: [
        "/node_modules/(?!(@mui|oidc-client-ts)/)"
    ],
    testTimeout: 20000,
};