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

                const urlParams = new URLSearchParams(req.url.split('?')[1]);

                // Get the authentication token from the request headers
                const authToken = urlParams.get('token');
                //const authToken = req.headers['authorization'];
                console.log("authToken: ", authToken);
                if (authToken) {
                    proxyReq.setHeader('Authorization',  `Bearer ${authToken}`);
                } else {
                    console.error('❌ No authentication token found in the headers!');
                }

                proxyReq.setHeader('Content-Type', 'text/event-stream');
            },

            onError: (err, req, res) => {
                console.error('❌ Proxy Error:', err);
            },

            onProxyRes: (proxyRes, req, res) => {
                let body = [];

                // Listen to data chunks of the response
                proxyRes.on('data', chunk => {
                    body.push(chunk);
                    console.log('Received chunk:', chunk.toString());
                });

                // Listen for the end of the response
                proxyRes.on('end', () => {
                    body = Buffer.concat(body).toString();
                    console.log('Complete response body:', body);
                    res.end(body);
                });
            },
        })
    );
};
