# Orion

Orion is a private, local-first personal assistant for Windows and the web. It combines persistent conversations, consent-based memory, live voice interaction, selective web research, configurable workspaces, and a four-member advisory council.

## Local development

Requirements:

- Node.js 24 or later
- Ollama running locally
- The `qwen3:4b` model

Install and run:

```powershell
npm.cmd install
npm.cmd run build
npm.cmd run start
```

Open `http://127.0.0.1:8787`.

## Quality checks

```powershell
npm.cmd run lint
npm.cmd run build
```

## Branch model

- `main` contains reviewed releases.
- `develop` is the active integration branch and currently accepts direct pushes.
- `main` remains protected; promote reviewed `develop` changes through a pull request.
- Release pull requests merge `develop` into `main`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow.

## Privacy

Local conversation data is stored in `orion.db`, which is excluded from Git. API keys, environment files, recordings, and personal databases must never be committed.

## Brand

The Orion logo is an original project SVG. See [docs/BRAND.md](docs/BRAND.md) for provenance and usage notes.
