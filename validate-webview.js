const vm = require('vm');
const { createInterface } = require('./out/interface/index.js');
const html = createInterface();
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) { console.log('NO_SCRIPT_TAG'); process.exit(1); }
// Write extracted script for debugging
const fs = require('fs');
try {
  fs.writeFileSync('debug-webview-script.js', scriptMatch[1]);
} catch (e) {
  // ignore
}
try {
  new vm.Script(scriptMatch[1], { filename: 'webview-script.js' });
  console.log('SCRIPT_OK');
} catch (e) {
  console.log('ERR', e.message);
  if (e.stack) console.log(e.stack);
  process.exit(1);
}
