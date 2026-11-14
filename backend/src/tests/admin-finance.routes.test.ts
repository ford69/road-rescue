import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createTokenPair } from '../auth/tokens.js';
import { createApp } from '../app.js';
import { userRepository } from '../repositories/user.repository.js';
import { financeReportService } from '../services/finance-report.service.js';

vi.mock('../repositories/user.repository.js', () => ({
  userRepository: {
    findById: vi.fn(),
    findByIdWithSecrets: vi.fn(),
    findByEmailWithSecrets: vi.fn(),
  },
}));

vi.mock('../services/finance-report.service.js', () => ({
  financeReportService: {
    summary: vi.fn(),
    listTransactions: vi.fn(),
  },
}));

vi.mock('../email/index.js', () => ({
  emailService: { sendVerificationEmail: vi.fn(), sendPasswordResetEmail: vi.fn() },
}));

const adminId = '64a0000000000000000000aa';

describe('GET /api/admin/finance/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userRepository.findById).mockResolvedValue({
      _id: { toString: () => adminId },
      emailVerified: true,
      role: 'admin',
    } as never);
    vi.mocked(financeReportService.summary).mockResolvedValue({
      currency: 'GHS',
      collected: { totalGhs: 0, count: 0 },
    } as never);
  });

  it('is registered on the app (not 404) for an admin bearer token', async () => {
    const { accessToken } = createTokenPair(adminId, 'admin', 'admin@roadrescue.gh');
    const response = await request(createApp())
      .get('/api/admin/finance/summary')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).not.toBe(404);
    expect(response.status).toBe(200);
    expect(financeReportService.summary).toHaveBeenCalled();
  });

  it('is registered for transactions as well', async () => {
    vi.mocked(financeReportService.listTransactions).mockResolvedValue({
      items: [],
      page: 1,
      totalPages: 1,
      total: 0,
      limit: 20,
    } as never);
    const { accessToken } = createTokenPair(adminId, 'admin', 'admin@roadrescue.gh');
    const response = await request(createApp())
      .get('/api/admin/finance/transactions')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
  });
});
