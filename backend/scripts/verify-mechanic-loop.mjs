/**
 * Local smoke test: customer creates request → mechanic accept → status machine → complete.
 * Usage: node scripts/verify-mechanic-loop.mjs
 */
const API = process.env.API_URL ?? 'http://localhost:4002/api';

async function json(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || body.error || `${res.status} ${res.statusText}`);
  }
  return body.data ?? body;
}

async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await json(res);
  return data.accessToken;
}

async function main() {
  const customerToken = await login('ama.serwaa@example.com', 'Password123!');
  const mechanicToken = await login('kwame.mensah@example.com', 'Password123!');

  const vehicles = await json(
    await fetch(`${API}/vehicles`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    }),
  );
  const vehicleId = vehicles[0]?._id;
  if (!vehicleId) throw new Error('No customer vehicle found — run seed first');

  await json(
    await fetch(`${API}/mechanics/me/availability`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${mechanicToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ availability: true }),
    }),
  );

  const created = await json(
    await fetch(`${API}/requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vehicleId,
        serviceType: 'battery',
        pickupAddress: 'Spintex Road',
        pickupCity: 'Accra',
        latitude: 5.637,
        longitude: -0.12,
        description: 'Verify mechanic loop',
      }),
    }),
  );
  console.log('created', created.status, created._id);

  const accepted = await json(
    await fetch(`${API}/requests/${created._id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mechanicToken}` },
    }),
  );
  console.log('accepted', accepted.status, 'mechanic?', Boolean(accepted.mechanic));

  for (const status of ['enroute', 'arrived', 'inprogress', 'completed']) {
    const updated = await json(
      await fetch(`${API}/requests/${created._id}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${mechanicToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      }),
    );
    console.log('→', updated.status);
  }

  const bad = await fetch(`${API}/requests/${created._id}/status`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${mechanicToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'enroute' }),
  });
  const badBody = await bad.json().catch(() => ({}));
  console.log('invalid transition', bad.status, badBody.message || badBody.error || 'ok');

  if (bad.ok) throw new Error('Expected invalid transition to fail');
  console.log('verify-mechanic-loop: OK');
}

main().catch((err) => {
  console.error('verify-mechanic-loop: FAIL', err.message);
  process.exit(1);
});
