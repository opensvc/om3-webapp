export default {
    testEnvironment: "jest-environment-jsdom",
    setupFilesAfterEnv: ['./setupTests.js'],
    transform: {
        "^.+\\.jsx?$": "babel-jest",
    },
    moduleFileExtensions: ["js", "jsx"],
    moduleNameMapper: {
        "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    },
    transformIgnorePatterns: ["/node_modules/(?!@mui)"],
    testTimeout: 20000,
};