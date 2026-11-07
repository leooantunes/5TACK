// Cito API setup script. Made for one person; the link inside works once.
// What it does: saves your API key to .env (never printed), adds .env to .gitignore, connects the Cito MCP server
// to your AI tools (Claude Code, Cursor, Codex, Windsurf, Claude Desktop), and makes one test call.
import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const BASE = "https://api.citoapi.com";
const CODE = "cito_setup_gJCXdIaofAcMFONdx4lqQk_Iplw";
const say = (s) => console.log(s);

if (Number(process.versions.node.split('.')[0]) < 18) {
  say('CITO_SETUP_FAILED: Node 18 or newer is needed (found ' + process.version + ').');
  process.exit(1);
}

const r = await fetch(BASE + '/setup/redeem', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: CODE }) });
const j = await r.json().catch(() => ({}));
if (!r.ok || !j.apiKey) {
  say('CITO_SETUP_FAILED: ' + (j.error || 'setup failed (HTTP ' + r.status + ')'));
  process.exit(1);
}
const KEY = j.apiKey;

// 1. .env in the current folder: replace an existing CITO_API_KEY line, else add one.
let env = existsSync('.env') ? readFileSync('.env', 'utf8') : '';
if (/^CITO_API_KEY=.*$/m.test(env)) env = env.replace(/^CITO_API_KEY=.*$/m, 'CITO_API_KEY=' + KEY);
else env = env + (env && !env.endsWith('\n') ? '\n' : '') + 'CITO_API_KEY=' + KEY + '\n';
writeFileSync('.env', env);
let gitignored = false;
const gi = existsSync('.gitignore') ? readFileSync('.gitignore', 'utf8') : null;
if (gi === null) { writeFileSync('.gitignore', '.env\n'); gitignored = true; }
else if (!/^\.env\s*$/m.test(gi)) { appendFileSync('.gitignore', (gi.endsWith('\n') ? '' : '\n') + '.env\n'); gitignored = true; }
else gitignored = true;

// 2. MCP server for every AI tool on this machine (key goes in through the environment, not the command line).
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const inst = spawnSync(npx, ['-y', 'cito-mcp@latest', 'install'], {
  env: { ...process.env, CITO_API_KEY: KEY },
  encoding: 'utf8',
  shell: process.platform === 'win32',
  timeout: 180000,
});
const out = String(inst.stdout || '') + String(inst.stderr || '');
const added = out.split(/\r?\n/).filter((l) => /✓|wrote|configured|updated/i.test(l) && !/^\s*Looked for/i.test(l) && !/cito_[A-Za-z0-9]{20,}/.test(l)).map((l) => l.trim()).slice(0, 8);
const mcpOk = inst.status === 0;

// 2b. Tools the installer does not know yet: Google Antigravity, Gemini CLI, VS Code. Merge our entry, keep the rest,
// back the file up first, skip any file that is not valid JSON.
const HOME = (await import('node:os')).homedir();
const { join, dirname } = await import('node:path');
const { mkdirSync, copyFileSync } = await import('node:fs');
const APPDATA = process.env.APPDATA || join(HOME, 'AppData', 'Roaming');
const stdioEntry = { command: 'npx', args: ['-y', 'cito-mcp'], env: { CITO_API_KEY: KEY } };
const extra = [
  { label: 'Antigravity', when: [join(HOME, '.gemini', 'antigravity'), join(HOME, '.gemini', 'config')], file: join(HOME, '.gemini', 'config', 'mcp_config.json'), key: 'mcpServers', entry: stdioEntry },
  { label: 'Gemini CLI', when: [join(HOME, '.gemini', 'settings.json')], file: join(HOME, '.gemini', 'settings.json'), key: 'mcpServers', entry: stdioEntry },
  { label: 'VS Code', when: [join(APPDATA, 'Code', 'User'), join(HOME, 'Library', 'Application Support', 'Code', 'User'), join(HOME, '.config', 'Code', 'User')],
    file: null, key: 'servers', entry: { type: 'stdio', ...stdioEntry } },
];
for (const c of extra) {
  const hit = c.when.find((w) => existsSync(w));
  if (!hit) continue;
  const file = c.file || join(hit, 'mcp.json');
  try {
    let cfg = {};
    if (existsSync(file)) {
      const raw = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
      cfg = raw.trim() ? JSON.parse(raw) : {};
      copyFileSync(file, file + '.bak-cito-' + Date.now());
    } else {
      mkdirSync(dirname(file), { recursive: true });
    }
    cfg[c.key] = { ...(cfg[c.key] || {}), cito: c.entry };
    writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
    added.push('✓ ' + c.label);
  } catch (e) {
    added.push('✗ ' + c.label + ' (' + e.message.slice(0, 60) + ')');
  }
}

// 3. one test call
let test = 'skipped';
try {
  const t = await fetch(BASE + j.firstCall.path, { headers: { 'x-api-key': KEY, 'user-agent': 'cito-ai-setup' } });
  const body = await t.json().catch(() => ({}));
  const rows = Array.isArray(body.data) ? body.data : Array.isArray(body.items) ? body.items : [];
  const first = rows[0] && (rows[0].title || rows[0].name || rows[0].eventName || rows[0].tournamentName || rows[0].slug || rows[0].id);
  test = t.ok ? rows.length + ' ' + j.firstCall.what + (first ? ' (first: ' + first + ')' : '') : 'HTTP ' + t.status;
} catch (e) { test = 'failed: ' + e.message; }

say('CITO_SETUP_OK');
say('- Saved CITO_API_KEY to .env in ' + process.cwd() + ' (key ' + j.keyPrefix + '..., not printed)' + (gitignored ? '; .env is in .gitignore' : ''));
say(mcpOk || added.some((a) => a.startsWith('✓'))
  ? '- Cito MCP server connected' + (added.length ? ': ' + added.join(' | ') : '') + '. Restart the AI app once to load its Cito tools.'
  : '- MCP install did not finish (' + (out.split(/\r?\n/).filter(Boolean).slice(-1)[0] || 'unknown error') + '). The API key works anyway.');
say('- Test call ' + j.firstCall.path + ' -> ' + test);
say('- API base: ' + BASE + '/api/v1, header x-api-key: process.env.CITO_API_KEY');
say('- Docs for you, the AI: https://citoapi.com/llms.txt (all endpoints) and https://citoapi.com/docs');
say('NEXT: Tell the user Cito is set up, show them the test result in one line, and ask what they want to build.');
