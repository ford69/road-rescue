import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { verifyAccessToken } from '../auth/tokens.js';
import { userRepository } from '../repositories/user.repository.js';
import { env } from '../config/env.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { mechanicRepository } from '../repositories/mechanic.repository.js';
import { requestRepository } from '../repositories/request.repository.js';
import { refId } from '../utils/objectId.js';
import type { JwtPayload } from '../types/index.js';

let io: Server | null = null;

async function canTrackRequest(user: JwtPayload, requestId: string): Promise<boolean> {
  if (user.role === 'admin') return true;
  const request = await requestRepository.findById(requestId);
  if (!request) return false;

  if (user.role === 'customer') {
    const customer = await customerRepository.findByUserId(user.sub);
    return Boolean(customer && refId(request.customer) === customer._id.toString());
  }

  const mechanic = await mechanicRepository.findByUserId(user.sub);
  return Boolean(
    mechanic &&
      request.mechanic &&
      refId(request.mechanic) === mechanic._id.toString(),
  );
}

export function initSockets(httpServer: HttpServer): void {
  io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_ORIGINS,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token =
      typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : undefined;
    if (!token) {
      next(new Error('Authentication required'));
      return;
    }
    try {
      const payload = verifyAccessToken(token);
      void userRepository
        .findById(payload.sub)
        .then((user) => {
          if (!user) {
            next(new Error('Authentication required'));
            return;
          }
          if (!user.emailVerified) {
            next(new Error('Please verify your email address before accessing Road Rescue.'));
            return;
          }
          socket.data.user = payload;
          next();
        })
        .catch(next);
    } catch {
      next(new Error('Invalid or expired access token'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('tracking:join', async (payload: { requestId?: string }) => {
      const requestId = payload?.requestId;
      if (!requestId || !(await canTrackRequest(socket.data.user as JwtPayload, requestId))) {
        socket.emit('tracking:error', { message: 'You cannot track this request' });
        return;
      }
      await socket.join(`request:${requestId}`);
      socket.emit('tracking:joined', { requestId });
    });

    socket.on('tracking:leave', (payload: { requestId?: string }) => {
      if (payload?.requestId) void socket.leave(`request:${payload.requestId}`);
    });
  });
}

export function emitToRequest(requestId: string, event: string, payload: unknown): void {
  io?.to(`request:${requestId}`).emit(event, payload);
}
