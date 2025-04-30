export default {
    testEnvironment: "jest-environment-jsdom",
    setupFilesAfterEnv: ['./setupTests.js'],
    transform: {
        "^.+\\.jsx?$": "babel-jest",
    },
    moduleFileExtensions: ["js", "jsx"],
};