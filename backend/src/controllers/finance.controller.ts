import type { Request, Response } from 'express';
import { financeReportService } from '../services/finance-report.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const financeController = {
  summary: async (req: Request, res: Response) => {
    const data = await financeReportService.summary({ from: req.query.from, to: req.query.to });
    return sendSuccess(res, data);
  },

  transactions: async (req: Request, res: Response) => {
    const data = await financeReportService.listTransactions(req.query as Record<string, unknown>);
    return sendSuccess(res, data);
  },
};
