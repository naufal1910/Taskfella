# Taskfella project documents

The repository preserves the approved source documents and phase verification records as committed product and implementation references:

- [Taskfella MVP product specification](specification/taskfella-mvp-design.md)
- [Taskfella MVP analysis and implementation plan](implementation/taskfella-analysis.md)

The public roadmap is maintained at <https://github.com/users/naufal1910/projects/4>. Phase 0 tracks [GitHub issue #2](https://github.com/naufal1910/Taskfella/issues/2), Phase 1A tracks [GitHub issue #13](https://github.com/naufal1910/Taskfella/issues/13), Phase 1B tracks [GitHub issue #14](https://github.com/naufal1910/Taskfella/issues/14), Phase 1C tracks [GitHub issue #15](https://github.com/naufal1910/Taskfella/issues/15), Phase 1D tracks [GitHub issue #16](https://github.com/naufal1910/Taskfella/issues/16), and integrated Phase 1 verification tracks [GitHub issue #17](https://github.com/naufal1910/Taskfella/issues/17).

Foundation operational guidance is in the root [README](../README.md) and [CONTRIBUTING](../CONTRIBUTING.md). The canonical visual contract is [DESIGN.md](../DESIGN.md); its validator command and zero-error/zero-warning requirement are maintained in [CONTRIBUTING](../CONTRIBUTING.md). Phase 1A authentication-foundation decisions are documented in [taskfella-phase1a-auth.md](implementation/taskfella-phase1a-auth.md), the Phase 1B email/password lifecycle is documented in [taskfella-phase1b-auth.md](implementation/taskfella-phase1b-auth.md), Phase 1C Google OAuth/linking behavior is documented in [taskfella-phase1c-google-oauth.md](implementation/taskfella-phase1c-google-oauth.md), the Phase 1D account settings and appearance security boundary is recorded in [taskfella-phase1d-settings.md](implementation/taskfella-phase1d-settings.md), the Calm Execution authentication UI implementation is documented in [taskfella-phase1-auth-ui.md](implementation/taskfella-phase1-auth-ui.md), and the integrated browser/security/readiness evidence is recorded in [taskfella-phase1e-verification.md](implementation/taskfella-phase1e-verification.md). The source documents remain unchanged when copied here; repository-specific implementation notes belong alongside the code and should not silently revise the approved product scope.

## Phase 2

- [Projects, boards, workflow, and WIP implementation record](implementation/taskfella-phase2-projects-boards.md)
- [Phase 2 issue #4](https://github.com/naufal1910/Taskfella/issues/4)

Phase 2 adds the account-owned board foundation and transactional WIP boundary.

## Phase 3 (implementation under review)

- [Tasks and board execution implementation record](implementation/taskfella-phase3-tasks.md)
- [Phase 3 issue #5](https://github.com/naufal1910/Taskfella/issues/5)

Phase 3 adds account-isolated tasks, labels, subtasks, notes, ordering, movement, search/filtering, semantic completion, Trash, restore fallbacks, and responsive non-drag board execution. It is not marked delivered until its PR merges. Focus timers, time tracking, analytics, exports, and collaboration remain later phases.
