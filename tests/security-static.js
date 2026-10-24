const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
assert.match(read('lib/helpers.js'), /require\("sanitize-html"\)/);
assert.match(read('routes/admin.js'), /if \(err\) \{[\s\S]*?return res\.status\(503\)/);
assert.match(read('app.js'), /IS_PROD && !process\.env\.DATA_DIR/);
assert.doesNotMatch(read('routes/affiliate.js'), /\.run\([^\n]*req\.ip/);
for (const file of ['wisata-detail', 'villa-detail', 'kuliner-detail', 'berita-detail']) {
  assert.match(read('views/' + file + '.ejs'), /sanitizeHtml\(item\.content/);
}
console.log('PASS: 8 static security invariants (not dynamic penetration tests)');
