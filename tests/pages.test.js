const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

for (const base of ['', '/TrustedCashLoans']) {
  test(`Pages build resolves every public resource at ${base || '/'}`, () => {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), 'trusted-pages-'));
    try {
      execFileSync(process.execPath, ['scripts/build-pages.js'], {
        cwd: root, env: { ...process.env, PAGES_BASE_PATH: base, PAGES_OUTPUT: output }
      });
      let pages = 0;
      function inspect(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const file = path.join(dir, entry.name);
          if (entry.isDirectory()) { inspect(file); continue; }
          if (!file.endsWith('.html')) continue;
          pages++;
          const html = fs.readFileSync(file, 'utf8');
          assert.ok(html.includes('window.SITE_CONFIG='), file);
          for (const match of html.matchAll(/\b(?:src|href|srcset)=['"]([^'"]+)/g)) {
            const value = match[1];
            if (/^(?:[a-z]+:|\/\/|#)/i.test(value)) continue;
            const pathname = value.split(/[?#]/)[0];
            if (!pathname) continue;
            let target;
            if (pathname.startsWith('/')) {
              assert.ok(pathname.startsWith(`${base}/`), `${file}: ${value} escapes base`);
              target = path.join(output, pathname.slice(base.length + 1));
            } else target = path.resolve(path.dirname(file), pathname);
            assert.ok(fs.existsSync(target), `${file}: missing ${value}`);
          }
        }
      }
      inspect(output);
      assert.ok(pages > 800, 'Includes the full public site');
      for (const file of ['server.js', 'package.json', '.git', 'data', 'node_modules']) {
        assert.equal(fs.existsSync(path.join(output, file)), false, `Must not publish ${file}`);
      }
      for (const file of ['financial-dashboard/dashboard.js', 'loan-scenario-simulator/simulator.js', 'assets/images/desktophero.png', 'assets/images/mobilehero.png']) {
        assert.ok(fs.existsSync(path.join(output, file)), file);
      }
    } finally { fs.rmSync(output, { recursive: true, force: true }); }
  });
}
