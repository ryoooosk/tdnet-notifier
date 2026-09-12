import { createServer } from 'node:http';

const hostName = 'localhost';
const port = 8000;

const server = createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-type', 'text/plain');
  res.write('Hello World');
  res.end();
});

server.listen(port, hostName, () =>
  console.log(`Server running at http://${hostName}:${port}/`),
);
