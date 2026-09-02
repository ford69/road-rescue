import type { Request, Response } from 'express';
import { supportService } from '../services/support.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { UnauthorizedError } from '../utils/errors.js';

export const supportController = {
  create: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await supportService.createTicket(req.user.id, req.body);
    return sendSuccess(res, data, 'Support message submitted', 201);
  },
};
