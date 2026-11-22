# OMP-UI task artifact cleanup policy

A card's result is its summary. Anything else an agent leaves behind after the task (profiles, throwaway tests, Docker
containers, scratch notes, stray processes) pollutes diffs and pull requests, fills the disk, can leak data, and
confuses later runs on the same card or project. So agents clean up after themselves.

This policy covers temporary artifacts only: things created just to carry out the task. It does not cover permanent
project infrastructure such as `tests/`, `e2e/`, `Dockerfile` or `docker-compose.yml`, nor changes the task asked for.

## Rule

Once the task is done — the work is verified (Testing passed), before any commit, push or PR the task asks for, and
before the final summary — the agent removes every temporary artifact it created for the task. Only the result is
kept. Cleaning up before committing keeps throwaway files out of the commit or PR.

## What gets cleaned up

Anything created specifically to execute the task:

| Category | Examples | How to remove |
| --- | --- | --- |
| Analytics and profiling | CPU/heap profiles (`*.cpuprofile`, `*.heapsnapshot`), traces, benchmark output, bundle/size analysis, Lighthouse reports, ad-hoc stats/CSV/JSON exports | Delete the files |
| Testing files | Throwaway scripts and tests written only to prove a change, generated fixtures/test data, test-runner output the run created (`test-results/`, `playwright-report/`, `coverage/`, `.e2e-data/`, `*.log`) | Delete the files and folders |
| Docker artifacts | Containers, compose stacks, volumes, networks, and images built (or pulled solely) for the task | Mark them at start (`docker compose -p task-<card id>`, `--label omp-ui.task=<card id>` on `docker run`/`create`/`build`/`volume create`/`network create`); remove only those: `docker compose -p task-<card id> down -v --remove-orphans`, `docker rm -f`, `docker volume rm`, `docker network rm`, `docker image rm` |
| Scratch files | Notes, plans, debug logs, dumps, downloads, copies/exports of data, temp configs, `*.bak`, patches | Delete the `mktemp -d` folder and any in-repo temp files |
| Background processes | Dev servers, watchers, browsers, tunnels, background jobs the agent started | Stop them |
| Card files folder | Work-in-progress files the agent saved there that the final Report does not link | Delete them |
| Git leftovers | Temporary branches, stashes and extra worktrees the agent made | Delete them; never the project's own branches, or the refs under `refs/omp-ui/` that OMP-UI manages |

## Docker containers

Every container, compose stack, volume, network and image the agent starts only for the task is marked with the card:
the label `omp-ui.task=<card id>` (`docker run`, `docker create`, `docker build`, `docker volume create`,
`docker network create`) or the compose project `task-<card id>` (lowercased; `docker compose -p task-<card id>`).
Containers inherit their image's labels, so a container started from a marked image counts as marked too and is removed
with it.

- **Agent.** Before finishing, the agent stops and removes them, then checks that
  `docker ps -a --filter label=omp-ui.task=<card id>` and
  `docker ps -a --filter label=com.docker.compose.project=task-<card id>` list nothing.
- **Safety net.** When a run moves the card to Done (a manual move does not trigger it), and when the card or its
  project is deleted (in the background, one card at a time), OMP-UI removes the marked leftovers: containers with
  their anonymous volumes first, then networks, volumes, and images (each tag removed without force, so an image another
  container still uses stays). After a run it logs `Removed leftover Docker resources: …` in the card's run log.
- **Unmarked resources are never touched**: the user's own containers, volumes and images, and other cards'. The one
  exception is inheritance: a container started from a marked image counts as marked.
- **Kept containers.** A container the task asks to leave running is a result, not a leftover: the agent does not mark
  the container or the image it runs from, and names it in the Report.

## What is kept

- The result summary: the run's final message ending with `## Report` (posted on the card, listed on the Artifacts
  page).
