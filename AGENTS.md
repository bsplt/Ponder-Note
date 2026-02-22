# Agents

Project-level instructions for coding agents working in this repository.

## Nix (Builds and Dependencies)

Use Nix as the source of truth for tooling, builds, and dependencies.

- Enter the dev environment with `nix develop` (or `nix develop .#<devShell>`) before running project commands.
- Prefer `nix build`, `nix run`, and `nix flake check` over ad-hoc install flows.
- Avoid installing tooling via Homebrew, npm/pnpm, or `cargo install` outside the Nix environment unless explicitly requested.
- Run `./build-app.sh` after code changes (defaults to `--debug`; use `--release` when needed).
