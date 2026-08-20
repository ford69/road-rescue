import type { Request, Response } from 'express';
import { chatService } from '../services/chat.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { UnauthorizedError } from '../utils/errors.js';

function requestId(req: Request): string {
  const value = req.params.id;
  if (typeof value !== 'string' || !value) throw new Error('Missing request id');
  return value;
}

export const chatController = {
  list: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await chatService.list(req.user.id, req.user.role, requestId(req));
    return sendSuccess(res, data);
  },

  send: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await chatService.send(
      req.user.id,
      req.user.role,
      requestId(req),
      req.body.body,
    );
    return sendSuccess(res, data, 'Message sent', 201);
  },
};
