const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.PAGES_OUTPUT || path.join(root, '_site'));
const base = (process.env.PAGES_BASE_PATH || '').replace(/\/$/, '');
if (base && !/^\/[A-Za-z0-9._-]+$/.test(base)) throw new Error('Invalid Pages base path');
if (output === root || root.startsWith(output + path.sep)) throw new Error('Output must not contain the checkout');
fs.mkdirSync(output, { recursive: true });
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
let count = 0;
for (const file of files) {
  if (!file.endsWith('.html') && !file.startsWith('assets/') &&
      !/^(financial-dashboard|loan-scenario-simulator)\/.*\.(css|js)$/.test(file) &&
      !['robots.txt', 'sitemap.xml', 'manifest.webmanifest'].includes(file)) continue;
  const target = path.join(output, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (file.endsWith('.html')) {
    let html = fs.readFileSync(path.join(root, file), 'utf8');
    html = html.replace(/\b(href|src|srcset|action)=(['"])\/(?!\/)/g, (_, attr, quote) => `${attr}=${quote}${base}/`);
    html = html.replace('</head>', `<script>window.SITE_CONFIG=${JSON.stringify({ static: true, basePath: base })};</script>\n</head>`);
    fs.writeFileSync(target, html);
  } else fs.copyFileSync(path.join(root, file), target);
  count++;
}
// Normalize installable PWA icons while preserving the source artwork.
execFileSync('python3', [
  'scripts/normalize-icons.py',
  path.join(root, 'assets/images/app-icon-192.png'),
  path.join(output, 'assets/images')
], { cwd: root, stdio: 'inherit' });
fs.writeFileSync(path.join(output, '.nojekyll'), '');
console.log(`Built ${count} public files for ${base || '/'} in ${output}`);
