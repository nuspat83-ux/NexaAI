import type { IncomingMessage, ServerResponse } from 'node:http';
import { waitUntil } from '@vercel/functions';
import { requestHandler } from '../../server/index.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return requestHandler(req, res, waitUntil);
}
