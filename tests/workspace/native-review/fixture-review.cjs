// Operates only on the explicitly fixed task-local review database.
const { PrismaClient } = require('@prisma/client');
const fs = require('node:fs');
const path = require('node:path');
const runtime = path.join(__dirname, '.runtime');
const identityPath = path.join(runtime, 'synthetic-identity.json');
const db = new PrismaClient({ datasourceUrl: 'postgresql://rocketrental:rocketrental@127.0.0.1:55441/rocketrental?schema=public' });
async function main() {
  if (process.argv[2] === 'prepare') {
    if (fs.existsSync(identityPath)) throw new Error('Synthetic identity already exists; inspect instead of replacing');
    const stamp = Date.now().toString(36);
    const identity = { propertyId: `synth-ov-prop-${stamp}`, unitId: `synth-ov-unit-${stamp}`, createdUtc: new Date().toISOString() };
    await db.property.create({ data: { id: identity.propertyId, organizationId: 'seed-rocket-rental', name: `Overview Synthetic ${stamp}`, type: 'MULTI_UNIT', street: '7 Synthetic Way', city: 'Austin', state: 'TX', postalCode: '78704', units: { create: { id: identity.unitId, number: 'S1', status: 'VACANT', listedRent: 1500 } } } });
    fs.writeFileSync(identityPath, JSON.stringify(identity, null, 2));
    const dir = path.join(runtime, 'synth'); fs.mkdirSync(dir, { recursive: true });
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a15kAAAAASUVORK5CYII=', 'base64');
    for (const name of ['synth-a.png', 'synth-b.png', 'synth-c.png']) fs.writeFileSync(path.join(dir, name), png);
    fs.writeFileSync(path.join(dir, 'synth-note.txt'), 'Disposable local overview review document.\n');
  }
  const identity = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
  console.log(JSON.stringify({ ...identity, property: await db.property.findUnique({ where: { id: identity.propertyId }, include: { units: true } }), documents: await db.document.findMany({ where: { OR: [{ propertyId: identity.propertyId }, { unitId: identity.unitId }] } }) }, (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.$disconnect());
