#!/usr/bin/env node
// One script, three jobs:
//   node team/team.js log <from> <to> <type> <message...>   agents record an interaction
//   node team/team.js hook                                  Claude Code hooks pipe JSON on stdin
//   node team/team.js serve [port]                          dashboard at http://localhost:4321
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
    '/': [path.join(__dirname, 'dashboard.html'), 'text/html', ''],
    '/events': [EVENTS, 'text/plain', ''],
    '/tasks': [TASKS, 'application/json', '[]'],
  };
  http.createServer((req, res) => {
    const r = routes[req.url.split('?')[0]];
    if (!r) { res.writeHead(404); return res.end(); }
    // ponytail: whole file re-sent on every poll; switch to SSE + offsets if events.jsonl gets huge
    fs.readFile(r[0], (err, data) => {
      res.writeHead(200, { 'content-type': r[1] + '; charset=utf-8', 'cache-control': 'no-store' });
      res.end(err ? r[2] : data);
    });
  }).listen(port, '127.0.0.1', () => console.log(`Team dashboard: http://localhost:${port}`));
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
} else {
  console.error('usage: node team/team.js log|hook|serve');
  process.exit(1);
}