- Files the Report links in the card's files folder (screenshots, test reports, exports) — they are part of the result.
- The changes the task asked for: code, docs, config, and tests meant to stay (e.g. regression tests).

## Never delete

- Anything that existed before the task's first run (leftovers of an interrupted earlier run of this same task are not
  protected).
- Files the user uploaded.
- Board shared files other cards still need, other cards' files, and other cards' in-progress changes in a shared
  working tree.
- Docker containers, volumes, networks and images that already existed or that you did not create (a plain
  `docker compose up` in the user's checkout reuses the user's own compose project and volumes).
- Permanent project infrastructure: `tests/`, `e2e/`, `Dockerfile`, `docker-compose.yml`, `.env*`, OMP-UI's data
  folder (`DATA_DIR`, default `data/`), except unlinked work-in-progress files you saved in your own card folder.
- OMP-UI's git refs (`refs/omp-ui/…`: checkpoints and run snapshots).

## When

- At the end of every run that finishes the work, before committing or pushing and before the final summary, including
  feedback rounds, for what that round created.
- Interrupted or failed run: the run that resumes and finishes the task cleans up the leftovers.

## Workflow

1. **Start.**
   - Put scratch files in a folder from `mktemp -d`, outside the project.
   - Mark Docker resources with the card so they are easy to find and remove: compose `-p task-<card id>`,
     `--label omp-ui.task=<card id>`, and names like `--name task-<card id>-db`.
   - Note every background process you start.
2. **Finish** (after verification passes, before any commit or push).
   - Stop the processes you started.
   - Remove the Docker resources you made: `docker compose -p task-<card id> down -v --remove-orphans`, `docker rm -f`,
     `docker volume rm`, `docker network rm`, `docker image rm`. Check that
     `docker ps -a --filter label=omp-ui.task=<card id>` and
     `docker ps -a --filter label=com.docker.compose.project=task-<card id>` list nothing.
   - Delete the scratch folder and in-repo temp files.
   - Check `git status --short` shows none of your own leftovers, and `git status --short --ignored` shows no new
     ignored output you created. Other cards' agents share this working tree: leave
     changes you did not make.
   - Delete unlinked work-in-progress files you saved in the card folder.
3. **Report.** Commit/push if the task asks, then write the summary and `## Report`, linking the kept deliverables.

## When unsure

- Needed by the result (a requested change, or linked by the Report)? Keep.
- Existed before the task's first run, or made by someone else? Keep.
- Otherwise, if you created it, delete it.
- Still unsure whether something is meant to stay? Keep it.

## How it is enforced

- **`AGENTS.md` convention, no added prompt.** The policy is the repo's convention: the root [`AGENTS.md`](../AGENTS.md),
  which omp loads for agents working in this repo, points here. OMP-UI does not add a cleanup instruction to any
  agent prompt; what it enforces itself is the server-side removal of leftover Docker resources (below).
- **No server-side file deletion, on purpose.** The card folder holds user uploads and files feedback refers to
  (`> re: <path>`), and Done cards can reopen, so the server cannot tell leftovers from results. The agent that made
  the files is the one that knows. Docker resources are different because the card's label attributes them exactly.
- **Docker safety net.** When a run moves the card to Done (a manual move does not trigger it), OMP-UI removes the
  Docker resources left with the card's label or compose project, including containers started from a marked image,
  and nothing else (`removeTaskDockerResources` in [`lib/docker.ts`](../lib/docker.ts); names in
  [`lib/task-docker.ts`](../lib/task-docker.ts)). When the card or its project is deleted, `queueTaskDockerCleanup`
  does the same in the background, one card at a time, so the delete does not wait for Docker.
- **OMP-UI's own data is separate.** Settings → Data cleanup and Stats → Optimize remove files (and leftover worktrees)
  of deleted cards; that is OMP-UI housekeeping, separate from task cleanup.
- **Review.** Reviewers spot leftovers in the card's Review tab and use **Request changes**.
