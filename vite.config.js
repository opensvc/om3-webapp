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
            '/sse': {
                target: baseUrl,
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/sse/, '/node/name/localhost/daemon/event'), // Réécriture comme dans setupProxy
                configure: (proxy, options) => {
                    proxy.on('proxyReq', (proxyReq, req) => {
                        console.log('🔄 Proxy: Sending SSE request to backend...');
                        const urlParams = new URLSearchParams(req.url.split('?')[1]);
                        const authToken = urlParams.get('token');
                        console.log('authToken:', authToken);
                        if (authToken) {
                            proxyReq.setHeader('Authorization', `Bearer ${authToken}`);
                        } else {
                            console.error('❌ No authentication token found!');
                        }
                        proxyReq.setHeader('Content-Type', 'text/event-stream');
                    });

                    proxy.on('proxyRes', (proxyRes) => {
                        console.log('📥 Proxy: Received SSE response:', proxyRes.statusCode);
                    });

                    proxy.on('error', (err) => {
                        console.error('❌ Proxy Error:', err);
                    });
                },
            },
        },
    },
    "build": {
        assetsInlineLimit: Infinity, // ensure all assets are inlined
        cssCodeSplit: false,         // don't split CSS
        target: 'esnext',
    }
});
