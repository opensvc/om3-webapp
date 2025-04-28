import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {viteSingleFile} from "vite-plugin-singlefile"
import tailwindcss from '@tailwindcss/vite';
import {
    URL_AUTH_INFO,
    URL_CLUSTER_STATUS, URL_NODE,
    URL_NODE_EVENT,
    URL_OBJECT,
    URL_POOL,
    URL_TOKEN
} from './src/config/apiPath.js'


const baseUrl = process.env.BASE_URL || 'https://localhost:1215/';

export default defineConfig({
    plugins: [react(), tailwindcss(), viteSingleFile()],
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
        },
    },
    "build": {
        assetsInlineLimit: Infinity, // ensure all assets are inlined
        cssCodeSplit: false,         // don't split CSS
        target: 'esnext',
    }
});
