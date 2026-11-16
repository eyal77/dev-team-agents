# dev-team-agents

A dev team of coding agents for building your own project, with a live dashboard of who is talking to whom.
It runs on [Claude Code](https://claude.com/claude-code) and needs Node.js for the dashboard and logging.

## The team

| Persona | Role | Does |
| --- | --- | --- |
| Dave | Dev manager | Takes your objectives, plans missions, hands them out, enforces the workflow |
| Adam | Architect | Architecture decisions, one design meeting with the team, reviews Alice's code |
| Alice | Senior developer | Hard missions, reviews Ben's code |
| Ben | Junior developer | Simple missions |
| Tom | QA | Writes the test book from the spec, tests every mission |
| Alex | Documentation | Documents a mission after it is merged |

## Use it

1. Use this repo as a template for your project (or copy `.claude/` and `team/` into an existing repo).
2. Start the dashboard: `node team/team.js serve` and open <http://localhost:4321>.
3. Run `claude` in the repo. The session starts as Dave. Give him your objectives and design.

Dave asks for your approval twice, on the mission plan and on the architecture, and comes back to you
when a mission is rejected three times or a team member has a question nobody can answer.

## Workflow

1. Dave plans missions. You approve.
2. Adam drafts `docs/architecture.md`, gets one round of objections from Alice, Ben and Tom, and finalises it. You approve.
3. Tom writes `docs/test-book.md` from the spec.
4. Each mission runs on its own `mission/<id>` branch: code, then review (Alice reviews Ben, Adam reviews Alice), then Tom's tests.
   The developer commits only after both pass, and Dave merges to main.
5. Alex documents the merged mission.

## Files

- `.claude/agents/*.md`: one file per persona. Edit these to change behaviour or the model each one uses.
- `.claude/settings.json`: makes Dave the main session and installs the logging hooks.
- `team/team.js`: event logger, hook handler and dashboard server.
- `team/tasks.json`: the mission board, kept by Dave. A new session resumes from it.
- `team/events.jsonl`: the interaction log the dashboard renders.
- `node team/test.js`: checks the logger.
