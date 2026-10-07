/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const React = require("react");
const { ImageResponse } = require("next/og");
const sharp = require("sharp");

function load(path, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", code)(
    (key) => Object.hasOwn(mocks, key) ? mocks[key] : require(key), mod, mod.exports,
  );
  return mod.exports;
}
const shirts = load("src/lib/shirts.ts");
const fixtures = ["court", "sand"].flatMap((community) =>
  ["tank", "sleeve"].flatMap((model) =>
    ["pending", "half", "paid"].map((payment, i) => ({
      id: community + model + payment, profile_id: "person-" + i, community, model,
      paid: payment === "paid", half_paid: payment === "half", fit: "female",
      shirt_name: "TESTE", shirt_number: 5, size: "M", quantity: 2,
      fulfillment_status: "ordered", profiles: { full_name: "Pessoa de Teste " + i },
    }))));
for (const model of ["tank", "sleeve"]) {
  for (const [filter, count] of [["all", 3], ["received", 2], ["half", 1], ["paid", 1]]) {
    const selected = shirts.selectShirtExportOrders(fixtures.filter((o) => o.community === "sand"), model, filter);
    assert.equal(selected.length, count);
    assert.ok(selected.every((o) => o.model === model && o.community === "sand"));
  }
}

let community = "court", loggedIn = true, organizer = true, captured, predicates, queryCalls;
const client = {
  auth: { getUser: async () => ({ data: { user: loggedIn ? { id: "admin" } : null } }) },
  from(table) {
    if (table === "profiles") {
      const profileQuery = {
        select: () => profileQuery, eq: () => profileQuery,
        maybeSingle: async () => ({ data: { is_organizer: organizer, communities: ["court", "sand"] } }),
      };
      return profileQuery;
    }
    assert.equal(table, "shirt_orders");
    predicates = []; queryCalls = [];
    const query = {
      select: () => query, order: () => query,
      eq: (key, value) => { queryCalls.push([key, value]); predicates.push((o) => o[key] === value); return query; },
      or: (value) => { assert.equal(value, "paid.eq.true,half_paid.eq.true"); predicates.push((o) => o.paid || o.half_paid); return query; },
      then: (resolve) => resolve({ data: fixtures.filter((o) => predicates.every((p) => p(o))), error: null }),
    };
    return query;
  },
};
const route = load("src/app/(app)/admin/camisas/imagem/route.tsx", {
  "next/og": { ImageResponse: class { constructor(element, options) { captured = { element, options }; return new Response("image"); } } },
  "@/lib/shirts": shirts,
  "@/lib/supabase/server": { createClient: async () => client },
  "@/lib/community": { getActiveCommunity: async () => community, COMMUNITY_INFO: { court: { shortLabel: "Quadra" }, sand: { shortLabel: "Areia" } } },
  "@/lib/brand": { VPA_INSTAGRAM_HANDLE: "@rachavoleiporamor" },
});
const request = (query) => new Request("https://example.test/admin/camisas/imagem?" + query);

function localImages(node) {
  if (!React.isValidElement(node)) return node;
  const props = { ...node.props };
  if (node.type === "img") {
    const path = new URL(props.src).pathname;
    assert.ok(path === "/logo.png" || /^\/camisas\/(regata|manga)-(areia-vpa|vpa-v2)-export\.jpg$/.test(path));
    props.src = "data:image/" + (path.endsWith(".png") ? "png" : "jpeg") + ";base64," + fs.readFileSync("public" + path).toString("base64");
  }
  if (props.children) props.children = React.Children.map(props.children, localImages);
  return React.createElement(node.type, props);
}

async function main() {
  loggedIn = false;
  assert.equal((await route.GET(request("model=tank"))).status, 401);
  loggedIn = true; organizer = false;
  assert.equal((await route.GET(request("model=tank"))).status, 403);
  organizer = true;
  for (const query of ["", "model=all", "model=toString", "model=tank&filter=invalid"]) {
    assert.equal((await route.GET(request(query))).status, 400);
  }
  fs.mkdirSync(".next/shirt-export-tests", { recursive: true });
  for (community of ["court", "sand"]) {
    for (const model of ["tank", "sleeve"]) {
      for (const filter of ["all", "received", "half", "paid"]) {
        await route.GET(request(new URLSearchParams({ model, filter })));
        assert.ok(queryCalls.some(([key, value]) => key === "community" && value === community));
        assert.ok(queryCalls.some(([key, value]) => key === "model" && value === model));
        const tree = JSON.stringify(captured.element);
        assert.ok(tree.includes(model === "tank" ? "REGATAS" : "COM MANGA"));
        assert.ok(!tree.includes("colecao-"), "hero must show only the exported model");
        assert.ok(captured.options.headers["Content-Disposition"].includes(model === "tank" ? "regatas" : "com-manga"));
      }
      // Render the actual production JSX with local assets, without authentication or network side effects.
      const image = new ImageResponse(localImages(captured.element), captured.options);
      const buffer = Buffer.from(await image.arrayBuffer());
      assert.ok(buffer.length > 10000);
      const meta = await sharp(buffer).metadata();
      assert.equal(meta.width, 1080);
      await sharp(buffer).resize({ width: 540 }).toFile(".next/shirt-export-tests/" + community + "-" + model + ".png");
    }
  }
  // A large export includes every item, rather than silently dropping rows after the first 14.
  fixtures.push(...Array.from({ length: 30 }, (_, i) => ({
    ...fixtures.find((o) => o.community === "sand" && o.model === "tank"),
    id: "extra-" + i, profile_id: "extra-" + i, profiles: { full_name: "Pedido Extra " + i },
  })));
  community = "sand";
  await route.GET(request("model=tank&filter=all"));
  assert.ok(JSON.stringify(captured.element).includes("Pedido Extra 29"));
  assert.ok(captured.options.height > 1920);
  const large = Buffer.from(await new ImageResponse(localImages(captured.element), captured.options).arrayBuffer());
  assert.ok(large.length > 10000);
  console.log("PASS: separated models, payments, communities, access restrictions, invalid parameters, complete list and 5 real PNG renders.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
