import type { z } from 'zod';
import { SupportTicket } from '../models/SupportTicket.js';
import { userRepository } from '../repositories/user.repository.js';
import { emailService } from '../email/index.js';
import { NotFoundError } from '../utils/errors.js';
import type { createSupportTicketSchema } from '../validators/auth.validators.js';

type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>;

export const supportService = {
  async createTicket(userId: string, input: CreateSupportTicketInput) {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    const ticket = await SupportTicket.create({
      user: user._id,
      subject: input.subject,
      description: input.description,
      category: input.category ?? 'complaint',
      status: 'open',
    });

    const userName = `${user.firstName} ${user.lastName}`.trim();
    void emailService.sendSupportComplaintEmail({
      ticketId: ticket._id.toString(),
      category: ticket.category,
      subject: ticket.subject,
      description: ticket.description,
      userName,
      userEmail: user.email,
      userPhone: user.phone ?? '',
      userRole: user.role,
    });

    return {
      id: ticket._id.toString(),
      subject: ticket.subject,
      description: ticket.description,
      category: ticket.category,
      status: ticket.status,
      createdAt: ticket.createdAt,
    };
  },
};
