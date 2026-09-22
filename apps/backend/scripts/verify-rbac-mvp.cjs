const apiUrl = process.env.API_URL || 'http://localhost:3000';
const password = process.env.MVP_STUDENT_PASSWORD || 'ProtecEdu!2026';

const scenarios = [
  ['D026100001', { users: 200, roles: 200, permissions: 200, audit: 200 }],
  ['D026100002', { users: 200, roles: 200, permissions: 200, audit: 200 }],
  ['D026100003', { users: 200, roles: 403, permissions: 403, audit: 403 }],
  ['D026100004', { users: 403, roles: 403, permissions: 403, audit: 403 }],
  ['D026100005', { users: 403, roles: 403, permissions: 403, audit: 403 }],
];
const writeDeniedScenarios = [
  'D026100002',
  'D026100003',
  'D026100004',
  'D026100005',
];

async function sessionFor(studentCode) {
  const response = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      institutionCode: 'DEMO-EDU',
      studentCode,
      password,
    }),
  });
  if (!response.ok) {
    throw new Error(`Login failed for ${studentCode}: ${response.status}`);
  }
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  if (!cookie)
    throw new Error(`No session cookie was returned for ${studentCode}.`);
  return cookie;
}

async function main() {
  for (const [studentCode, expectedStatuses] of scenarios) {
    const cookie = await sessionFor(studentCode);
    for (const [endpoint, expectedStatus] of Object.entries(expectedStatuses)) {
      const response = await fetch(`${apiUrl}/admin/${endpoint}`, {
        headers: { cookie },
      });
      if (response.status !== expectedStatus) {
        throw new Error(
          `${studentCode} ${endpoint}: expected ${expectedStatus}, received ${response.status}.`,
        );
      }
      console.log(`${studentCode} ${endpoint}: ${response.status}`);
    }
    if (writeDeniedScenarios.includes(studentCode)) {
      const response = await fetch(`${apiUrl}/admin/permissions`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ resource: 'verification', action: 'create' }),
      });
      if (response.status !== 403) {
        throw new Error(
          `${studentCode} permissions.create: expected 403, received ${response.status}.`,
        );
      }
      console.log(`${studentCode} permissions.create: 403`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
