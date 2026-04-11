const vm = require('vm');
const { createInterface } = require('./out/interface/index.js');
const html = createInterface();
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) { console.log('NO_SCRIPT_TAG'); process.exit(1); }
try {
  new vm.Script(scriptMatch[1], { filename: 'webview-script.js' });
  console.log('SCRIPT_OK');
} catch (e) {
  console.log('ERR', e.message);
  process.exit(1);
}
