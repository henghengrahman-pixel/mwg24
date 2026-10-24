const assert = require("assert");
const { initDb, getDb, hashPassword, verifyPassword } = require("../lib/db");
const path = require("path");
const fs = require("fs");

console.log("=== MWG24 V4 Smoke Tests ===");

const testDb = path.join(__dirname, "v4-test.db");
if (fs.existsSync(testDb)) fs.unlinkSync(testDb);

try {
  initDb(testDb);
  const db = getDb();
  assert(verifyPassword("securepass", hashPassword("securepass")), "Password fail");
  const tables = ["wisata", "villa", "affiliate_products", "affiliate_partners"].map(t => 
    db.prepare(`SELECT COUNT(*) as n FROM ${t}`).get().n
  );
  assert(tables.every(n => n >= 0));
  console.log("✓ DB + password + affiliate tables OK");
  console.log("ALL SMOKE TESTS PASSED");
  process.exit(0);
} catch (e) {
  console.error("FAIL:", e.message);
  process.exit(1);
}
