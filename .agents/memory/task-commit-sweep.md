---
name: Task commits sweep the whole working tree
description: markTaskComplete commits every uncommitted working-tree change, not just your edits
---
The task-completion commit includes ALL uncommitted working-tree changes, including leftovers from prior sessions (e.g. an iOS pbxproj edit, dep pins, config bumps). Reviews then reject the task for "unrelated regressions."

**Why:** A task completion was rejected three times because pre-existing uncommitted changes (Live Activity target removal in project.pbxproj, Zeroconf disable, auth retry) rode along with unrelated UI work.

**How to apply:** Before the first markTaskComplete of a session, run `git status`/`git diff --stat` and revert or intentionally adopt any pre-existing modifications. Also: the committed `ios/` tree is uploaded directly to EAS (no prebuild), so any pbxproj target must have its source files committed too (see .gitignore whitelist in artifacts/knowyourpit).
