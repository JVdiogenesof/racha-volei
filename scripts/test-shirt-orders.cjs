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

async function main() {
  const calls = [];
  let result = { data: [{ id: "one" }, { id: "two" }], error: null };
  const query = {};
  for (const method of ["from", "update", "eq", "in", "select"]) {
    query[method] = (...args) => { calls.push([method, ...args]); return query; };
  }
  query.then = (resolve) => resolve(result);
  const actions = load("src/app/(app)/admin/camisas/actions.ts", {
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
  result = { data: [], error: null };
  const form = new FormData();
  form.set("profileId", "a"); form.set("payment", "half"); form.set("orderId", "missing");
  await assert.rejects(actions.setShirtOrderPaid(form), /não encontrado/);
  console.log("PASS: grouping, community isolation, mixed legacy payments, all payment transitions and missing orders.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
