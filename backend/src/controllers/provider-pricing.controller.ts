import type { Request, Response } from 'express';
import { requestService } from '../services/domain.service.js';
import { providerPricingService } from '../services/provider-pricing.service.js';
import type { ServiceTypeSlug } from '../types/index.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { UnauthorizedError, ValidationError } from '../utils/errors.js';

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || !value) {
    throw new ValidationError(`Missing route parameter: ${name}`);
  }
  return value;
}

export const providerPricingController = {
  listMine: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await providerPricingService.listForProvider(req.user.id);
    return sendSuccess(res, data);
  },
  upsert: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await providerPricingService.upsert(req.user.id, req.body);
    return sendSuccess(res, data, 'Service pricing saved');
  },
  setStatus: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await providerPricingService.setStatus(
      req.user.id,
      param(req, 'serviceType') as ServiceTypeSlug,
      Boolean(req.body.active),
    );
    return sendSuccess(res, data, req.body.active ? 'Service enabled' : 'Service disabled');
  },
  remove: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await providerPricingService.remove(
      req.user.id,
      param(req, 'serviceType') as ServiceTypeSlug,
    );
    return sendSuccess(res, data, 'Service removed from your active list');
  },
  listProvidersForService: async (req: Request, res: Response) => {
    const lat = Number(req.query.lat ?? 5.6037);
    const lng = Number(req.query.lng ?? -0.187);
    const data = await providerPricingService.listProvidersForService(
      param(req, 'slug') as ServiceTypeSlug,
      lat,
      lng,
    );
    return sendSuccess(res, data);
  },
  listPublicForMechanic: async (req: Request, res: Response) => {
    const data = await providerPricingService.listPublicForMechanic(param(req, 'id'));
    return sendSuccess(res, data);
  },
  getQuote: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await requestService.getQuote(req.user.id, req.user.role, param(req, 'id'));
    return sendSuccess(res, data);
  },
  submitQuote: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await requestService.submitQuote(req.user.id, param(req, 'id'), req.body);
    return sendSuccess(res, data, 'Quote sent to the customer');
  },
  acceptQuote: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await requestService.acceptQuote(req.user.id, param(req, 'id'));
    return sendSuccess(res, data, 'Quote accepted');
  },
  rejectQuote: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await requestService.rejectQuote(req.user.id, param(req, 'id'), req.body?.reason);
    return sendSuccess(res, data, 'Quote declined');
  },
  adminCatalogue: async (_req: Request, res: Response) => {
    const data = await providerPricingService.adminListCatalogue();
    return sendSuccess(res, data);
  },
  adminSetCatalogue: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await providerPricingService.adminSetCatalogueStatus(
      req.user.id,
      param(req, 'slug') as ServiceTypeSlug,
      Boolean(req.body.active),
      req.body.reason,
    );
    return sendSuccess(res, data, req.body.active ? 'Service activated' : 'Service deactivated');
  },
  adminProviderServices: async (req: Request, res: Response) => {
    const data = await providerPricingService.adminListProviderServices(param(req, 'id'));
    return sendSuccess(res, data);
  },
};
