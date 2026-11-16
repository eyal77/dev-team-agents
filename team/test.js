// node team/test.js — checks the hook + log paths against a temp dir.
const { spawnSync } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'team-'));
const run = (args, input) => spawnSync(process.execPath, [path.join(__dirname, 'team.js'), ...args],
  { input: input && JSON.stringify(input), env: { ...process.env, TEAM_DIR: dir } });

run(['hook'], { hook_event_name: 'PreToolUse', tool_input: { subagent_type: 'adam', description: 'Design it' } });
run(['hook'], { hook_event_name: 'PreToolUse', agent_type: 'adam', tool_input: { subagent_type: 'alice', description: 'Meeting' } });
run(['hook'], { hook_event_name: 'SubagentStop', agent_type: 'alice', last_assistant_message: 'One objection' });
run(['hook'], { hook_event_name: 'PreToolUse', tool_input: { subagent_type: 'Explore', description: 'ignored' } });
run(['log', 'alice', 'ben', 'review', 'Changes', 'requested']);
assert.equal(run(['log', 'alice', 'nobody', 'review', 'x']).status, 1);
assert.equal(run(['hook'], undefined).status, 0); // garbage stdin must not fail the hook

const ev = fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
assert.deepEqual(ev.map(e => [e.from, e.to, e.type, e.msg]), [
  ['dave', 'adam', 'handoff', 'Design it'],
  ['adam', 'alice', 'handoff', 'Meeting'],
  ['alice', 'adam', 'report', 'One objection'], // reports to whoever handed off, not always Dave
  ['alice', 'ben', 'review', 'Changes requested'],
]);
fs.rmSync(dir, { recursive: true });
console.log('ok');
