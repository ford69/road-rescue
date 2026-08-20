import { chatMessageRepository } from '../repositories/misc.repository.js';
import { emitToRequest } from '../sockets/index.js';
import { assertObjectId } from '../utils/objectId.js';
import { requestService } from './domain.service.js';
import { Types } from 'mongoose';

export const chatService = {
  async list(userId: string, role: string, requestId: string) {
    await requestService.getById(userId, role, requestId);
    return chatMessageRepository.findByRequest(requestId);
  },

  async send(userId: string, role: string, requestId: string, body: string) {
    await requestService.getById(userId, role, requestId);
    const message = await chatMessageRepository.create({
      request: new Types.ObjectId(assertObjectId(requestId, 'request id')),
      sender: new Types.ObjectId(assertObjectId(userId, 'user id')),
      body: body.trim(),
    });
    emitToRequest(requestId, 'chat:message', message.toObject());
    return message;
  },
};
