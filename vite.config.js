import {execSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {viteSingleFile} from 'vite-plugin-singlefile';
import tailwindcss from '@tailwindcss/vite';
import {
    URL_AUTH_INFO,
    URL_CLUSTER_STATUS,
    URL_NODE,
    URL_NODE_EVENT,
    URL_OBJECT,
    URL_POOL,
    URL_TOKEN,
    URL_AUTH_WHOAMI,
    URL_NETWORK,
    URL_NETWORK_IP,
    URL_METRICS_PG
} from './src/config/apiPath.js';

const baseUrl = process.env.BASE_URL || 'https://localhost:1215/';

/**
 * The version of the webapp built, embedded in it: the release tag of the commit
 * built, or how far past one ("v1.0.0-rc7-2-gb70a232"), "-dirty" with changes not
 * committed; the version of package.json without git.
 */
const appVersion = (() => {
    try {
        return execSync('git describe --tags --always --dirty', {stdio: ['ignore', 'pipe', 'ignore']}).toString().trim();
    } catch {
        return JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;
    }
})();

export default defineConfig({
    define: {
        __APP_VERSION__: JSON.stringify(appVersion),
    },
    plugins: [
        react({
            babel: {
                presets: ['@babel/preset-typescript'],
                plugins: [
                    ['@babel/plugin-transform-react-jsx', {runtime: 'automatic'}]
                ]
            }
        }),
        tailwindcss(),
        viteSingleFile()
    ],
    server: {
        proxy: {
            [URL_AUTH_INFO]: {
                target: baseUrl,
                changeOrigin: true,
                secure: false,
            },
            [URL_TOKEN]: {
                target: baseUrl,
                changeOrigin: true,
                secure: false,
            },
            [URL_CLUSTER_STATUS]: {
                target: baseUrl,
                changeOrigin: true,
                secure: false,
            },
            [URL_NODE]: {
                target: baseUrl,
                changeOrigin: true,
                secure: false,
            },
            [URL_OBJECT]: {
                target: baseUrl,
                changeOrigin: true,
                secure: false,
            },
            [URL_POOL]: {
                target: baseUrl,
                changeOrigin: true,
                secure: false,
            },
            [URL_NODE_EVENT]: {
                target: baseUrl,
                changeOrigin: true,
                secure: false,
            },
            [URL_AUTH_WHOAMI]: {
                target: baseUrl,
                changeOrigin: true,
                secure: false,
            },
            [URL_NETWORK]: {
                target: baseUrl,
                changeOrigin: true,
                secure: false,
            },
            [URL_NETWORK_IP]: {
                target: baseUrl,
                changeOrigin: true,
                secure: false,
            },
            [URL_METRICS_PG]: {
                target: baseUrl,
                changeOrigin: true,
                secure: false,
            },
        },
        historyApiFallback: true,
    },
    build: {
        assetsInlineLimit: Infinity,
        cssCodeSplit: false,
        target: 'esnext',
    },
    resolve: {
        alias: {
            '@': '/src'
        }
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./setupTests.js'],
        css: {
            modules: {
                classNameStrategy: 'non-scoped'
            }
        },
        testTimeout: 20000,
    }
});
