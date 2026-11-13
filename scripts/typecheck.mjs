import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const configPath = resolve('tsconfig.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) {
  console.error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  process.exit(1);
}
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath));
// Resolve from installed dependencies (including optional NODE_PATH) without
// symlinking or copying them into the source tree.
parsed.options.paths = { obsidian: [require.resolve('obsidian/obsidian.d.ts')] };
parsed.options.typeRoots = [dirname(dirname(require.resolve('@types/node/package.json')))];
parsed.options.noEmit = true;
const program = ts.createProgram(parsed.fileNames, parsed.options);
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getCanonicalFileName: file => file,
    getNewLine: () => '\n',
  }));
  process.exitCode = 1;
}
