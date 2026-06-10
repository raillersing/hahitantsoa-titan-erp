# F88 - Local Aider/Ollama 7B experiment result

## Status

Result: PASS for minimal read-only connectivity test.

Decision: Aider remains experimental and read-only only for the Hahitantsoa/Titan ERP workflow.

Aider is not promoted to production Agent A for implementation tasks. The current workflow continues to use the human-supervised copy/paste method, with ChatGPT acting as the planning and review assistant until Codex, Gemini, or Aider are explicitly re-authorized for a specific task.

## Environment verified

Repository:

- Local repository: $HOME/projects/hahitantsoa-titan-erp
- Branch at start of F88 pre-check: main
- Last known main commit: 571e924 Merge pull request #84 from raillersing/docs/mvp-readonly-acceptance-closure
- Working tree at F88 pre-check: clean

Local tools:

- Aider: 0.86.2
- uv: 0.11.19
- System Python in WSL: 3.14.4
- Python used for Aider through uv: 3.12.13
- Ollama: running on Windows
- WSL access to Ollama Windows: via the Windows host IP discovered from /etc/resolv.conf

## Ollama models observed

The following local Ollama models were visible from WSL through the Windows Ollama API:

- qwen25-coder-7b-q4km:latest
  - Format: GGUF
  - Family: qwen2
  - Parameter size: 7.6B
  - Quantization: Q4_K_M
  - Capability exposed by Ollama: completion

- qwen25-coder-14b-q4km:latest
  - Format: GGUF
  - Family: qwen2
  - Parameter size: 14.8B
  - Quantization: Q4_K_M
  - Capability exposed by Ollama: completion

- carnice:q4_k_m
  - Format: GGUF
  - Family: qwen35moe
  - Parameter size: 34.7B
  - Quantization: Q4_K_M
  - Capability exposed by Ollama: completion

At the end of the F88 pre-check, no Ollama model was loaded in memory according to /api/ps.

## Aider/Ollama test result

Aider was launched from WSL inside the ERP repository with the following operational setup:

- Windows host IP discovered from /etc/resolv.conf
- OLLAMA_API_BASE exported to http://<windows-host-ip>:11434
- Aider launched with model ollama/qwen25-coder-7b-q4km
- Aider launched with --no-auto-commits
- Aider launched with --no-dirty-commits
- Aider launched with --map-tokens 1024

The minimal read-only prompt was:

- /ask Reponds en francais. Reponds seulement: OK AIDER READONLY. Ne modifie aucun fichier. Ne lis pas .env. Ne lance aucune commande.

Observed response:

- OK AIDER READONLY

This confirms that Aider can connect from WSL to the Windows Ollama service and receive a response from the local 7B model.

## Limitations observed

The model imported manually as GGUF is exposed by Ollama with completion capability, not chat capability.

The following Aider mode timed out after 600 seconds:

- --model ollama_chat/qwen25-coder-7b-q4km

The following mode worked for the minimal read-only test:

- --model ollama/qwen25-coder-7b-q4km

A direct /api/generate test with a simple French instruction produced a non-instruction-like identifier-style output instead of the requested text. This indicates that the manually imported GGUF model may not have a complete instruct/chat template configured for reliable general use.

Because of these limitations, the model is not approved for code implementation, refactoring, database changes, test generation, or MVP-affecting edits.

## Memory and performance notes

The 7B model can consume several GB of RAM when loaded. The user observed high memory usage during tests.

Operational rule:

- Use only the 7B model on the current laptop for experiments.
- Keep the 14B and larger models stored on disk for future transfer to a more powerful laptop or PC.
- Stop loaded models after tests when memory pressure is high.

Useful Windows PowerShell commands:

- ollama ps
- ollama stop qwen25-coder-7b-q4km
- ollama stop qwen25-coder-14b-q4km
- ollama stop carnice:q4_k_m

## ERP workflow decision

For the Hahitantsoa/Titan ERP project:

- Aider is installed and documented.
- Aider is not used as Agent A yet.
- Aider is not used as Agent B yet.
- Aider is allowed only for explicitly authorized read-only experiments.
- No Aider-driven code or documentation edit is authorized without human validation.
- ChatGPT remains the planning and review assistant for the next ERP steps.
- The user remains the human executor and final validator.
- The manual Git workflow remains mandatory: clean branch, small task, review, commit, PR, manual merge.

## Safety rules retained

The following rules remain mandatory:

- Do not read, display, source, or modify .env.
- Do not expose secrets, tokens, cookies, passwords, or API keys.
- Do not allow local AI agents to modify project files without explicit human approval.
- Use scripts/dev/erp-logged-run for important WSL commands.
- Use the copy/paste terminal-output workflow with logs copied to the Windows clipboard.
- Keep every implementation task small, auditable, and reversible.
