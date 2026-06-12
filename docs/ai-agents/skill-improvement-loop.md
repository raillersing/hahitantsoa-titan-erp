# Agent skill improvement loop

Agent quality should improve from evidence, not from ad hoc prompt growth.

After each PR, identify:

- mistakes and regressions;
- reviewer false positives;
- missed tests or failure modes;
- unclear or over-broad scope;
- repeated environment or command errors;
- useful new guardrails;
- duplicated or obsolete instructions.

Promote a lesson into the official workflow only when it is durable and reusable.
Apply the improvement in a later small documentation PR, update the narrowest relevant
file under `docs/ai-agents/` or `AGENTS.md`, and remove superseded wording rather than
creating competing instructions.

Do not change agent rules inside an unrelated implementation PR unless the workflow
defect blocks safe completion of that task.
