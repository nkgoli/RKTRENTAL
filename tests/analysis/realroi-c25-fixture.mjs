// C25 paired capture with a deterministic FIXTURE. The unmodified RealROI
// SearchPanel runs with placeholder (non-secret) key strings; every Google Maps
// and RentCast request is answered here, so no external API is called. The
// comps are RocketRental's sandbox comps for Maple Court unit 3A.
// Reference: start vite with VITE_GOOGLE_MAPS_API_KEY / VITE_RENTCAST_API_KEY set
// to any placeholder (docs/analysis/realroi-chart-parity.md §12).
// node tests/analysis/realroi-c25-fixture.mjs <refUrl> <isolatedAppUrl> <outDir>
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [ref, app, outDir] = process.argv.slice(2);
if (!ref || !app || !outDir) throw Error('usage: <refUrl> <isolatedAppUrl> <outDir>');
if (/:3100\b/.test(app)) throw Error('Use an isolated app, not the live 3100.');
mkdirSync(outDir, { recursive: true });

export const fixture = {
  label: 'FIXTURE - RocketRental sandbox comps, Maple Court unit 3A (not market data)',
  subject: { address: '214 Maple Ave', city: 'Austin', state: 'TX', zip: '78704', rent: 1600 },
  range: [1805, 1980],
  comps: [
    ['210 Oltorf St', 1700],
    ['222 Lamar Blvd', 1800],
    ['234 Barton Hills Dr', 1850],
    ['246 Congress Ave', 1825],
    ['258 Riverside Dr', 2025],
    ['270 Cesar Chavez St', 2025],
  ],
};
const { subject: s } = fixture;
const formatted = `${s.address}, ${s.city}, ${s.state} ${s.zip}`;
// The map beside the chart is inert: a blank box with no tiles (not part of C25).
const googleStub = `const inert = class { constructor() {} setMap() {} addListener() {} open() {} close() {}
  setContent() {} setCenter() {} fitBounds() {} extend() {} setOptions() {} setPosition() {} };
window.google = { maps: { Map: inert, Marker: inert, InfoWindow: inert, LatLngBounds: inert,
  LatLng: inert, SymbolPath: { CIRCLE: 0 }, event: { clearInstanceListeners() {} }, places: {
  PlacesServiceStatus: { OK: 'OK', ZERO_RESULTS: 'ZERO_RESULTS', REQUEST_DENIED: 'REQUEST_DENIED' },
  AutocompleteService: class { getPlacePredictions(_r, cb) { cb([{ place_id: 'fixture-3a',
    description: ${JSON.stringify(formatted)},
    structured_formatting: { main_text: ${JSON.stringify(s.address)}, secondary_text: 'Austin, TX (fixture)' } }], 'OK'); } },
  PlacesService: class { getDetails(_r, cb) { cb({ formatted_address: ${JSON.stringify(formatted)},
    address_components: [
      { long_name: '214', short_name: '214', types: ['street_number'] },
      { long_name: 'Maple Ave', short_name: 'Maple Ave', types: ['route'] },
      { long_name: 'Austin', short_name: 'Austin', types: ['locality'] },
      { long_name: 'Texas', short_name: 'TX', types: ['administrative_area_level_1'] },
      { long_name: '78704', short_name: '78704', types: ['postal_code'] }],
    geometry: { location: { lat: () => 30.25, lng: () => -97.76 } } }, 'OK'); } } } } };`;
const property = {
  id: 'fixture-3a',
  formattedAddress: formatted,
  addressLine1: s.address,
  city: s.city,
  state: s.state,
  zipCode: s.zip,
  bedrooms: 1,
  bathrooms: 1,
  squareFootage: 850,
  propertyType: 'Apartment',
  latitude: 30.25,
  longitude: -97.76,
};
const rentcast = (url) =>
  url.includes('/v1/properties')
    ? [property]
    : url.includes('/avm/rent')
      ? { rent: s.rent, rentRangeLow: fixture.range[0], rentRangeHigh: fixture.range[1] }
      : url.includes('/avm/value')
        ? { price: 0, priceRangeLow: 0, priceRangeHigh: 0 }
        : fixture.comps.map(([a, rent], i) => ({
            id: `fixture-comp-${i}`,
            formattedAddress: `${a}, Austin, TX 78704`,
            addressLine1: a,
            bedrooms: 1,
            bathrooms: 1,
            squareFootage: 850,
            rent,
            distance: 0.3 * (i + 1),
            daysOld: 4 + 9 * i,
          }));

