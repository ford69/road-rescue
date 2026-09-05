import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, ValidationError } from '../utils/errors.js';
import { mechanicRepository } from '../repositories/mechanic.repository.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { requestRepository } from '../repositories/request.repository.js';
import { notificationRepository } from '../repositories/misc.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { requestService } from '../services/domain.service.js';
import { isPaymentAvailable } from '../services/payment.service.js';

vi.mock('../sockets/index.js', () => ({
  emitToRequest: vi.fn(),
}));

vi.mock('../repositories/mechanic.repository.js', () => ({
  mechanicRepository: {
    findByUserId: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock('../repositories/customer.repository.js', () => ({
  customerRepository: { findByUserId: vi.fn(), findById: vi.fn() },
}));

vi.mock('../repositories/request.repository.js', () => ({
  requestRepository: {
    findById: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

vi.mock('../repositories/misc.repository.js', () => ({
  notificationRepository: { create: vi.fn() },
  paymentRepository: {},
  liveLocationRepository: {},
  serviceTypeRepository: {},
  assignmentRepository: {},
}));

vi.mock('../repositories/user.repository.js', () => ({
  userRepository: { findByRole: vi.fn() },
}));

vi.mock('../models/SupportTicket.js', () => ({
  SupportTicket: { create: vi.fn().mockResolvedValue({}) },
}));

const mechanicUserId = '64a000000000000000000001';
const mechanicId = '64a000000000000000000002';
const otherMechanicUserId = '64a000000000000000000003';
const customerUserId = '64a000000000000000000004';
const customerId = '64a000000000000000000005';
const otherCustomerUserId = '64a000000000000000000006';
const requestId = '64a000000000000000000007';

function mechanicDoc(userId = mechanicUserId) {
  return {
    _id: { toString: () => mechanicId },
    userId,
    completedJobs: 0,
    save: vi.fn(),
  };
}

function customerDoc(userId = customerUserId) {
  return {
    _id: { toString: () => customerId },
    userId,
  };
}

function requestDoc(status: string) {
  return {
    _id: requestId,
    status,
    mechanic: mechanicId,
    customer: customerId,
    quotedPrice: 120,
  };
}

describe('service confirmation workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(notificationRepository.create).mockResolvedValue({} as never);
    vi.mocked(requestRepository.updateStatus).mockResolvedValue({} as never);
    vi.mocked(requestRepository.findById).mockResolvedValue(requestDoc('inprogress') as never);
    vi.mocked(customerRepository.findById).mockResolvedValue(customerDoc() as never);
    vi.mocked(userRepository.findByRole).mockResolvedValue([] as never);
  });

  it('lets the assigned mechanic request customer confirmation', async () => {
    vi.mocked(mechanicRepository.findByUserId).mockResolvedValue(mechanicDoc() as never);
    vi.mocked(requestRepository.findById)
      .mockResolvedValueOnce(requestDoc('inprogress') as never)
      .mockResolvedValueOnce({ ...requestDoc('awaiting_confirmation') } as never);

    const result = await requestService.requestConfirmation(mechanicUserId, requestId);
    expect(requestRepository.updateStatus).toHaveBeenCalledWith(
      requestId,
      'awaiting_confirmation',
      expect.objectContaining({ completionRequestedBy: mechanicUserId }),
    );
    expect(result).toMatchObject({ status: 'awaiting_confirmation' });
  });

  it('rejects confirmation requests from an unrelated mechanic', async () => {
    vi.mocked(mechanicRepository.findByUserId).mockResolvedValue({
      ...mechanicDoc(otherMechanicUserId),
      _id: { toString: () => '64a000000000000000000099' },
    } as never);

    await expect(requestService.requestConfirmation(otherMechanicUserId, requestId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(requestRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('lets the owning customer confirm and close the service', async () => {
    vi.mocked(customerRepository.findByUserId).mockResolvedValue(customerDoc() as never);
    vi.mocked(requestRepository.findById)
      .mockResolvedValueOnce(requestDoc('awaiting_confirmation') as never)
      .mockResolvedValueOnce({ ...requestDoc('completed') } as never);
    vi.mocked(mechanicRepository.findById).mockResolvedValue(mechanicDoc() as never);

    const result = await requestService.confirmCompletion(customerUserId, requestId);
    expect(requestRepository.updateStatus).toHaveBeenCalledWith(
      requestId,
      'completed',
      expect.objectContaining({ customerConfirmedBy: customerUserId }),
    );
    expect(result).toMatchObject({ status: 'completed' });
    expect(isPaymentAvailable('completed')).toBe(true);
  });

  it('rejects confirmation from another customer', async () => {
    vi.mocked(customerRepository.findByUserId).mockResolvedValue({
      _id: { toString: () => '64a000000000000000000088' },
      userId: otherCustomerUserId,
    } as never);
    vi.mocked(requestRepository.findById).mockResolvedValue(requestDoc('awaiting_confirmation') as never);

    await expect(requestService.confirmCompletion(otherCustomerUserId, requestId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('keeps the service unresolved when a customer reports an issue', async () => {
    vi.mocked(customerRepository.findByUserId).mockResolvedValue(customerDoc() as never);
    vi.mocked(requestRepository.findById)
      .mockResolvedValueOnce(requestDoc('awaiting_confirmation') as never)
      .mockResolvedValueOnce({ ...requestDoc('issue_reported') } as never);
    vi.mocked(mechanicRepository.findById).mockResolvedValue(mechanicDoc() as never);

    const result = await requestService.reportIssue(
      customerUserId,
      requestId,
      'The battery was not replaced as requested.',
    );
    expect(requestRepository.updateStatus).toHaveBeenCalledWith(
      requestId,
      'issue_reported',
      expect.objectContaining({ issueReason: 'The battery was not replaced as requested.' }),
    );
    expect(result).toMatchObject({ status: 'issue_reported' });
    expect(isPaymentAvailable('issue_reported')).toBe(false);
    expect(notificationRepository.create).toHaveBeenCalled();
  });

  it('lets a mechanic request confirmation via status patch', async () => {
    vi.mocked(mechanicRepository.findByUserId).mockResolvedValue(mechanicDoc() as never);
    vi.mocked(requestRepository.findById)
      .mockResolvedValueOnce(requestDoc('inprogress') as never)
      .mockResolvedValueOnce({ ...requestDoc('awaiting_confirmation') } as never);

    const result = await requestService.updateStatus(mechanicUserId, 'mechanic', requestId, {
      status: 'awaiting_confirmation',
    });
    expect(requestRepository.updateStatus).toHaveBeenCalledWith(
      requestId,
      'awaiting_confirmation',
      expect.objectContaining({ completionRequestedBy: mechanicUserId }),
    );
    expect(result).toMatchObject({ status: 'awaiting_confirmation' });
  });

  it('treats a mechanic completed patch as a customer confirmation request', async () => {
    vi.mocked(mechanicRepository.findByUserId).mockResolvedValue(mechanicDoc() as never);
    vi.mocked(requestRepository.findById)
      .mockResolvedValueOnce(requestDoc('inprogress') as never)
      .mockResolvedValueOnce({ ...requestDoc('awaiting_confirmation') } as never);

    const result = await requestService.updateStatus(mechanicUserId, 'mechanic', requestId, {
      status: 'completed',
    });
    expect(requestRepository.updateStatus).toHaveBeenCalledWith(
      requestId,
      'awaiting_confirmation',
      expect.objectContaining({ completionRequestedBy: mechanicUserId }),
    );
    expect(result).toMatchObject({ status: 'awaiting_confirmation' });
  });

  it('does not treat awaiting confirmation as payable', () => {
    expect(isPaymentAvailable('awaiting_confirmation')).toBe(false);
    expect(isPaymentAvailable('inprogress')).toBe(false);
    expect(isPaymentAvailable('completed')).toBe(true);
  });

  it('rejects customer confirmation while the job is still in progress', async () => {
    vi.mocked(customerRepository.findByUserId).mockResolvedValue(customerDoc() as never);
    vi.mocked(requestRepository.findById).mockResolvedValue(requestDoc('inprogress') as never);
    await expect(requestService.confirmCompletion(customerUserId, requestId)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
