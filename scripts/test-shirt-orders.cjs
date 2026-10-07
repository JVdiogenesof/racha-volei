/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

function load(path, mocks = {}) {
  const source = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", source)(
    (name) => Object.hasOwn(mocks, name) ? mocks[name] : require(name), loadedModule, loadedModule.exports,
  );
  return loadedModule.exports;
}
const shirts = load("src/lib/shirts.ts");
const item = (profile, community, paid = false, half_paid = false) => ({ profile_id: profile, community, paid, half_paid });
const groups = shirts.groupShirtOrders([
  item("a", "court"), item("a", "court"),
  item("a", "sand", false, true), item("b", "court", true), item("b", "court"),
]);
assert.equal(groups.length, 3, "same person in different communities must stay separate");
assert.equal(groups[0].items.length, 2, "two models must share one person card");
assert.equal(groups[0].payment, "pending");
assert.equal(groups[1].payment, "half");
assert.equal(groups[2].payment, "mixed", "legacy mixed payments must not become 50% or paid");
assert.equal(shirts.groupShirtOrders([item("a", "sand", true), item("a", "sand", true)])[0].payment, "paid");
assert.equal(shirts.SHIRT_FITS.unspecified, "Não informada");
const groupedProgress = shirts.groupShirtOrders([
  { ...item("a", "court", true), fulfillment_status: "delivered" },
  { ...item("a", "court", true), fulfillment_status: "ordered" },
  { ...item("b", "court", false, true), fulfillment_status: "awaiting_payment" },
]);
assert.equal(shirts.shirtGroupMatchesView(groupedProgress[0], "paid"), true);
assert.equal(shirts.shirtGroupMatchesView(groupedProgress[0], "delivered"), true, "partially delivered people must appear in delivery list");
assert.equal(shirts.shirtGroupMatchesView(groupedProgress[0], "ordered"), true, "partially ordered people must appear in production list");
assert.equal(shirts.shirtGroupMatchesView(groupedProgress[1], "partial"), true);
assert.equal(shirts.shirtGroupMatchesView(groupedProgress[1], "pending"), false);

