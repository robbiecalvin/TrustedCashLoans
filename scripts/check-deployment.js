const assert = require('node:assert/strict');
const base = process.argv[2];
if (!base) throw new Error('Usage: node scripts/check-deployment.js <site-url>');

async function check() {
  for (const route of ['', 'personal-loans-canada/', 'loan-calculator/5000/', 'financial-dashboard/']) {
    const url = new URL(route, base.endsWith('/') ? base : base + '/');
    const response = await fetch(url, { signal: AbortSignal.timeout(20000), cache: 'no-store' });
    assert.equal(response.status, 200, url.href);
    const html = await response.text();
    assert.ok(/<html/i.test(html), `Expected HTML at ${url}`);
    const references = [...html.matchAll(/\b(?:src|href|srcset)=["']([^"']+)/g)]
      .map(match => new URL(match[1], url))
      .filter(asset => asset.origin === url.origin && /\.(?:css|js|png)$/.test(asset.pathname));
    assert.ok(references.length >= 3, `Missing public assets at ${url}`);
    for (const asset of new Map(references.map(asset => [asset.href, asset])).values()) {
      const result = await fetch(asset, { signal: AbortSignal.timeout(20000), cache: 'no-store' });
      assert.equal(result.status, 200, asset.href);
      const bytes = new Uint8Array(await result.arrayBuffer());
      assert.ok(bytes.length > 0, `Empty asset: ${asset}`);
      if (asset.pathname.endsWith('.png')) {
        assert.deepEqual([...bytes.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `Invalid image: ${asset}`);
      } else {
        const text = new TextDecoder().decode(bytes);
        assert.ok(!/^\s*<!doctype html/i.test(text), `HTML returned instead of asset: ${asset}`);
        if (asset.pathname.endsWith('/assets/scripts/script.js')) assert.ok(text.includes('var scriptBase'), 'Old JavaScript is still cached');
      }
    }
    console.log(`Verified HTML, styles, scripts, and images: ${url}`);
  }
}
(async () => {
  for (let attempt = 1; attempt <= 6; attempt++) {
    try { await check(); return; }
    catch (error) {
      if (attempt === 6) throw error;
      console.log(`Deployment propagation check ${attempt}: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
