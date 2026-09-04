import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authenticate, authorize, guestOnly } from '../middleware/auth.js';
import {
  resendVerificationHourlyLimiter,
  resendVerificationMinuteLimiter,
  verifyEmailLimiter,
} from '../middleware/authRateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { upload } from '../uploads/storage.js';
import { ApiError } from '../utils/errors.js';
import {
  createAdminSchema,
  forgotPasswordSchema,
  loginSchema,
  registerCustomerSchema,
  registerMechanicSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../validators/auth.validators.js';

const router = Router();

// Public auth endpoints first — never require a bearer token.
// Login is allowed while a previous session is still present so users can
// switch accounts after deploy or a stale cookie/token.
router.post('/login', validateBody(loginSchema), asyncHandler(authController.login));
router.post(
  '/admin/login',
  validateBody(loginSchema),
  asyncHandler(authController.loginAdmin),
);
router.post(
  '/login/admin',
  validateBody(loginSchema),
  asyncHandler(authController.loginAdmin),
);

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
  verifyEmailLimiter,
  validateBody(verifyEmailSchema),
  asyncHandler(authController.verifyEmail),
);
router.post(
  '/resend-verification',
  resendVerificationMinuteLimiter,
  resendVerificationHourlyLimiter,
  validateBody(resendVerificationSchema),
  asyncHandler(authController.resendVerification),
);
router.get('/me', authenticate, asyncHandler(authController.me));

// Keep unmatched /api/auth/* requests from falling through to the
// authenticated /api router (which would return a confusing 401).
router.use((_req, _res, next) => {
  next(new ApiError(404, 'Auth route not found'));
});

export default router;