async function main() {
  const calls = [];
  let result = { data: [{ id: "one" }, { id: "two" }], error: null };
  const query = {};
  for (const method of ["from", "update", "delete", "eq", "in", "select", "maybeSingle"]) {
    query[method] = (...args) => { calls.push([method, ...args]); return query; };
  }
  query.then = (resolve) => resolve(result);
  const actions = load("src/app/(app)/admin/camisas/actions.ts", {
    "@/lib/shirts": shirts,
    "next/cache": { revalidatePath() {} },
    "@/lib/auth": { requireOrganizer: async () => ({ id: "organizer" }) },
    "@/lib/community": { getActiveCommunity: async () => "sand" },
    "@/lib/supabase/server": { createClient: async () => ({ from: query.from }) },
  });
  for (const payment of ["pending", "half", "paid"]) {
    calls.length = 0;
    const form = new FormData();
    form.set("profileId", "a"); form.set("payment", payment);
    form.append("orderId", "one"); form.append("orderId", "two");
    await actions.setShirtOrderPaid(form);
    const values = calls.find((c) => c[0] === "update")[1];
    assert.equal(values.paid, payment === "paid");
    assert.equal(values.half_paid, payment === "half");
    assert.equal(values.marked_by, payment === "pending" ? null : "organizer");
    assert.equal(values.paid_at === null, payment === "pending");
    assert.ok(calls.some((c) => c[0] === "eq" && c[1] === "community" && c[2] === "sand"));
    assert.ok(calls.some((c) => c[0] === "eq" && c[1] === "profile_id" && c[2] === "a"));
    assert.deepEqual(calls.find((c) => c[0] === "in"), ["in", "id", ["one", "two"]]);
  }
  await assert.rejects(actions.setShirtOrderPaid(new FormData()), /inválido/);
  result = { data: { id: "one" }, error: null };
  calls.length = 0;
  const deleteForm = new FormData();
  deleteForm.set("orderId", "one");
  await actions.deleteShirtOrder(deleteForm);
  assert.ok(calls.some((c) => c[0] === "delete"));
  assert.ok(calls.some((c) => c[0] === "eq" && c[1] === "id" && c[2] === "one"));
  assert.ok(calls.some((c) => c[0] === "eq" && c[1] === "community" && c[2] === "sand"));

  result = { data: [], error: null };
  const form = new FormData();
  form.set("profileId", "a"); form.set("payment", "half"); form.set("orderId", "missing");
  await assert.rejects(actions.setShirtOrderPaid(form), /não encontrado/);


  result = { data: { id: "one" }, error: null };
  const statusForm = new FormData();
  statusForm.set("orderId", "one");
  for (const status of ["awaiting_payment", "ordered", "delivered"]) {
    calls.length = 0;
    statusForm.set("status", status);
    await actions.setShirtOrderStatus(statusForm);
    const values = calls.find((c) => c[0] === "update")[1];
    assert.deepEqual(Object.keys(values).sort(), ["fulfillment_status", "updated_at"]);
    assert.equal(values.fulfillment_status, status);
    assert.ok(calls.some((c) => c[0] === "eq" && c[1] === "community" && c[2] === "sand"));
    assert.ok(calls.some((c) => c[0] === "eq" && c[1] === "id" && c[2] === "one"));
  }
  statusForm.set("status", "toString");
  await assert.rejects(actions.setShirtOrderStatus(statusForm), /inválido/);
  statusForm.set("status", "ordered");
  result = { data: null, error: null };
  await assert.rejects(actions.setShirtOrderStatus(statusForm), /não encontrado/);
  result = { data: null, error: { message: "Falha de conexão" } };
  await assert.rejects(actions.setShirtOrderStatus(statusForm), /Falha de conexão/);
  assert.equal(shirts.shirtOrderStatusLabel({ fulfillment_status: "awaiting_payment", paid: false, half_paid: false }), "Aguardando pagamento");
  assert.equal(shirts.shirtOrderStatusLabel({ fulfillment_status: "awaiting_payment", paid: false, half_paid: true }), "Aguardando pedido à loja");
  assert.equal(shirts.shirtOrderStatusLabel({ fulfillment_status: "delivered", paid: false, half_paid: true }), "Pedido entregue");

  const profileCalls = [];
  const profileQuery = {};
  for (const method of ["from", "update", "eq", "select", "maybeSingle"]) {
    profileQuery[method] = (...args) => { profileCalls.push([method, ...args]); return profileQuery; };
  }
  profileQuery.then = (resolve) => resolve({ data: { id: "player" }, error: null });
  const playerActions = load("src/app/(app)/admin/jogadores/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "@/lib/auth": { requireOrganizer: async () => ({ id: "organizer" }) },
    "@/lib/scoring": { SKILL_CATEGORIES: [] },
    "@/lib/ratings": { RATING_WEIGHTS_ID: "weights" },
    "@/lib/supabase/server": { createClient: async () => ({ from: profileQuery.from }) },
  });
  const expectedCommunities = { court: ["court"], sand: ["sand"], both: ["court", "sand"] };
  const profileForm = new FormData();
  profileForm.set("profileId", "player");
  profileForm.set("fullName", "Pessoa Teste");
  for (const [choice, expected] of Object.entries(expectedCommunities)) {
    profileCalls.length = 0;
    profileForm.set("playCommunity", choice);
    await playerActions.updatePlayerProfile(profileForm);
    const profileValues = profileCalls.find((c) => c[0] === "update")[1];
    assert.deepEqual(profileValues.communities, expected);
    assert.ok(profileCalls.some((c) => c[0] === "eq" && c[1] === "status" && c[2] === "approved"));
  }
  profileForm.set("playCommunity", "invalid");
  await assert.rejects(playerActions.updatePlayerProfile(profileForm), /Escolha Quadra/);

  console.log("PASS: shirt grouping, payments and deletion; organizer community editing and validation.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
