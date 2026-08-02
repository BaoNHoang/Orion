# Contributing to Orion

## Development flow

1. Update local branches with `git switch develop` and `git pull`.
2. Create a branch named `feature/<topic>`, `fix/<topic>`, or `chore/<topic>`.
3. Run `npm.cmd run lint` and `npm.cmd run build` before pushing.
4. Open a pull request into `develop` using the repository template.
5. Merge `develop` into `main` through a release pull request.

Direct feature commits to `main` should be avoided. Urgent production repairs may use `hotfix/*` branches with a pull request into `main`, followed by a back-merge into `develop`.

## Privacy requirements

- Never commit `orion.db`, environment files, API keys, raw voice recordings, or personal exports.
- Treat search queries, memories, and conversation transcripts as private user data.
- New permissions must be explicit, narrow, and visible to the user.

## Pull-request standard

Every pull request should explain the user-visible change, identify privacy or security implications, and include verification evidence.
