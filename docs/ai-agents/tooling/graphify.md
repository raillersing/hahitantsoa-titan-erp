# Graphify Pilot — OpenCode-Assisted Knowledge Graph Navigation

## Purpose

This document defines the approved pilot scope for introducing
[Graphify](https://graphify.net) as an optional OpenCode-assisted navigation tool
in the Hahitantsoa/Titan ERP repository.

Graphify is an open-source (MIT) skill that builds a queryable knowledge graph
from source code, documentation, and diagrams using Tree-sitter static analysis
and LLM-driven semantic extraction. It is maintained by Safi Shamsi and
distributed on PyPI as `graphifyy`.

## Current Status

- **Phase:** F149A evaluation — docs-only pilot plan.
- **Installation status:** Not installed. The `graphify install --platform opencode`
  command has **not** been run.
- **Graph output:** No `graphify-out/` directory exists yet.
- **Workflow integration:** None. This document is the first governance artifact.

## How Graphify Works

1. **CLI invocation:** `graphify .` scans the repository, extracts ASTs via
   Tree-sitter (classes, functions, imports, call graphs, docstrings), and uses
   the configured AI model for semantic extraction from prose and diagrams.
2. **Graph construction:** Results are merged into a NetworkX graph, clustered
   with the Leiden community-detection algorithm, and exported.
3. **Output files under `graphify-out/`:**
   - `graph.html` — interactive visualisation
   - `graph.json` — machine-queryable graph data
   - `GRAPH_REPORT.md` — human-readable architecture audit
4. **Agent integration (future PR):** OpenCode can read `graph.json` and
   `GRAPH_REPORT.md` to answer codebase questions without re-scanning.

## Allowed Usage (This Pilot)

Only the following operations are permitted under F149A:

| Operation | Allowed? | Constraints |
|---|---|---|
| Manual `graphify .` invocation | Yes | Run from a clean worktree; never on an active task branch |
| Manual `graphify query "..."` | Yes | Read-only graph traversal |
| Manual `graphify path "..." "..."` | Yes | Read-only path-finding |
| Manual `graphify explain "..."` | Yes | Read-only node explanation |
| Agent read of existing graph output | Yes | Agents may read `graphify-out/GRAPH_REPORT.md` and `graphify-out/graph.json` for codebase orientation |
| Adding `graphify-out/` to `.gitignore` | Yes | Keeps generated artifacts out of version control |

## Forbidden Usage (Hard Stop)

The following are **forbidden** until a later approved PR explicitly promotes
each capability:

| Operation | Reason |
|---|---|
| `graphify install --platform opencode` | Would write to `AGENTS.md`, install `.opencode/plugins/graphify.js`, and mutate `opencode.json` — all forbidden without explicit approval |
| `graphify install --project --platform opencode` | Same scope violation |
| Any `graphify install` variant | Bypasses the docs-only pilot gate |
| Graphify Git hooks | Hooks are not approved for any agent tooling in this repository |
| Graphify plugins (`tool.execute.before` hook) | Would create an always-on automatic intervention — forbidden until a dedicated PR reviews hook safety |
| Rewriting `AGENTS.md`, `.opencode/`, `.claude/`, `.codex/` | Existing workflow files are the canonical source of truth and must not be auto-modified |
| Modifying `opencode.json` | Configuration changes require explicit scope approval |
| Backend or frontend application code changes | Out of scope for this tooling governance task |
| Unwrapped shell commands outside `erp-logged-run` | Violates the agent-command-runbook.md workflow |
| Network calls to unapproved endpoints | Graphify's semantic extraction uses the configured AI model API; only URLs restricted to http/https are tolerated |

## Safety Boundaries

1. **No secret exposure:** Graphify sends only semantic descriptions to the AI
   model — never raw source code, `.env` contents, or secrets.
2. **No telemetry:** Graphify performs no telemetry. The only outbound call is
   the semantic-extraction API call using the already-configured model key.
3. **Output containment:** All generated files stay under `graphify-out/`. Paths
   are containment-checked.
4. **No vector embeddings:** Uses Leiden community detection on the NetworkX
   graph — no vector database required.
5. **License:** MIT. Core deps (NetworkX BSD, Tree-sitter MIT) are permissive
   and compatible.

## Pilot Workflow

To generate a graph manually (as an operator, not inside a mutating agent task):

```sh
scripts/dev/erp-logged-run graphify-generate <<'EOF'
set -euo pipefail

pip install graphifyy
graphify .
EOF
```

To query an existing graph read-only:

```sh
scripts/dev/erp-logged-run graphify-query <<'EOF'
set -euo pipefail

graphify query "How does reservation confirmation work?"
EOF
```

Agents may consult `graphify-out/GRAPH_REPORT.md` or `graphify-out/graph.json`
directly without using the `graphify` CLI, provided the graph was generated
under the approved workflow above.

## Future Promotion Path

A later PR may promote Graphify beyond docs-only if it:

1. Proves safe in the current pilot for at least one full task cycle.
2. Reviews and explicitly accepts each capability (plugin, hook, AGENTS.md edit)
   in a dedicated PR with its own scope guard and audit.
3. Does not weaken existing workflow protections or bypass human merge control.
4. Passes a full scope-guard run with the `agent-docs` profile.

Until such a PR is merged, the forbidden-usage table above remains absolute.

## References

- [Graphify homepage](https://graphify.net)
- [Graphify source (GitHub)](https://github.com/lichia/graphify)
- [OpenCode Workflow Bridge](opencode-workflow.md)
- [AI Orchestration Index](../AI_ORCHESTRATION_INDEX.md)
- [Agent Command Runbook](../agent-command-runbook.md)
- [Cross-Agent Compatibility](../cross-agent-compatibility.md)
