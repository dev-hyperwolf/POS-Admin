/* D14 — the driver app now knows which van a stop belongs to.
 *
 * D4, the owner's model: address → WM listing → region → routing picks the
 * driver, one driver per region. Routing already knows this; it just was not
 * written down anywhere the app could read, so the governed swap refused every
 * stop. D14: seed it, label it, keep it in ONE place.
 *
 * The property under test is INDEPENDENCE. checkActor compares the ORDER's van
 * against the ACTOR's van; derive both from the logged-in driver and it compares
 * a value to itself, can never fail, and the guarantee is decorative while
 * looking present. That defect has already been built once in this repo.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

test('every stop names a van, and one is deliberately on ANOTHER van', async () => {
  await withApp('driver', async (app) => {
    const MD = app.window.MD;
    // ⚠️ Compare STRINGS, not arrays. MD.TASKS lives in the jsdom realm, so
    // .map() returns an Array whose prototype is not Node's, and
    // assert/strict's deepEqual fails on the prototype even when both are [].
    const missing = MD.TASKS.filter((t) => !t.kitId).map((t) => t.id).join(',');
    assert.equal(missing, '', `stops with no van (they refuse every swap): ${missing}`);

    const off = MD.TASKS.filter((t) => t.kitId !== MD.DRIVER.regionId);
    assert.ok(off.length > 0,
      'if every stop is on the driver own van, wrong_kit is never exercised by real data '
      + 'and the guarantee is untested exactly where it matters');
  });
});

test('the driver profile carries a region ID, not just a place name', async () => {
  await withApp('driver', async (app) => {
    const MD = app.window.MD, G = app.window.HWGovern;
    assert.ok(G, 'the governance bridge did not load');
    assert.equal(MD.DRIVER.regionId, 'RC-01');
    assert.equal(G.actorKitId(MD.DRIVER), 'RC-01', 'the profile id must win');
    // 'Lake Elsinore' is a place; it is not one of the nine ids and never was.
    assert.equal(G.driverToRegion(MD.DRIVER.region), null,
      'the place name must not resolve — that confusion is what blocked this for two days');
  });
});

test('a driver covering a van they are not the regular assignee of still resolves', async () => {
  await withApp('driver', async (app) => {
    const MD = app.window.MD, G = app.window.HWGovern, DD = app.window.DDATA;
    const regular = DD.REGION_STOCK[MD.DRIVER.regionId].driver;
    assert.notEqual(regular, MD.DRIVER.name,
      'precondition: the register names someone else as RC-01 usual driver');
    assert.equal(G.actorKitId(MD.DRIVER), MD.DRIVER.regionId,
      'covering a van is ordinary; name-matching alone would return null');
  });
});

test('THE GUARANTEE — own van allowed, another van refused', async () => {
  await withApp('driver', async (app) => {
    const MD = app.window.MD, G = app.window.HWGovern, E = G.engine;
    const actor = { kind: 'driver', id: MD.DRIVER.id, name: MD.DRIVER.name, kitId: G.actorKitId(MD.DRIVER) };
    const check = (task) => E.checkActor(
      { id: task.order, status: 'en_route', assignedKitId: task.kitId },
      actor, E.defaultFulfillmentPolicy);

    const own = MD.TASKS.find((t) => t.kitId === MD.DRIVER.regionId);
    const away = MD.TASKS.find((t) => t.kitId !== MD.DRIVER.regionId);
    assert.ok(own && away, 'need one of each for this to prove anything');

    assert.equal(check(own), null, 'a driver must be able to work their own stops');
    assert.equal(check(away)?.code, 'wrong_kit', 'and must not touch another van');
  });
});

test('the order van is INDEPENDENT of who is logged in', async () => {
  await withApp('driver', async (app) => {
    const MD = app.window.MD;
    const before = MD.TASKS.map((t) => t.id + ':' + t.kitId).join('|');
    MD.DRIVER.regionId = 'OC-02';          // a different person picks up the phone
    const after = MD.TASKS.map((t) => t.id + ':' + t.kitId).join('|');
    assert.equal(after, before,
      'if the stops moved, the order van is derived from the session — the tautology');
  });
});
