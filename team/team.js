#!/usr/bin/env node
// One script, three jobs:
//   node team/team.js log <from> <to> <type> <message...>   agents record an interaction
//   node team/team.js hook                                  Claude Code hooks pipe JSON on stdin
//   node team/team.js serve [port]                          dashboard at http://localhost:4321
//   node team/team.js start|stop [port]                     run / stop the dashboard in the background
const fs = require('fs'), path = require('path'), http = require('http');

const DIR = process.env.TEAM_DIR || __dirname; // TEAM_DIR only exists so test.js can use a temp dir
const EVENTS = path.join(DIR, 'events.jsonl');
const TASKS = path.join(DIR, 'tasks.json');
const TEAM = ['dave', 'adam', 'alice', 'ben', 'tom', 'alex', 'user'];

const readEvents = () => !fs.existsSync(EVENTS) ? [] :
  fs.readFileSync(EVENTS, 'utf8').split('\n').flatMap(l => { try { return [JSON.parse(l)]; } catch { return []; } });

const log = (from, to, type, msg, extra) => fs.appendFileSync(EVENTS, JSON.stringify(
  { ts: new Date().toISOString(), from, to, type, msg: String(msg || '').slice(0, 2000), ...extra }) + '\n');

function hook() {
  const h = JSON.parse(fs.readFileSync(0, 'utf8'));
  const me = String(h.agent_type || 'dave').toLowerCase();       // no agent_type = main session = Dave
  const target = String(h.tool_input?.subagent_type || '').toLowerCase();
  if (h.hook_event_name === 'PreToolUse' && TEAM.includes(target)) {
    log(me, target, 'handoff', h.tool_input.description);
  } else if (h.hook_event_name === 'SubagentStop' && TEAM.includes(me)) {
    // report back to whoever handed this persona its current work
    const boss = readEvents().reverse().find(e => e.type === 'handoff' && e.to === me)?.from || 'dave';
    log(me, boss, 'report', h.last_assistant_message);
  } else if (h.hook_event_name === 'PostToolUse' && TEAM.includes(target) && h.tool_response?.totalTokens) {
    log(target, target, 'cost', '', { tokens: h.tool_response.totalTokens });
  }
}

function serve(port) {
  const routes = {
    '/': [path.join(__dirname, 'dashboard.html'), 'text/html; charset=utf-8', ''],
    '/events': [EVENTS, 'text/plain; charset=utf-8', ''],
    '/tasks': [TASKS, 'application/json; charset=utf-8', '[]'],
  };
  for (const n of ['app', ...TEAM]) routes[`/icons/${n}.png`] = [path.join(__dirname, 'icons', n + '.png'), 'image/png', ''];
  http.createServer((req, res) => {
    if (req.url === '/pid') return res.end(String(process.pid)); // how start/stop find the server
    const r = routes[req.url.split('?')[0]];
    if (!r) { res.writeHead(404); return res.end(); }
    // ponytail: whole file re-sent on every poll; switch to SSE + offsets if events.jsonl gets huge
    fs.readFile(r[0], (err, data) => {
      res.writeHead(200, { 'content-type': r[1], 'cache-control': r[1] === 'image/png' ? 'max-age=3600' : 'no-store' });
      res.end(err ? r[2] : data);
    });
  }).listen(port, '127.0.0.1', () => console.log(`Team dashboard: http://localhost:${port}`));
}

// pid of the dashboard answering on this port, or 0. No pid file, so nothing goes stale.
const pidOf = port => fetch(`http://127.0.0.1:${port}/pid`).then(r => r.ok ? r.text() : '').then(Number).catch(() => 0);

async function start(port) {
  if (await pidOf(port)) return console.log(`Already running: http://localhost:${port}`);
  require('child_process').spawn(process.execPath, [__filename, 'serve', port],
    { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  for (let i = 0; i < 20 && !(await pidOf(port)); i++) await new Promise(r => setTimeout(r, 100));
  if (!(await pidOf(port))) { console.error(`Failed to start. Is port ${port} in use?`); process.exit(1); }
  console.log(`Team dashboard started: http://localhost:${port}`);
}

async function stop(port) {
  const pid = await pidOf(port);
  if (!pid) return console.log(`Not running on port ${port}`);
  process.kill(pid);
  console.log('Team dashboard stopped');
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'hook') {
  try { hook(); } catch { /* a logging failure must never block the team */ }
} else if (cmd === 'log') {
  const [from, to, type, ...msg] = args;
  if (!TEAM.includes(from) || !TEAM.includes(to) || !type || !msg.length) {
    console.error(`usage: node team/team.js log <from> <to> <type> <message>\n  from/to: ${TEAM.join('|')}`);
    process.exit(1);
  }
  log(from, to, type, msg.join(' '));
} else if (cmd === 'serve') {
  serve(Number(args[0]) || 4321);
} else if (cmd === 'start' || cmd === 'stop') {
  (cmd === 'start' ? start : stop)(Number(args[0]) || 4321);
} else {
  console.error('usage: node team/team.js log|hook|serve|start|stop');
  process.exit(1);
}
