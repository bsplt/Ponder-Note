# Agents

## Nix (Builds and Dependencies)

Use Nix as the source of truth for tooling, builds, and dependencies.

- Prefer entering the dev environment via `nix develop` (or `nix develop .#<devShell>`) before running repo commands.
- Prefer `nix build`, `nix run`, and `nix flake check` over ad-hoc install flows.
- Avoid installing tooling via Homebrew, npm/pnpm, or `cargo install` outside the Nix environment unless explicitly requested.

## Figma MCP

For UI design reference, look at the Figma via MCP.

### Flow for Figma

1. **Build the map:** `get_metadata`
   - If nothing is selected: request metadata for the whole page/current context.
   - Goal: identify top-level frames, hierarchy, names, sizes, positions.

2. **Get eyes on it:** `get_screenshot`
   - Capture screenshots of the most relevant frames.
   - Prioritize the 3–5 largest or most semantically important frames (e.g., “Login”, “Checkout”, “Settings”, “Dialog”, “Table”, “Dashboard”).

3. **Pull structured context:** `get_design_context`
   - Fetch layout/system details for the shortlisted frames (Auto Layout, spacing, typography, component structure).
   - If output is too large: use `get_metadata` to narrow down, then re-run `get_design_context` on subtrees.

4. **Optional (usually valuable):**
   - `get_variable_defs` for token/style consistency (colors, spacing, type).
   - `get_code_connect_map` to detect component reuse/drift relative to the codebase.
