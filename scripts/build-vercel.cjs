'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const key = process.env.JGI_GOOGLE_MAPS_BROWSER_KEY?.trim();
if (!key) {
  console.error('Build stopped: set JGI_GOOGLE_MAPS_BROWSER_KEY in Vercel for this deployment environment.');
  process.exit(1);
}
const files = [
  'index.html', 'cumulative-report.css', 'whoop-pilot.js', 'whoop-pilot.css', 'privacy.html',
  'jagorawi-old-course-data.js', 'jagorawi-old-scorecard-data.js',
  'jgi-strokes-gained-data.js'
];
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (/const GOOGLE_MAPS_API_KEY\s*=\s*['"][^'"]+['"]/.test(html)) {
  console.error('Build stopped: remove the hardcoded Maps key from source.');
  process.exit(1);
}
fs.rmSync(output, {recursive: true, force: true});
fs.mkdirSync(output, {recursive: true});
for (const file of files) fs.copyFileSync(path.join(root, file), path.join(output, file));
fs.mkdirSync(path.join(output, 'assets'), {recursive: true});
fs.copyFileSync(path.join(root, 'assets/driver-dispersion-bg-v1.png'),
  path.join(output, 'assets/driver-dispersion-bg-v1.png'));
// Browser Maps keys are client-visible. Referrer/API restrictions must be configured in Google Cloud.
// JSON encoding prevents values from breaking the generated JavaScript. Never log the value.
const config = JSON.stringify({googleMapsBrowserKey: key}).replace(/</g, '\\u003c');
fs.writeFileSync(path.join(output, 'runtime-config.js'),
  'window.JGI_RUNTIME_CONFIG = Object.freeze(' + config + ');\n');
console.log('Vercel static build complete. Maps browser configuration generated; value omitted.');
