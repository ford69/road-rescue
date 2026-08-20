import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authenticate, authorize, guestOnly } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { upload } from '../uploads/storage.js';
import {
  createAdminSchema,
  forgotPasswordSchema,
  loginSchema,
  registerCustomerSchema,
  registerMechanicSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../validators/auth.validators.js';

const router = Router();

router.post(
  '/register/customer',
  guestOnly,
  validateBody(registerCustomerSchema),
  asyncHandler(authController.registerCustomer),
);

router.post(
  '/register/mechanic',
  guestOnly,
  upload.single('selfie'),
  validateBody(registerMechanicSchema),
  asyncHandler(authController.registerMechanic),
);

router.post(
  '/register/admin',
  authenticate,
  authorize('admin'),
  validateBody(createAdminSchema),
  asyncHandler(authController.createAdmin),
);

router.post('/login', guestOnly, validateBody(loginSchema), asyncHandler(authController.login));
router.post('/logout', authenticate, asyncHandler(authController.logout));
router.post('/refresh', asyncHandler(authController.refresh));
router.post(
  '/forgot-password',
  validateBody(forgotPasswordSchema),
  asyncHandler(authController.forgotPassword),
);
router.post(
  '/reset-password',
  validateBody(resetPasswordSchema),
  asyncHandler(authController.resetPassword),
);
router.post(
  '/verify-email',
  validateBody(verifyEmailSchema),
  asyncHandler(authController.verifyEmail),
);
router.get('/me', authenticate, asyncHandler(authController.me));

export default router;
