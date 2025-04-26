import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {viteSingleFile} from "vite-plugin-singlefile"
import tailwindcss from '@tailwindcss/vite';


const baseUrl = process.env.BASE_URL || 'https://localhost:1215/';

export default defineConfig({
    plugins: [react(), tailwindcss(), viteSingleFile()],
    server: {
        proxy: {
            '/auth/info': {
                target: baseUrl,
                changeOrigin: true,
                secure: false,
            },
            '/auth/token': {
                target: baseUrl,
                changeOrigin: true,
                secure: false,
            },
            '/cluster/status': {
                target: baseUrl,
                changeOrigin: true,
                secure: false,
            },
            '/node/name': {
                target: baseUrl,
                changeOrigin: true,
                secure: false,
            },
            '/object/path': {
                target: baseUrl,
                changeOrigin: true,
                secure: false,
            },
            '/pool': {
                target: baseUrl,
                changeOrigin: true,
                secure: false,
            },
            '/node/name/localhost/daemon/event': {
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
