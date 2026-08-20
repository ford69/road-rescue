import type { Request, Response } from 'express';
import {
  adminService,
  catalogService,
  mechanicService,
  notificationService,
  requestService,
  vehicleService,
} from '../services/domain.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { UnauthorizedError, ValidationError } from '../utils/errors.js';

function paramId(req: Request, name = 'id'): string {
  const value = req.params[name];
  if (typeof value !== 'string' || !value) {
    throw new ValidationError(`Missing route parameter: ${name}`);
  }
  return value;
}

export const vehicleController = {
  list: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await vehicleService.listForUser(req.user.id);
    return sendSuccess(res, data);
  },
  create: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await vehicleService.create(req.user.id, req.body);
    return sendSuccess(res, data, 'Vehicle added', 201);
  },
  remove: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await vehicleService.remove(req.user.id, paramId(req));
    return sendSuccess(res, data, 'Vehicle removed');
  },
};

export const requestController = {
  create: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await requestService.create(req.user.id, req.body);
    return sendSuccess(res, data, 'Rescue requested', 201);
  },
  listMine: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await requestService.listMine(req.user.id, req.user.role);
    return sendSuccess(res, data);
  },
  getById: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await requestService.getById(req.user.id, req.user.role, paramId(req));
    return sendSuccess(res, data);
  },
  getLocation: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await requestService.getLocation(req.user.id, req.user.role, paramId(req));
    return sendSuccess(res, data);
  },
  available: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await requestService.listAvailableJobs(req.user.id);
    return sendSuccess(res, data);
  },
  accept: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await requestService.accept(req.user.id, paramId(req));
    return sendSuccess(res, data, 'Job accepted');
  },
  updateStatus: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await requestService.updateStatus(
      req.user.id,
      req.user.role,
      paramId(req),
      req.body,
    );
    return sendSuccess(res, data, 'Status updated');
  },
};

export const mechanicController = {
  availability: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await mechanicService.setAvailability(req.user.id, req.body);
    return sendSuccess(res, data, 'Availability updated');
  },
  location: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await mechanicService.updateLocation(req.user.id, req.body);
    return sendSuccess(res, data, 'Location updated');
  },
  nearby: async (req: Request, res: Response) => {
    const lat = Number(req.query.lat ?? 5.6037);
    const lng = Number(req.query.lng ?? -0.187);
    const data = await mechanicService.listNearby(lat, lng);
    return sendSuccess(res, data);
  },
  earnings: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await mechanicService.earnings(req.user.id);
    return sendSuccess(res, data);
  },
};

export const notificationController = {
  list: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const data = await notificationService.list(req.user.id);
    return sendSuccess(res, data);
  },
  markAllRead: async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    await notificationService.markAllRead(req.user.id);
    return sendSuccess(res, { success: true }, 'Notifications marked as read');
  },
};

export const adminController = {
  dashboard: async (_req: Request, res: Response) => {
    const data = await adminService.dashboard();
    return sendSuccess(res, data);
  },
  verifyMechanic: async (req: Request, res: Response) => {
    const data = await adminService.verifyMechanic(paramId(req), req.body.status);
    return sendSuccess(res, data, `Mechanic ${req.body.status}`);
  },
};

export const catalogController = {
  serviceTypes: async (_req: Request, res: Response) => {
    const data = await catalogService.serviceTypes();
    return sendSuccess(res, data);
  },
};
