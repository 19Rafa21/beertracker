// Servidor estático mínimo para desenvolvimento (sem dependências).
// Uso: npm start   ->   http://localhost:8000
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 8000;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

http.createServer(function (req, res) {
    let urlPath;
    try {
        urlPath = decodeURIComponent(req.url.split('?')[0]);
    } catch (e) {
        res.writeHead(400);
        res.end('Pedido inválido');
        return;
    }
    if (urlPath.endsWith('/')) {
        urlPath += 'index.html';
    }

    const filePath = path.join(ROOT, urlPath);
    if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
        res.writeHead(403);
        res.end('Proibido');
        return;
    }

    fs.readFile(filePath, function (err, content) {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Não encontrado');
            return;
        }
        res.writeHead(200, {
            'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
            'Cache-Control': 'no-store'
        });
        res.end(content);
    });
}).listen(PORT, function () {
    console.log('BeerTracker em http://localhost:' + PORT);
});
