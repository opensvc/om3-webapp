const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
    app.use(
        '/sse',
        createProxyMiddleware({
            target: 'https://54.37.191.105:1215',
            changeOrigin: true,
            secure: false,
            ws: false,
            logLevel: 'debug',

            pathRewrite: {
                '^/sse': '/node/name/localhost/daemon/event',
            },

            onProxyReq: (proxyReq, req, res) => {
                console.log('🔄 Proxy: Sending SSE request to backend...');

                // Get authentication token from request headers
                const authToken = req.headers['authorization'];

                if (authToken) {
                    proxyReq.setHeader('Authorization', authToken);
                } else {
                    console.error('❌ No authentication token found in headers!');
                }

                proxyReq.setHeader('Content-Type', 'text/event-stream');
            },

            onError: (err, req, res) => {
                console.error('❌ Proxy Error:', err);
            },

            onProxyRes: (proxyRes, req, res) => {
                let body = [];

                // Listen for data chunks from the response
                proxyRes.on('data', chunk => {
                    body.push(chunk);
                    console.log('Received chunk:', chunk.toString());
                });

                // Listen for response end
                proxyRes.on('end', () => {
                    body = Buffer.concat(body).toString();
                    console.log('Complete response body:', body);
                    res.end(body);
                });
            },
        })
    );
};