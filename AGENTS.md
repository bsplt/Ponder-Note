# Agents

## Nix (Builds and Dependencies)

Use Nix as the source of truth for tooling, builds, and dependencies.

- Prefer entering the dev environment via `nix develop` (or `nix develop .#<devShell>`) before running repo commands.
- Prefer `nix build`, `nix run`, and `nix flake check` over ad-hoc install flows.
- Avoid installing tooling via Homebrew, npm/pnpm, or `cargo install` outside the Nix environment unless explicitly requested.

## References

- Figma MCP usage and handshake: `FIGMA_MCP.md`
- MCP examples: `FIGMA_MCP_EXAMPLES.md`

## UI Implementation

### Core principles

- Treat Figma MCP output as design reference, not final code style.
- Use existing components
- Replace Tailwind utilities with project tokens/utilities when applicable.
- Use the project's color system, typography scale, and spacing tokens consistently.
- Ask the user to select the frames and components you are interested in for `get_design_context`
- Asking really is better than guessing

### Visual fidelity

- Aim for 1:1 parity with Figma.
- Prefer design-system tokens and adjust spacing or sizes minimally to match visuals.
- Validate against screenshots for both look and behavior.

### Layout and responsiveness

- Implement responsiveness based on Figma Auto Layout.
- Respect min-width and max-width settings of frames, if set
- Parent frames are adaptive unless Figma specifies a fixed width.

### Interaction and states

- Implement component interaction states when defined in Figma (hover, focus, active, disabled).
- Honor any annotations provided in Figma
