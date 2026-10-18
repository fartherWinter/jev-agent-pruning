# Jev Lab

An independent local proof of concept for Agent-generated workflow paths and Jev pruning. It does not import or depend on LangHub source code.

## Run locally

Requirements: Node.js 20 or newer and a DeepSeek API key.

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set `DEEPSEEK_API_KEY` in that local file. The key stays on the server and is never sent to the browser.
3. Run `npm run dev` and open the Vite URL printed in the terminal. The API server listens on `127.0.0.1:8787`.

Use `DEEPSEEK_MODEL` to change the model ID and `DEEPSEEK_BASE_URL` for a compatible endpoint. The built-in scenarios and custom-task mode all call the configured Agent and Jev model roles. Execution outcomes are a local simulation; custom-task outcomes use keyword matching and must not be treated as real task-quality measurements.

## Experiment method

The Agent generates one candidate set. Jev judges those exact candidate IDs and must return one reasoned keep/drop decision for every candidate, with at least one kept. The baseline executes all candidates in Agent order; the Jev branch executes only retained candidates. Both stop at their first simulated success. An invalid or failed Jev response fails the run; it never silently falls back to the baseline.

Model token usage and request latency come from DeepSeek responses and measured request duration. Simulated execution tokens and latency come from fixed scenario estimates. Shared Agent generation cost and Jev judge overhead are shown separately from per-branch totals.

## Commands

- `npm test` runs the path pairing, candidate validation, experiment orchestration, and provider contract tests.
- `npm run build` type-checks and builds the web client.
- `npm run dev` starts the local web server and Vite development server.
