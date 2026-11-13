#!/usr/bin/env node
/**
 * Builds Postman Collection v2.1 files for local and production API testing.
 * Run: node postman/generate.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));

const SCHEMA = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';

const ENVIRONMENTS = {
  local: {
    name: 'Road Rescue API — Local',
    values: {
      baseUrl: 'http://localhost:4002',
      customerEmail: 'ama.serwaa@example.com',
      customerPassword: 'Password123!',
      mechanicEmail: 'kwame.mensah@example.com',
      mechanicPassword: 'Password123!',
      adminEmail: 'admin@roadrescue.gh',
      adminPassword: 'Admin123!',
    },
  },
  prod: {
    name: 'Road Rescue API — Production',
    values: {
      baseUrl: 'https://api.roadrescue4u.com',
      customerEmail: 'REPLACE_WITH_PROD_CUSTOMER_EMAIL',
      customerPassword: 'REPLACE_WITH_PROD_CUSTOMER_PASSWORD',
      mechanicEmail: 'REPLACE_WITH_PROD_MECHANIC_EMAIL',
      mechanicPassword: 'REPLACE_WITH_PROD_MECHANIC_PASSWORD',
      adminEmail: 'REPLACE_WITH_PROD_ADMIN_EMAIL',
      adminPassword: 'REPLACE_WITH_PROD_ADMIN_PASSWORD',
    },
  },
};

function uid() {
  return randomUUID();
}

function header(key, value) {
  return { key, value, type: 'text' };
}

function jsonBody(obj) {
  return {
    mode: 'raw',
    raw: JSON.stringify(obj, null, 2),
    options: { raw: { language: 'json' } },
  };
}

function formdataBody(fields) {
  return {
    mode: 'formdata',
    formdata: fields.map((field) => ({
      key: field.key,
      value: field.src ? undefined : field.value ?? '',
      src: field.src,
      type: field.type ?? (field.src ? 'file' : 'text'),
      description: field.description,
    })),
  };
}

function queryParams(pairs) {
  return Object.entries(pairs).map(([key, value]) => ({
    key,
    value: String(value),
    disabled: value === '',
  }));
}

function event(listen, exec) {
  return {
    listen,
    script: {
      type: 'text/javascript',
      exec: exec.split('\n'),
    },
  };
}

function saveTokensScript(role) {
  return `
if (pm.response.code !== 200 && pm.response.code !== 201) { return; }
try {
  const json = pm.response.json();
  const tokens = json.data && json.data.tokens;
  if (tokens && tokens.accessToken) {
    pm.collectionVariables.set('accessToken', tokens.accessToken);
    pm.collectionVariables.set('refreshToken', tokens.refreshToken);
    pm.collectionVariables.set('${role}AccessToken', tokens.accessToken);
  }
  const user = json.data && json.data.user;
  if (user && user.id) {
    pm.collectionVariables.set('${role}UserId', user.id);
  }
} catch (e) {}
`.trim();
}

function switchTokenScript(role) {
  return `
const token = pm.collectionVariables.get('${role}AccessToken');
if (!token) {
  throw new Error('Run the ${role} login request first');
}
pm.collectionVariables.set('accessToken', token);
`.trim();
}

function req({
  name,
  method,
  path,
  auth,
  description,
  body,
  query,
  headers,
  tests,
  prerequest,
}) {
  const urlPath = path.startsWith('/') ? path : `/${path}`;
  const pathSegments = urlPath.split('/').filter(Boolean);
  const rawQuery = query
    ? Object.entries(query)
        .filter(([, value]) => value !== '')
        .map(([k, v]) => `${k}=${v}`)
        .join('&')
    : '';
  const item = {
    name,
    request: {
      method,
      header: [
        header('Accept', 'application/json'),
        ...(body?.mode === 'raw' ? [header('Content-Type', 'application/json')] : []),
        ...(headers ?? []),
      ],
      url: {
        raw: `{{baseUrl}}${urlPath}${rawQuery ? `?${rawQuery}` : ''}`,
        host: ['{{baseUrl}}'],
        path: pathSegments,
        ...(query ? { query: queryParams(query) } : {}),
      },
      description,
    },
  };
  if (auth === 'noauth') {
    item.request.auth = { type: 'noauth' };
  }
  if (body) item.request.body = body;
  const events = [];
  if (prerequest) events.push(event('prerequest', prerequest));
  if (tests) events.push(event('test', tests));
  if (events.length) item.event = events;
  return item;
}

function folder(name, description, items) {
  if (Array.isArray(description)) {
    return { name, item: description };
  }
  return { name, description, item: items };
}

function collectionVariables(defaults) {
  const extra = [
    ['accessToken', ''],
    ['refreshToken', ''],
    ['customerAccessToken', ''],
    ['mechanicAccessToken', ''],
    ['adminAccessToken', ''],
    ['customerUserId', ''],
    ['mechanicUserId', ''],
    ['adminUserId', ''],
    ['vehicleId', ''],
    ['requestId', ''],
    ['mechanicId', ''],
    ['notificationId', ''],
    ['payoutMethodId', ''],
    ['withdrawalId', ''],
    ['settlementId', ''],
    ['paymentReference', ''],
    ['depositReference', ''],
    ['verifyEmailToken', ''],
    ['resetPasswordToken', ''],
    ['serviceType', 'flat-tire'],
    ['paystackSignature', ''],
  ];
  return [
    ...Object.entries(defaults).map(([key, value]) => ({ key, value })),
    ...extra.map(([key, value]) => ({ key, value })),
  ];
}

function buildItems() {
  return [
    folder('0. Session helpers', 'Run a login, then use these to switch the active Bearer token.', [
      req({
        name: 'Use customer token',
        method: 'GET',
        path: '/api/health',
        auth: 'noauth',
        description: 'Copies customerAccessToken into accessToken.',
        prerequest: switchTokenScript('customer'),
      }),
      req({
        name: 'Use mechanic token',
        method: 'GET',
        path: '/api/health',
        auth: 'noauth',
        description: 'Copies mechanicAccessToken into accessToken.',
        prerequest: switchTokenScript('mechanic'),
      }),
      req({
        name: 'Use admin token',
        method: 'GET',
        path: '/api/health',
        auth: 'noauth',
        description: 'Copies adminAccessToken into accessToken.',
        prerequest: switchTokenScript('admin'),
      }),
    ]),

    folder('1. Public', 'No authentication required.', [
      req({
        name: 'API root',
        method: 'GET',
        path: '/',
        auth: 'noauth',
      }),
      req({
        name: 'Health',
        method: 'GET',
        path: '/api/health',
        auth: 'noauth',
      }),
      req({
        name: 'List service types',
        method: 'GET',
        path: '/api/service-types',
        auth: 'noauth',
      }),
      req({
        name: 'List subscription plans',
        method: 'GET',
        path: '/api/subscriptions/plans',
        auth: 'noauth',
      }),
      req({
        name: 'Paystack webhook',
        method: 'POST',
        path: '/api/webhooks/paystack',
        auth: 'noauth',
        description:
          'Raw JSON body plus x-paystack-signature. Local testing without a valid signature will 401 unless PAYSTACK_WEBHOOK_SECRET is empty.',
        headers: [header('x-paystack-signature', '{{paystackSignature}}')],
        body: {
          mode: 'raw',
          raw: JSON.stringify(
            {
              event: 'charge.success',
              data: {
                reference: '{{depositReference}}',
                amount: 20000,
                status: 'success',
                channel: 'mobile_money',
              },
            },
            null,
            2,
          ),
          options: { raw: { language: 'json' } },
        },
      }),
      req({
        name: 'Paystack callback (canonical)',
        method: 'GET',
        path: '/api/subscriptions/paystack/callback',
        auth: 'noauth',
        query: { reference: '{{paymentReference}}' },
      }),
      req({
        name: 'Paystack callback (legacy /v1)',
        method: 'GET',
        path: '/api/v1/subscriptions/paystack/callback',
        auth: 'noauth',
        query: { reference: '{{paymentReference}}' },
      }),
    ]),

    folder('2. Auth', 'Login responses save Bearer tokens into collection variables.', [
      req({
        name: 'Login customer',
        method: 'POST',
        path: '/api/auth/login',
        auth: 'noauth',
        body: jsonBody({ email: '{{customerEmail}}', password: '{{customerPassword}}' }),
        tests: saveTokensScript('customer'),
      }),
      req({
        name: 'Login mechanic',
        method: 'POST',
        path: '/api/auth/login',
        auth: 'noauth',
        body: jsonBody({ email: '{{mechanicEmail}}', password: '{{mechanicPassword}}' }),
        tests: saveTokensScript('mechanic'),
      }),
      req({
        name: 'Login admin',
        method: 'POST',
        path: '/api/auth/admin/login',
        auth: 'noauth',
        body: jsonBody({ email: '{{adminEmail}}', password: '{{adminPassword}}' }),
        tests: saveTokensScript('admin'),
      }),
      req({
        name: 'Login admin (alias /login/admin)',
        method: 'POST',
        path: '/api/auth/login/admin',
        auth: 'noauth',
        body: jsonBody({ email: '{{adminEmail}}', password: '{{adminPassword}}' }),
        tests: saveTokensScript('admin'),
      }),
      req({
        name: 'Register customer',
        method: 'POST',
        path: '/api/auth/register/customer',
        auth: 'noauth',
        body: jsonBody({
          firstName: 'Ama',
          lastName: 'Serwaa',
          email: 'ama.new@example.com',
          phone: '0244000001',
          password: 'Password123!',
        }),
        tests: saveTokensScript('customer'),
      }),
      req({
        name: 'Register mechanic (multipart + selfie)',
        method: 'POST',
        path: '/api/auth/register/mechanic',
        auth: 'noauth',
        description: 'Select a selfie image in the form-data file field before sending.',
        body: formdataBody([
          { key: 'firstName', value: 'Kwame' },
          { key: 'lastName', value: 'Mensah' },
          { key: 'email', value: 'kwame.new@example.com' },
          { key: 'phone', value: '0244000002' },
          { key: 'password', value: 'Password123!' },
          { key: 'garageName', value: 'Kwame Roadside' },
          { key: 'ghanaCardNumber', value: 'GHA-123456789-1' },
          { key: 'experience', value: '5' },
          { key: 'city', value: 'Accra' },
          { key: 'address', value: 'Ring Road East' },
          { key: 'latitude', value: '5.6037' },
          { key: 'longitude', value: '-0.1870' },
          { key: 'specialties', value: '["towing","battery"]' },
          { key: 'selfie', src: [], type: 'file', description: 'Provider selfie photo' },
        ]),
      }),
      req({
        name: 'Complete mechanic registration',
        method: 'POST',
        path: '/api/auth/register/mechanic/complete',
        auth: 'noauth',
        body: jsonBody({ reference: '{{paymentReference}}' }),
        tests: saveTokensScript('mechanic'),
      }),
      req({
        name: 'Create admin (existing admin token)',
        method: 'POST',
        path: '/api/auth/register/admin',
        body: jsonBody({
          firstName: 'New',
          lastName: 'Admin',
          email: 'new.admin@roadrescue.gh',
          phone: '0244000003',
          password: 'Admin123!',
        }),
      }),
      req({
        name: 'Resend verification',
        method: 'POST',
        path: '/api/auth/resend-verification',
        auth: 'noauth',
        body: jsonBody({ email: '{{customerEmail}}' }),
      }),
      req({
        name: 'Resend verification (alias)',
        method: 'POST',
        path: '/api/auth/verification/resend',
        auth: 'noauth',
        body: jsonBody({ email: '{{customerEmail}}' }),
      }),
      req({
        name: 'Verify email',
        method: 'POST',
        path: '/api/auth/verify-email',
        auth: 'noauth',
        body: jsonBody({ token: '{{verifyEmailToken}}' }),
        tests: saveTokensScript('customer'),
      }),
      req({
        name: 'Forgot password',
        method: 'POST',
        path: '/api/auth/forgot-password',
        auth: 'noauth',
        body: jsonBody({ email: '{{customerEmail}}' }),
      }),
      req({
        name: 'Reset password',
        method: 'POST',
        path: '/api/auth/reset-password',
        auth: 'noauth',
        body: jsonBody({ token: '{{resetPasswordToken}}', password: 'Password123!' }),
      }),
      req({
        name: 'Refresh tokens',
        method: 'POST',
        path: '/api/auth/refresh',
        auth: 'noauth',
        body: jsonBody({ refreshToken: '{{refreshToken}}' }),
        tests: `
if (pm.response.code !== 200) { return; }
try {
  const json = pm.response.json();
  const tokens = json.data && json.data.tokens;
  if (tokens && tokens.accessToken) {
    pm.collectionVariables.set('accessToken', tokens.accessToken);
    pm.collectionVariables.set('refreshToken', tokens.refreshToken);
  }
} catch (e) {}
`.trim(),
      }),
      req({
        name: 'Current user',
        method: 'GET',
        path: '/api/auth/me',
      }),
      req({
        name: 'Logout',
        method: 'POST',
        path: '/api/auth/logout',
        auth: 'noauth',
      }),
    ]),

    folder('3. Customer subscriptions', 'Requires a customer token. Checkout/upgrade hit Paystack.', [
      req({ name: 'Current subscription', method: 'GET', path: '/api/subscriptions/me' }),
      req({ name: 'Checkout paid plan', method: 'POST', path: '/api/subscriptions/checkout' }),
      req({ name: 'Initialize upgrade', method: 'POST', path: '/api/subscriptions/upgrade' }),
      req({
        name: 'Verify subscription payment',
        method: 'GET',
        path: '/api/subscriptions/verify/{{paymentReference}}',
      }),
      req({ name: 'Downgrade to free', method: 'POST', path: '/api/subscriptions/downgrade' }),
    ]),

    folder('4. Vehicles', 'Customer token.', [
      req({
        name: 'List vehicles',
        method: 'GET',
        path: '/api/vehicles',
        tests: `
if (pm.response.code !== 200) { return; }
try {
  const json = pm.response.json();
  const first = Array.isArray(json.data) ? json.data[0] : json.data && json.data.items && json.data.items[0];
  if (first && first.id) pm.collectionVariables.set('vehicleId', first.id);
} catch (e) {}
`.trim(),
      }),
      req({
        name: 'Create vehicle',
        method: 'POST',
        path: '/api/vehicles',
        body: jsonBody({
          make: 'Toyota',
          model: 'Corolla',
          colour: 'Silver',
          registrationNumber: 'GR-1234-20',
          year: 2018,
          engineType: 'petrol',
          nickname: 'Family car',
        }),
        tests: `
if (pm.response.code !== 200 && pm.response.code !== 201) { return; }
try {
  const json = pm.response.json();
  const id = json.data && (json.data.id || json.data._id);
  if (id) pm.collectionVariables.set('vehicleId', String(id));
} catch (e) {}
`.trim(),
      }),
      req({
        name: 'Delete vehicle',
        method: 'DELETE',
        path: '/api/vehicles/{{vehicleId}}',
      }),
    ]),

    folder('5. Rescue requests & quotes', 'Customer or mechanic depending on the request. Fill requestId after create.', [
      req({ name: 'List my requests', method: 'GET', path: '/api/requests' }),
      req({
        name: 'Customer request history',
        method: 'GET',
        path: '/api/requests/history',
        query: { page: '1', limit: '20', status: 'completed' },
      }),
      req({
        name: 'Create request',
        method: 'POST',
        path: '/api/requests',
        body: jsonBody({
          vehicleId: '{{vehicleId}}',
          serviceType: '{{serviceType}}',
          pickupAddress: 'Independence Avenue, Accra',
          pickupCity: 'Accra',
          latitude: 5.6037,
          longitude: -0.187,
          description: 'Flat rear tyre on the shoulder',
          mechanicId: '{{mechanicId}}',
        }),
        tests: `
if (pm.response.code !== 200 && pm.response.code !== 201) { return; }
try {
  const json = pm.response.json();
  const id = json.data && (json.data.id || json.data._id);
  if (id) pm.collectionVariables.set('requestId', String(id));
} catch (e) {}
`.trim(),
      }),
      req({
        name: 'Available jobs (mechanic)',
        method: 'GET',
        path: '/api/requests/available',
      }),
      req({ name: 'Get request', method: 'GET', path: '/api/requests/{{requestId}}' }),
      req({ name: 'Get request location', method: 'GET', path: '/api/requests/{{requestId}}/location' }),
      req({ name: 'List chat messages', method: 'GET', path: '/api/requests/{{requestId}}/messages' }),
      req({
        name: 'Send chat message',
        method: 'POST',
        path: '/api/requests/{{requestId}}/messages',
        body: jsonBody({ body: 'On my way, 10 minutes.' }),
      }),
      req({
        name: 'Accept request (mechanic)',
        method: 'POST',
        path: '/api/requests/{{requestId}}/accept',
      }),
      req({
        name: 'Update request status',
        method: 'PATCH',
        path: '/api/requests/{{requestId}}/status',
        body: jsonBody({ status: 'enroute' }),
        description: 'status: accepted | enroute | arrived | inprogress | awaiting_confirmation | completed | cancelled',
      }),
      req({
        name: 'Request completion confirmation (mechanic)',
        method: 'POST',
        path: '/api/requests/{{requestId}}/request-confirmation',
        body: jsonBody({ quotedPrice: 250 }),
      }),
      req({
        name: 'Confirm completion (customer)',
        method: 'POST',
        path: '/api/requests/{{requestId}}/confirm-completion',
      }),
      req({
        name: 'Report issue (customer)',
        method: 'POST',
        path: '/api/requests/{{requestId}}/report-issue',
        body: jsonBody({ reason: 'Provider did not complete the work as agreed.' }),
      }),
      req({
        name: 'Rate completed job (customer)',
        method: 'POST',
        path: '/api/requests/{{requestId}}/rating',
        body: jsonBody({ stars: 5, review: 'Arrived quickly and fixed the tyre.' }),
      }),
      req({ name: 'Get job quote', method: 'GET', path: '/api/requests/{{requestId}}/quote' }),
      req({
        name: 'Submit job quote (mechanic)',
        method: 'POST',
        path: '/api/requests/{{requestId}}/quote',
        body: jsonBody({ amountGhs: 180, partsGhs: 40, reason: 'Includes patch kit' }),
      }),
      req({
        name: 'Accept quote (customer)',
        method: 'POST',
        path: '/api/requests/{{requestId}}/quote/accept',
      }),
      req({
        name: 'Reject quote (customer)',
        method: 'POST',
        path: '/api/requests/{{requestId}}/quote/reject',
        body: jsonBody({ reason: 'Too expensive for this job' }),
      }),
    ]),

    folder('6. Payments', 'Customer Paystack initialize/verify still exists; live tracking no longer uses it for job pay.', [
      req({
        name: 'Initialize job payment (customer)',
        method: 'POST',
        path: '/api/payments/initialize/{{requestId}}',
      }),
      req({
        name: 'Verify job payment (customer)',
        method: 'GET',
        path: '/api/payments/verify/{{paymentReference}}',
      }),
      req({
        name: 'Payment for request (customer)',
        method: 'GET',
        path: '/api/requests/{{requestId}}/payment',
      }),
      req({
        name: 'Mechanic payments',
        method: 'GET',
        path: '/api/mechanics/me/payments',
      }),
      req({
        name: 'Mechanic payout info',
        method: 'GET',
        path: '/api/mechanics/me/payout-info',
      }),
    ]),

    folder('7. Mechanics & catalogue', 'Public discovery plus mechanic self-service.', [
      req({
        name: 'Nearby mechanics',
        method: 'GET',
        path: '/api/mechanics/nearby',
        query: { lat: '5.6037', lng: '-0.187' },
        tests: `
if (pm.response.code !== 200) { return; }
try {
  const json = pm.response.json();
  const first = Array.isArray(json.data) ? json.data[0] : null;
  const id = first && (first.id || first._id);
  if (id) pm.collectionVariables.set('mechanicId', String(id));
} catch (e) {}
`.trim(),
      }),
      req({
        name: 'Providers for a service type',
        method: 'GET',
        path: '/api/service-types/{{serviceType}}/providers',
        query: { lat: '5.6037', lng: '-0.187' },
      }),
      req({
        name: 'Public mechanic profile',
        method: 'GET',
        path: '/api/mechanics/{{mechanicId}}',
      }),
      req({
        name: 'Public mechanic services',
        method: 'GET',
        path: '/api/mechanics/{{mechanicId}}/services',
      }),
      req({
        name: 'Public mechanic reviews',
        method: 'GET',
        path: '/api/mechanics/{{mechanicId}}/reviews',
        query: { page: '1', limit: '20' },
      }),
      req({
        name: 'Update availability (mechanic)',
        method: 'PATCH',
        path: '/api/mechanics/me/availability',
        body: jsonBody({ availability: true }),
      }),
      req({
        name: 'Update location (mechanic)',
        method: 'POST',
        path: '/api/mechanics/me/location',
        body: jsonBody({
          latitude: 5.6037,
          longitude: -0.187,
          heading: 90,
          speed: 20,
          requestId: '{{requestId}}',
        }),
      }),
      req({ name: 'My earnings (mechanic)', method: 'GET', path: '/api/mechanics/me/earnings' }),
      req({
        name: 'My job history (mechanic)',
        method: 'GET',
        path: '/api/mechanics/me/jobs/history',
        query: { page: '1', limit: '20' },
      }),
    ]),

    folder('8. Notifications & support', 'Any authenticated role.', [
      req({
        name: 'List notifications',
        method: 'GET',
        path: '/api/notifications',
        tests: `
if (pm.response.code !== 200) { return; }
try {
  const json = pm.response.json();
  const first = Array.isArray(json.data) ? json.data[0] : json.data && json.data.items && json.data.items[0];
  if (first && first.id) pm.collectionVariables.set('notificationId', first.id);
} catch (e) {}
`.trim(),
      }),
      req({
        name: 'Mark notification read',
        method: 'POST',
        path: '/api/notifications/{{notificationId}}/read',
      }),
      req({
        name: 'Mark all notifications read',
        method: 'POST',
        path: '/api/notifications/read-all',
      }),
      req({
        name: 'Create support ticket',
        method: 'POST',
        path: '/api/support/tickets',
        body: jsonBody({
          subject: 'Need help with a payout',
          description: 'My withdrawal has been pending longer than expected.',
          category: 'billing',
        }),
      }),
    ]),

    folder('9. Provider services', 'Mechanic token.', [
      req({ name: 'List my services', method: 'GET', path: '/api/provider/services' }),
      req({
        name: 'Upsert service pricing',
        method: 'PUT',
        path: '/api/provider/services',
        body: jsonBody({
          serviceType: 'flat-tire',
          pricingModel: 'fixed',
          basePriceGhs: 120,
          additionalCharges: [
            { kind: 'call_out', label: 'Call-out', amountGhs: 30, commissionable: true },
            { kind: 'distance', label: 'Per km after 5 km', perKmGhs: 8, commissionable: true },
          ],
          partsNotIncluded: true,
          active: true,
        }),
      }),
      req({
        name: 'Set service status',
        method: 'PATCH',
        path: '/api/provider/services/{{serviceType}}/status',
        body: jsonBody({ active: true }),
      }),
      req({
        name: 'Remove service',
        method: 'DELETE',
        path: '/api/provider/services/{{serviceType}}',
      }),
    ]),

    folder('10. Provider wallet', 'Mechanic token. Withdrawal submit does not deduct; admin approve reserves funds.', [
      req({ name: 'Get wallet', method: 'GET', path: '/api/provider/wallet' }),
      req({
        name: 'List wallet transactions',
        method: 'GET',
        path: '/api/provider/wallet/transactions',
        query: { page: '1', limit: '20' },
      }),
      req({
        name: 'List deposits',
        method: 'GET',
        path: '/api/provider/wallet/deposits',
        query: { page: '1', limit: '20' },
      }),
      req({
        name: 'Initiate deposit',
        method: 'POST',
        path: '/api/provider/wallet/deposit',
        body: jsonBody({ amountGhs: 200 }),
        tests: `
if (pm.response.code !== 200 && pm.response.code !== 201) { return; }
try {
  const json = pm.response.json();
  const ref = json.data && (json.data.reference || json.data.paystackReference);
  if (ref) pm.collectionVariables.set('depositReference', String(ref));
} catch (e) {}
`.trim(),
      }),
      req({
        name: 'Verify deposit',
        method: 'GET',
        path: '/api/provider/wallet/deposit/verify/{{depositReference}}',
      }),
      req({
        name: 'List payout methods',
        method: 'GET',
        path: '/api/provider/wallet/payout-methods',
        tests: `
if (pm.response.code !== 200) { return; }
try {
  const json = pm.response.json();
  const first = Array.isArray(json.data) ? json.data[0] : json.data && json.data.items && json.data.items[0];
  if (first && first.id) pm.collectionVariables.set('payoutMethodId', first.id);
} catch (e) {}
`.trim(),
      }),
      req({
        name: 'Add payout method (MoMo)',
        method: 'POST',
        path: '/api/provider/wallet/payout-methods',
        body: jsonBody({
          kind: 'mobile_money',
          label: 'MTN MoMo',
          accountName: 'Kwame Mensah',
          accountNumber: '0244000002',
          network: 'mtn',
          isDefault: true,
        }),
        tests: `
if (pm.response.code !== 200 && pm.response.code !== 201) { return; }
try {
  const json = pm.response.json();
  const id = json.data && (json.data.id || json.data._id);
  if (id) pm.collectionVariables.set('payoutMethodId', String(id));
} catch (e) {}
`.trim(),
      }),
      req({
        name: 'Add payout method (bank)',
        method: 'POST',
        path: '/api/provider/wallet/payout-methods',
        body: jsonBody({
          kind: 'bank',
          label: 'GCB current',
          accountName: 'Kwame Mensah',
          accountNumber: '1234567890123',
          bankCode: 'GCB',
          bankName: 'GCB Bank',
          isDefault: false,
        }),
      }),
      req({
        name: 'Update payout method',
        method: 'PATCH',
        path: '/api/provider/wallet/payout-methods/{{payoutMethodId}}',
        body: jsonBody({ label: 'Primary MoMo', isDefault: true, active: true }),
      }),
      req({
        name: 'List withdrawals',
        method: 'GET',
        path: '/api/provider/wallet/withdrawals',
        query: { page: '1', limit: '20' },
        tests: `
if (pm.response.code !== 200) { return; }
try {
  const json = pm.response.json();
  const first = Array.isArray(json.data) ? json.data[0] : json.data && json.data.items && json.data.items[0];
  if (first && first.id) pm.collectionVariables.set('withdrawalId', first.id);
} catch (e) {}
`.trim(),
      }),
      req({
        name: 'Request withdrawal',
        method: 'POST',
        path: '/api/provider/wallet/withdrawals',
        body: jsonBody({
          amountGhs: 50,
          payoutMethodId: '{{payoutMethodId}}',
          sourceType: 'deposit_refund',
        }),
        tests: `
if (pm.response.code !== 200 && pm.response.code !== 201) { return; }
try {
  const json = pm.response.json();
  const id = json.data && (json.data.id || json.data._id);
  if (id) pm.collectionVariables.set('withdrawalId', String(id));
} catch (e) {}
`.trim(),
      }),
      req({
        name: 'Cancel my withdrawal',
        method: 'POST',
        path: '/api/provider/wallet/withdrawals/{{withdrawalId}}/cancel',
        body: jsonBody({ reason: 'Requested by mistake' }),
      }),
    ]),

    folder('11. Admin — ops', 'Admin token.', [
      req({ name: 'Dashboard', method: 'GET', path: '/api/admin/dashboard' }),
      req({
        name: 'Verify mechanic',
        method: 'PATCH',
        path: '/api/admin/mechanics/{{mechanicId}}/verification',
        body: jsonBody({ status: 'verified' }),
      }),
      req({ name: 'Admin service catalogue', method: 'GET', path: '/api/admin/service-types' }),
      req({
        name: 'Set catalogue service status',
        method: 'PATCH',
        path: '/api/admin/service-types/{{serviceType}}',
        body: jsonBody({ active: true, reason: 'Seasonal demand' }),
      }),
      req({
        name: 'Provider services (admin)',
        method: 'GET',
        path: '/api/admin/providers/{{mechanicId}}/services',
      }),
    ]),

    folder('12. Admin — finance', 'Admin token. Date filters use ISO timestamps.', [
      req({ name: 'Financial overview', method: 'GET', path: '/api/admin/financial-overview' }),
      req({
        name: 'Finance summary',
        method: 'GET',
        path: '/api/admin/finance/summary',
        query: { from: '2026-10-01T00:00:00.000Z', to: '2026-11-13T23:59:59.000Z' },
      }),
      req({
        name: 'Finance transactions',
        method: 'GET',
        path: '/api/admin/finance/transactions',
        query: {
          from: '2026-10-01T00:00:00.000Z',
          to: '2026-11-13T23:59:59.000Z',
          page: '1',
          limit: '50',
          type: '',
          status: '',
          method: '',
          q: '',
        },
        description:
          'type: customer_payment | provider_deposit | commission | provider_withdrawal | refund | adjustment. status: completed | pending | approved | processing | failed | rejected | cancelled | refunded. method: card | mobile_money | bank | wallet',
      }),
      req({ name: 'Cash reconciliation', method: 'GET', path: '/api/admin/cash-reconciliation' }),
      req({
        name: 'Record cash commitment',
        method: 'POST',
        path: '/api/admin/cash-commitments',
        body: jsonBody({
          amountGhs: 500,
          reason: 'Hold for upcoming provider payouts',
          release: false,
          reference: 'CASH-HOLD-001',
        }),
      }),
      req({ name: 'Financial reports', method: 'GET', path: '/api/admin/financial-reports' }),
      req({
        name: 'Provider financial account',
        method: 'GET',
        path: '/api/admin/providers/{{mechanicId}}/financial-account',
      }),
      req({
        name: 'Adjust provider wallet',
        method: 'POST',
        path: '/api/admin/providers/{{mechanicId}}/adjustments',
        body: jsonBody({
          amountGhs: 10,
          reason: 'Manual correction after support review',
          reference: 'ADJ-001',
        }),
      }),
    ]),

    folder('13. Admin — withdrawals', 'Approve reserves Available; confirm records the external transfer.', [
      req({
        name: 'List withdrawals',
        method: 'GET',
        path: '/api/admin/withdrawals',
        query: { page: '1', limit: '20', status: 'pending', q: '' },
        tests: `
if (pm.response.code !== 200) { return; }
try {
  const json = pm.response.json();
  const first = Array.isArray(json.data) ? json.data[0] : json.data && json.data.items && json.data.items[0];
  if (first && first.id) pm.collectionVariables.set('withdrawalId', first.id);
} catch (e) {}
`.trim(),
      }),
      req({ name: 'Get withdrawal', method: 'GET', path: '/api/admin/withdrawals/{{withdrawalId}}' }),
      req({
        name: 'Approve withdrawal',
        method: 'POST',
        path: '/api/admin/withdrawals/{{withdrawalId}}/approve',
      }),
      req({
        name: 'Reject withdrawal',
        method: 'POST',
        path: '/api/admin/withdrawals/{{withdrawalId}}/reject',
        body: jsonBody({ reason: 'Destination details do not match the provider' }),
      }),
      req({
        name: 'Mark processing',
        method: 'POST',
        path: '/api/admin/withdrawals/{{withdrawalId}}/process',
        body: jsonBody({ payoutMethodUsed: 'MTN MoMo' }),
      }),
      req({
        name: 'Confirm payout sent',
        method: 'POST',
        path: '/api/admin/withdrawals/{{withdrawalId}}/confirm',
        body: jsonBody({
          payoutReference: 'MOMO-REF-001',
          amountPaidGhs: 50,
          payoutDate: '2026-11-13',
          destinationNote: 'Sent to MTN 0244****02',
        }),
      }),
      req({
        name: 'Mark payout failed',
        method: 'POST',
        path: '/api/admin/withdrawals/{{withdrawalId}}/fail',
        body: jsonBody({ reason: 'Mobile money transfer reversed by network' }),
      }),
      req({
        name: 'Cancel withdrawal (admin)',
        method: 'POST',
        path: '/api/admin/withdrawals/{{withdrawalId}}/cancel',
        body: jsonBody({ reason: 'Duplicate request' }),
      }),
      req({
        name: 'Unverified payout methods',
        method: 'GET',
        path: '/api/admin/payout-methods/unverified',
      }),
      req({
        name: 'Verify payout method',
        method: 'POST',
        path: '/api/admin/payout-methods/{{payoutMethodId}}/verify',
      }),
    ]),

    folder('14. Admin — settlements', 'Records bank credits against Paystack inflows. No internal company wallet required.', [
      req({
        name: 'Awaiting bank confirmation',
        method: 'GET',
        path: '/api/admin/settlements/awaiting',
        query: { from: '2026-10-01T00:00:00.000Z', to: '2026-11-13T23:59:59.000Z', q: '' },
      }),
      req({
        name: 'List settlement batches',
        method: 'GET',
        path: '/api/admin/settlements',
        query: { page: '1', limit: '20', status: '' },
        tests: `
if (pm.response.code !== 200) { return; }
try {
  const json = pm.response.json();
  const first = Array.isArray(json.data) ? json.data[0] : json.data && json.data.items && json.data.items[0];
  if (first && first.id) pm.collectionVariables.set('settlementId', first.id);
} catch (e) {}
`.trim(),
      }),
      req({ name: 'Get settlement', method: 'GET', path: '/api/admin/settlements/{{settlementId}}' }),
      req({
        name: 'Create settlement draft',
        method: 'POST',
        path: '/api/admin/settlements',
        body: jsonBody({
          settlementReference: 'PAYSTACK-SETTLE-001',
          amountReceivedGhs: 1500,
          paystackFeesGhs: 28.5,
          settlementDate: '2026-11-13',
          bankReference: 'GCB-TXN-001',
          paystackReference: 'PSK-SETTLE-001',
          notes: 'Matched against Paystack dashboard',
          confirm: false,
        }),
        tests: `
if (pm.response.code !== 200 && pm.response.code !== 201) { return; }
try {
  const json = pm.response.json();
  const id = json.data && (json.data.id || json.data._id);
  if (id) pm.collectionVariables.set('settlementId', String(id));
} catch (e) {}
`.trim(),
      }),
      req({
        name: 'Confirm settlement',
        method: 'POST',
        path: '/api/admin/settlements/{{settlementId}}/confirm',
      }),
      req({
        name: 'Resolve settlement discrepancy',
        method: 'POST',
        path: '/api/admin/settlements/{{settlementId}}/resolve',
        body: jsonBody({
          amountReceivedGhs: 1480,
          paystackFeesGhs: 28.5,
          bankReference: 'GCB-TXN-001-ADJ',
          acceptDifference: true,
          note: 'Bank credited net of extra fee',
        }),
      }),
    ]),
  ];
}

function buildCollection({ name, description, defaults }) {
  return {
    info: {
      _postman_id: uid(),
      name,
      description,
      schema: SCHEMA,
    },
    auth: {
      type: 'bearer',
      bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }],
    },
    variable: collectionVariables(defaults),
    item: buildItems(),
  };
}

function buildEnvironment({ name, values }) {
  return {
    id: uid(),
    name,
    values: [
      ...Object.entries(values).map(([key, value]) => ({
        key,
        value,
        type: key.toLowerCase().includes('password') ? 'secret' : 'default',
        enabled: true,
      })),
      { key: 'accessToken', value: '', type: 'secret', enabled: true },
      { key: 'refreshToken', value: '', type: 'secret', enabled: true },
    ],
    _postman_variable_scope: 'environment',
  };
}

function writeJson(filename, data) {
  const path = join(here, filename);
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
  return path;
}

mkdirSync(here, { recursive: true });

const localCollection = buildCollection({
  name: 'Road Rescue API — Local',
  description: [
    'Hit the local Express API (default http://localhost:4002 — match backend PORT).',
    '',
    '1. Import this collection (and optionally the Local environment).',
    '2. Run **2. Auth → Login customer / mechanic / admin**. Tokens are saved automatically.',
    '3. Use **0. Session helpers** to switch the active Bearer token.',
    '4. Fill IDs (`requestId`, `vehicleId`, …) from list/create responses, or let the test scripts capture them.',
    '',
    'Collection auth is Bearer {{accessToken}}. Public routes override this with no auth.',
    'Demo seed accounts: ama.serwaa@example.com / kwame.mensah@example.com / admin@roadrescue.gh.',
  ].join('\n'),
  defaults: ENVIRONMENTS.local.values,
});

const prodCollection = buildCollection({
  name: 'Road Rescue API — Production',
  description: [
    'Hit the production API at https://api.roadrescue4u.com.',
    '',
    'Replace credential collection variables before running. Do not use local seed passwords on production.',
    'Prefer read-only requests first. Mutating finance/payout routes affect live wallets.',
    '',
    '1. Import this collection (and optionally the Production environment).',
    '2. Set customerEmail / mechanicEmail / adminEmail to real production accounts.',
    '3. Run **2. Auth → Login …** then **0. Session helpers** to switch roles.',
  ].join('\n'),
  defaults: ENVIRONMENTS.prod.values,
});

writeJson('Road-Rescue-API.local.postman_collection.json', localCollection);
writeJson('Road-Rescue-API.prod.postman_collection.json', prodCollection);
writeJson(
  'Road-Rescue-API.local.postman_environment.json',
  buildEnvironment(ENVIRONMENTS.local),
);
writeJson(
  'Road-Rescue-API.prod.postman_environment.json',
  buildEnvironment(ENVIRONMENTS.prod),
);

function countRequests(items) {
  return items.reduce((n, item) => n + (item.item ? countRequests(item.item) : 1), 0);
}

console.log(`Wrote collections (${countRequests(localCollection.item)} requests each) to ${here}`);
