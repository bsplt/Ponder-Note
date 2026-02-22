[![Download for macOS](https://img.shields.io/badge/Download-for%20macOS-111827?logo=apple)](https://github.com/bsplt/Ponder-Note/releases/latest/download/Ponder-macOS.zip)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

# Ponder

**Ponder is a fast, keyboard-friendly macOS notes app for people who keep notes in Markdown and want one aggregated todo view across all notes.**

You keep your own local `.md` files, stay sovereign from subscription services, and choose your own sync method (for example iCloud Drive, Dropbox, or Git).

https://github.com/user-attachments/assets/988312f1-f63b-414a-ba5e-a1bb9a8e05a2

## Download

- Latest release: [GitHub Releases](https://github.com/bsplt/Ponder-Note/releases)
- Platform: macOS desktop app

## Install (macOS)

1. Download the latest release asset from the Releases page.
2. Open the downloaded archive and move `Ponder.app` to your `Applications` folder.
3. Start Ponder.
4. If macOS blocks first launch, right-click the app, choose **Open**, then confirm.

## What Ponder Does

- Keeps your notes as plain `.md` files in your own folders.
- Lets you switch between up to 9 workspaces instantly.
- Searches titles and full note content from one overview.
- Aggregates open markdown todos from all notes into one focused list.
- Lets you jump from a todo to its source note and back to the todo list quickly.
- Toggles todos and writes changes back to the source note, so notes and task view stay in sync.

## Why the Todo Workflow Works

Ponder is built for back-and-forth work: capture context in notes, execute from one aggregated todo list, jump back into the source note when needed, then continue in the list. You do not lose context and you do not need to manually sync task lists.

## Who Ponder Is For

- People who want Markdown notes as real files on disk.
- Users who prefer keyboard-driven note and task workflows.
- Anyone who wants flexible syncing via their own tools (Drive or Git).

## Who Ponder Is Not For

- Teams looking for a hosted, multi-user SaaS workspace.
- Users who want cloud-only storage managed by the app vendor.
- People who need built-in collaboration features like live co-editing.

## Quick Usage

1. Open **Workspaces** and connect a folder. This folder is your workspace root where Ponder stores and reads your `.md` note files.
2. Create or open a note in **Overview**.
3. Write in Markdown and add tags, including markdown checkboxes for tasks.
4. Open **Todos** to work from one aggregated list across all notes.
5. Jump into source notes, edit context, and continue directly in the todo list.

## Keyboard Essentials

- `o`: Overview
- `w`: Workspaces
- `t`: Todos
- `n`: New note
- `?` or `h`: Shortcuts help
- `Esc`: Back/close current input mode

## Data and Privacy

- Your notes stay in your selected local folders.
- Ponder metadata is stored per workspace in `.ponder/`.
- Deletions are soft deletes to `deleted/`.
- Sync is your choice: use any file sync service or Git workflow you prefer.

## Screenshots

![Ponder Overview](docs/screenshots/Overview.webp)

![Editor Preview](docs/screenshots/Editor-Preview.webp)

![Editor Editing](docs/screenshots/Editor-Editing.webp)

![Todo List](docs/screenshots/Todo-List.webp)

## FAQ and Compatibility

### What platforms are supported?

Ponder is currently distributed as a macOS desktop app via GitHub Releases.

### Where are my notes stored?

In the workspace folder you choose. Ponder reads and writes your `.md` files there directly.

### Can I sync notes with iCloud/Dropbox/Google Drive?

Yes. Because notes are normal local files, you can use any folder-sync provider you prefer.

### Can I sync with Git instead?

Yes. Many users keep their workspace folder in a Git repo and use their own Git workflow.

## Support

- Bug reports and feature requests: [GitHub Issues](https://github.com/bsplt/Ponder-Note/issues)

## Developer Docs

Technical docs for build, CI, and release publishing are in:

- `docs/developer/BUILD_AND_RELEASE.md`

## License

This project is licensed under the MIT License. See `LICENSE`.
