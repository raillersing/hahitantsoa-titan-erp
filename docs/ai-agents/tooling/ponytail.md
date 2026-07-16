# ERP Ponytail — Anti-Overengineering Integration

## Purpose

Ponytail (https://github.com/DietrichGebert/ponytail) is a community anti-overengineering
tool for AI agents. The ERP integration does **not** install Ponytail as a plugin or hook;
it adopts Ponytail's anti-overengineering ladder as a native ERP workflow rule. This avoids
external plugin dependencies, lifecycle hooks, Node.js runtime requirements, and trust
decisions while keeping the same discipline.

All ERP agents follow the targeted Graphify + Ponytail workflow:

1. **Cartography index** — select the relevant normative map
2. **Graphify** — verify freshness and inspect relevant entities or paths
3. **Raw search** — confirm only unresolved live-code details
4. **Ponytail ladder** — anti-overengineering before writing new code

---

## ERP Ponytail Ladder

Before writing new code, stop at the **first rung that holds**:

| Step | Question | Action |
|------|----------|--------|
| 1 | Already in cartography or Graphify? | Use the mapped component |
| 2 | Already exists in this codebase? | Reuse — don't rewrite |
| 3 | Native platform feature available? | Use it (e.g. Django built-in, HTML `<input type="date">`) |
| 4 | Already in an installed dependency? | Use it before adding a new one |
| 5 | One line? | Write one line, not a helper |
| 6 | **Then** write the smallest robust implementation | Minimum viable — no abstractions "for later" |
| 7 | Test and document only what changed | No speculative coverage |

### Anti-overengineering rules

- No unrequested abstractions (no interface with one impl, no factory for one product).
- Deletion over addition; boring over clever.
- Never cut: trust-boundary validation, data-loss handling, security, accessibility,
  permission checks, auditability.
- Mark post-ladder simplifications with `// ponytail:` (frontend) or `# ponytail:`
  (backend) comments for future debt harvesting.
- Bug fix = root cause, not symptom.

### Intensity modes

The ERP default intensity is **`full`** — the ladder is enforced.

- `lite` — build what's asked but name the lazier alternative
- `full` — ladder enforced (ERP default)
- `ultra` — YAGNI extremist: deletion before addition

Agents may report the current intensity in their final report.

---

## Integration with Graphify

Graphify and Ponytail serve complementary roles:

| Tool | When | What it provides |
|------|------|------------------|
| Cartography | Before implementation | Normative intent for the selected domain or flow |
| Graphify | Before structural implementation | Current code-level entities and dependency paths |
| Ponytail | After consultation, before writing | Anti-overengineering discipline |

The consultation order is: **selected normative map → targeted Graphify evidence →
targeted raw search → Ponytail ladder**. Do not read every map and the complete graph
for each task.

Graphify tells the agent **what exists** (entities, dependencies, clusters).
Ponytail tells the agent **don't rewrite what exists** and **write the smallest
addition**.

If Graphify already reveals an existing entity that does what the task needs,
Ponytail steps 1-2 say: stop and reuse it.

---

## Hook and Plugin Decision

No Ponytail plugin, hook, or lifecycle script is installed in this repository.

| Integration | Decision | Reason |
|-------------|----------|--------|
| Claude Code (`/plugin install ponytail`) | Not installed | Requires lifecycle hooks with `node` runtime; CLAUDE.md forbids unreviewed hooks |
| Codex (`codex plugin marketplace add`) | Not installed | Requires hook trust approval in `/hooks` UI; global config change |
| OpenCode (`opencode.json` plugin entry) | Not installed | Remote npm dependency; per-project config but external script |
| `.cursor/rules/`, `.windsurf/rules/`, `.clinerules/` | Not installed | Would add project-level rule files; the ERP ladder is documented in AGENTS.md instead |
| `.github/copilot-instructions.md` | Not installed | Already references AGENTS.md which contains the ladder |

The ERP Ponytail ladder lives in AGENTS.md and this governance doc. All agents read
AGENTS.md as their first instruction, so the ladder applies universally without any
plugin installation.

---

## How Future Agents Use Graphify + Ponytail Together

1. **Before implementation**: follow the consultation order:
   - Select the relevant map from `docs/architecture/application-map/README.md`
   - Report Graphify freshness and inspect only relevant entities or paths
   - Search existing code with `rg` only for unresolved details
2. **Apply the Ponytail ladder**: before writing new code, verify each rung
3. **Implement**: smallest robust addition that passes all quality gates
4. **Report**: state the selected map, Graphify build SHA and targeted evidence, what
   existing code was reused, tests intentionally not repeated, and Ponytail intensity

Ponytail itself is a policy, not generated state: agents apply and report it but do not
"update Ponytail" after every task. Change this document only when a durable workflow
lesson changes the ladder.

---

## References

- Ponytail repository: https://github.com/DietrichGebert/ponytail
- AGENTS.md: knowledge graph consultation order + ERP Ponytail ladder
- `docs/ai-agents/tooling/graphify.md`: Graphify knowledge graph pilot
- `docs/architecture/application-map/`: application cartography
