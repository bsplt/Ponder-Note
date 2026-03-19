# Build and Release

Developer guide for local setup, testing, build artifacts, and GitHub releases.

## Tooling and Environment

- Use Nix as source of truth for tooling.
- Enter the environment with:

```bash
nix develop
```

## Local Development

```bash
cd app
pnpm install
pnpm tauri dev
```

## Tests

```bash
nix develop -c bash -lc "cd app && pnpm test"
```

## Build

From repository root:

```bash
./build-app.sh
```

On macOS, the build flow prefers Apple toolchain linkers inside the Nix shell
to avoid introducing `/nix/store` runtime dependencies. As a safeguard, the
build script also vendors any remaining external non-system dylibs into the
generated `.app` bundle and fails the build if absolute library paths still
point outside the bundle.

Release build:

```bash
./build-app.sh --release
```

## Build Output Folders

- Debug artifacts:
  - `app/src-tauri/target/debug/bundle`
- Release artifacts:
  - `app/src-tauri/target/release/bundle`

## Release Versioning

Before tagging a release, keep these versions in sync:

- `app/package.json`
- `app/src-tauri/Cargo.toml`
- `app/src-tauri/tauri.conf.json`

Current release policy expects versions starting with `1` or higher.

## Publish a GitHub Release

1. Commit version changes.
2. Push your branch.
3. Create and push tag (example):

```bash
git tag v1.0.0
git push origin v1.0.0
```

## Release Automation

- CI tests workflow:
  - `.github/workflows/ci.yml`
- Release workflow:
  - `.github/workflows/release.yml`

Release workflow behavior:

1. Triggers on `v*` tags.
2. Validates tag version against app version files.
3. Builds release bundle.
4. Packs macOS artifacts and SHA256 checksums.
5. Publishes assets to GitHub Release.

## Internal Project Docs

- Development log and planning: `docs/devlog/planning/`
- Design references: `docs/design/`
- AI context docs: `docs/ai/`
- Internal helper tools/docs: `docs/tools/`
