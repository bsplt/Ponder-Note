# Contributing

## Setup

1. Enter the Nix development shell:

   ```bash
   nix develop
   ```

2. Install frontend dependencies:

   ```bash
   cd app
   pnpm install
   ```

## Local validation

1. Run tests:

   ```bash
   nix develop -c bash -lc "cd app && pnpm test"
   ```

2. Run the app build script from repository root:

   ```bash
   ./build-app.sh
   ```

## Pull requests

1. Keep changes scoped and focused.
2. Update documentation if behavior or developer workflow changes.
3. Ensure tests pass before opening a PR.