const browser = await chromium.launch();
const log = { fixture, at: new Date().toISOString(), external: [], intercepted: [] };
async function card(page, title) {
  return page
    .locator(
      `xpath=//h3[normalize-space()="${title}"]/ancestor::div[contains(@class,"rounded-xl") or contains(@class,"card")][1]`,
    )
    .first();
}

// 1. Reference component fed by the fixture.
const rp = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await rp.route('**/*', (route) => {
  const url = route.request().url();
  const host = new URL(url).hostname;
  if (host === 'maps.googleapis.com') {
    log.intercepted.push(url.replace(/key=[^&]+/, 'key=<placeholder>'));
    return route.fulfill({ contentType: 'text/javascript', body: googleStub });
  }
  if (host === 'api.rentcast.io') {
    log.intercepted.push(url);
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(rentcast(url)) });
  }
  if (!['127.0.0.1', 'localhost', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(host)) {
    log.external.push(url);
    return route.abort();
  }
  return route.continue();
});
await rp.goto(`${ref}/demo`);
const input = rp.getByPlaceholder('Enter property address...');
await input.waitFor();
await rp.waitForFunction(
  () => !document.querySelector('input[placeholder="Enter property address..."]')?.disabled,
);
await input.fill('214 Maple');
await rp.getByText('Austin, TX (fixture)').click();
await rp.getByRole('button', { name: /Search RentCast/ }).click();
await rp
  .getByText('Rental Distribution')
  .first()
  .waitFor({ timeout: 20000 })
  .catch(async (e) => {
    await rp.screenshot({ path: path.join(outDir, 'ref-fixture-failure.png'), fullPage: true });
    writeFileSync(path.join(outDir, 'c25-fixture-run.json'), JSON.stringify(log, null, 2));
    throw e;
  });
await rp.waitForTimeout(1800); // Recharts mount animation
const refCard = await card(rp, 'Rental Distribution');
const refBox = await refCard.boundingBox();
log.referenceSubtitle = await refCard.locator('p').first().innerText();
log.referenceTiles = await refCard.locator('.grid').first().innerText();
await refCard.screenshot({
  path: path.join(outDir, 'ref-fixture-search-rental-distribution-1440.png'),
});

// 2. RocketRental's C25 for the same comps, at the reference card's width.
const pp = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await pp.goto(`${app}/sign-in`);
await pp.locator('input[name="email"]').fill('jordan.mills@rocketrental.example');
await pp.locator('input[name="password"]').fill('JordanDemo#2026');
await Promise.all([
  pp.waitForURL((u) => !u.pathname.startsWith('/sign-in')),
  pp.keyboard.press('Enter'),
]);
await pp.goto(`${app}/properties/seed-property-maple/listing?unit=seed-unit-maple-7`);
const heading = pp.getByText('Rental Distribution', { exact: true }).first();
await heading.waitFor();
const rr = heading.locator('xpath=ancestor::section[1]');
await rr.evaluate((el, w) => {
  el.style.width = `${w}px`;
  el.style.maxWidth = 'none';
}, Math.round(refBox.width));
await pp.waitForTimeout(600);
log.rocketRentalText = (await rr.innerText()).split('\n').slice(0, 9);
log.widths = {
  reference: Math.round(refBox.width),
  rocketRental: Math.round((await rr.boundingBox()).width),
};
await rr.screenshot({
  path: path.join(outDir, 'rr-fixture-rent-comps-rental-distribution-1440.png'),
});
writeFileSync(path.join(outDir, 'c25-fixture-run.json'), JSON.stringify(log, null, 2));
console.log(
  JSON.stringify({
    widths: log.widths,
    intercepted: log.intercepted.length,
    external: log.external,
    subtitle: log.referenceSubtitle,
  }),
);
await browser.close();
