import http from 'http';

const port = process.env.PORT || 4000;

console.log("Starting Raw Node.js Server...");

const server = http.createServer((req, res) => {
  console.log(`[RAW REQUEST] ${req.method} ${req.url} - Headers: ${JSON.stringify(req.headers)}`);

  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Connection': 'keep-alive'
  });
  res.end('Raw Backend is running!');
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

server.listen(port, "0.0.0.0", () => {
  console.log(`Raw API listening on port ${port}`);
  console.log(`Server bound to 0.0.0.0:${port}`);
  console.log(`Environment PORT: ${process.env.PORT || 'not set'}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.close(() => console.log('Server closed'));
});
