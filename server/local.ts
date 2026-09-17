import http from 'node:http';
import { requestHandler } from './index.js';

const port = Number(process.env.PORT || 8787);
const server = http.createServer((req, res) => {
  void requestHandler(req, res, task => {
    void task;
  });
});

server.listen(port, () => console.log(`NexaAI server listening on :${port}`));
