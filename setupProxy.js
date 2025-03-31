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
                console.log('🔄 Proxy : Envoi de la requête SSE au backend...');

                // Récupérer le token d'authentification depuis l'en-tête de la requête
                const authToken = req.headers['authorization'];

                if (authToken) {
                    proxyReq.setHeader('Authorization', authToken);
                } else {
                    console.error('❌ Aucun token d\'authentification trouvé dans les en-têtes!');
                }

                proxyReq.setHeader('Content-Type', 'text/event-stream');
            },

            onError: (err, req, res) => {
                console.error('❌ Erreur Proxy:', err);
            },

            onProxyRes: (proxyRes, req, res) => {
                let body = [];

                // Écouter les chunks de données de la réponse
                proxyRes.on('data', chunk => {
                    body.push(chunk);
                    console.log('Received chunk:', chunk.toString());
                });

                // Écouter la fin de la réponse
                proxyRes.on('end', () => {
                    body = Buffer.concat(body).toString();
                    console.log('Complete response body:', body);
                    res.end(body);
                });
            },
        })
    );
};
