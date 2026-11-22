# OMP-UI cluster mode

Cluster mode spreads card agents over several machines. One omp-ui server is the **primary**: it keeps
the database, serves the UI, runs the agent queue and dispatches runs. Every other machine is a
**replica node**: it runs cards for the primary, keeps a replicated copy of the primary's state, and
takes over as primary when the primary goes down. Cluster mode is opt-in; a server that never enables
it (`standalone`) behaves exactly as before.

## Setting it up

1. On the machine that should coordinate, open **Settings → Cluster** and turn on **Enable cluster
   mode**. This server becomes the primary and gets a join token.
2. Copy the join command shown there and run it on each machine you want to add:

   ```sh
   curl -fsSL http://<primary>:3000/api/v1/cluster/join | sh -s -- <token>
   ```

   Once the node has joined it keeps running in the background (log `~/.omp-ui-node/omp-ui-node.log`,
   pid file next to it) and the command exits with a summary; if the node does not become ready it
   is stopped again and the command shows the error and the end of the log. Add `--service` to install
   it as a systemd user service instead (starts on boot, restarts on failure), or `--foreground` to keep
   it attached to the terminal. Output is colored on a terminal (`NO_COLOR=1` turns that off); package
   manager and download output goes to `~/.omp-ui-node/join.log`.

The command makes a bare machine ready in one go (only `curl` or `wget` must exist to run it). It
prints each step and stops with a clear message when something cannot be fixed:

1. checks the OS and CPU (Linux or macOS; glibc — Alpine/musl is not supported) and whether it has
   root rights (root, or `sudo` without a password);
2. installs missing system packages in one call with the system package manager (apt, dnf, yum,
   zypper, pacman; Homebrew on macOS): `tar`, `gzip`, `ca-certificates` and `git`;
3. checks that the primary answers and has cluster mode on;
4. installs Node.js with `npm`/`npx`/`corepack` (the official build of the primary's Node version,
   or the primary's own Node binary when nodejs.org is unreachable) and enables `pnpm`/`yarn` shims;
5. downloads the primary's omp binary (checksum-verified) where the node's server runs it from;
6. installs the primary's omp-ui build, writes the node's settings (mode 600) and starts it;
7. waits until the node has joined and is connected to the primary, then reports what it installed —
   or shows the node's log. Every 15 s it prints the node's role and link state (`replica,
   connecting`) and, in the background and `--service` modes, the node's latest `[cluster]` log line.

Running the join command again on a machine that already is a node makes it a replica of the
primary named in the command, whatever it was before: a stale replica takes the new token and
address, and a node left as primary by a failover steps down (its database is backed up to
`DATA_DIR/cluster/backups/` first). A plain restart of the node never joins again.

| Needed on the node | Where it comes from |
| --- | --- |
| git, tar, gzip, CA certificates | installed by the join command with root rights |
| Node.js, npm, npx, pnpm/yarn (corepack) | nodejs.org (the primary's version), else the primary's Node binary |
| omp-ui | the primary's build (`/api/v1/cluster/bundle`) |
| omp | the primary's omp binary (same OS/architecture), verified by SHA-256, on the node's `PATH` |
| omp configuration, credentials, skills, extensions, rules, MCP servers | a copy of the primary's omp agent dir (`~/.omp/agent`), refreshed before every run |
| AI provider keys and MCP secrets | passed with every run (Settings → AI Providers on the primary) |
| git identity and HTTPS credentials, GitHub/GitLab/npm tokens, `.npmrc` | the primary's auth pack (below) |
| omp-ui sign-ins | replicated users and session secret: the primary's accounts work on the node |
| Project files, card files, omp sessions | synced before the run, changes streamed back while it runs |

**Auth pack.** The primary bundles what agents need to authenticate and ships it over the encrypted
channel into the node's `DATA_DIR/cluster/auth` (mode 700, files 600; the node's own home directory
is never touched): a git config with the primary's `user.name`/`user.email` (after the node's own
`~/.gitconfig`, which stays in effect) and a credential store holding the primary's
`~/.git-credentials` plus its GitHub token (from `GH_TOKEN`/`GITHUB_TOKEN` or `gh auth token`), and a
copy of `~/.npmrc`. Agents on the node get `GIT_CONFIG_GLOBAL`, `NPM_CONFIG_USERCONFIG`, `GH_TOKEN`/
`GITHUB_TOKEN`, `GITLAB_TOKEN`/`GL_TOKEN` and `NPM_TOKEN` accordingly, so commits carry the same author
as on the primary and HTTPS pushes and private packages work. SSH private keys are never copied: git
over SSH on a node uses the node's own keys.

Language runtimes other than Node.js and tools such as Docker are not installed: add them on the node
when your projects need them.

Environment variables of the join script: `OMP_UI_NODE_DIR` (default `~/.omp-ui-node`),
`OMP_UI_PORT` (the node's web port, default 3000), `OMP_UI_CLUSTER_PORT` (cluster port, default 7790).

A server that already runs omp-ui can join from **Settings → Cluster → Join a cluster** (primary URL +
token, **Test connection**, **Join**). Its own boards and data are replaced by the primary's (the
database is backed up to `DATA_DIR/cluster/backups/` first) and it restarts as a replica.

## How runs are distributed

The primary's queue limit becomes the cluster's: its own limit (when **Run cards on this machine too**
is on) plus the slots of every online node that can run omp and takes new cards. A node's slots follow
the same rule as a standalone server's limit (`maxConcurrentAgents`: `auto` from its cores and free
memory, or the fixed number per node).

Nodes come first, so the primary keeps its headroom for coordinating the cluster: a card goes to a
node with a free slot, and the primary takes cards only when no node has one. Among the nodes, each
card goes to the one that is least busy once it takes the card — the share of its agent slots in use
plus terms for its CPU load per core and its memory use — so nodes fill in proportion to their
capacity. The node that ran the card's previous run only wins a tie.

A node gets no new cards (its running cards keep running) while:

- its last status report is older than 15 s (3 missed reports), it fails the primary's health checks,
  or it is being restarted;
- its resource guard holds (memory or CPU at or above the `OMP_UI_MEMORY_HOLD_PCT` /
  `OMP_UI_CPU_HOLD_PCT` set on that node) or the load guard trips. Every node runs its own resource
  guard and reports its holds with its status; for a node of an older version that does not, the
  primary applies its own memory hold % to the memory use the node reports.

When neither a node nor the primary (held by its own guard, or **Run cards on this machine too** off)
can take a card, it stays queued and starts as soon as a slot frees or a node is available again.

A remote run is executed exactly like a local one: the primary keeps the whole run logic (prompt,
run guards, comments, database) and only the `omp` process runs on the node.
omp's RPC stream is relayed over the cluster channel; files are synced in both directions:

- before omp starts, the node's copy of the run's folders (project folders, card and board files,
  session dir) is brought up to date — only changed files are sent;
- while the agent works, changed files are pushed back every few seconds, and always before the agent
  finishes, so the primary sees the same files as after a local run.

Cards that run on the same node at once share that node's copy of a folder they both use (the
project folder), just
like two local runs share a folder: a second card never resets files the first one is changing.

The relay is light: on a loopback measurement an omp message takes about 0.1 ms longer per round trip
than over a local pipe, and file transfers run at well over 100 MiB/s, so a node's network link, not
the protocol, sets the pace.

The UI shows where each card runs: while a card runs, its board card, its details and every agent on
the Visualize page (control room, factory floor, worksites) name the machine; a card's
run report and details say which machine ran it.

## Failures and failover

- **A node goes offline**: the primary marks it offline and posts a notice. Its runs wait 30 s for the
  node to come back (the node keeps omp running and buffers its output, so a short network blip loses
  nothing); after that the run fails with "…; rescheduled" and the card is queued again (no automatic
  retry is used), so it resumes its omp session on whichever machine is free, the same node included
  once it is back.
- **The primary goes down**: replicas notice the lost connection. After **failover timeout** seconds
  (Settings → Cluster, default 20) they hold an election: the reachable replica with the freshest
  replicated state is promoted. It becomes the primary under a higher *term*, resumes interrupted cards
  from the replicated database and session files, and announces itself to the other nodes, which
  follow it. Notices about every step appear in the UI of each node.
- **The original primary comes back** (failback): the machine that enabled cluster mode is the
  cluster's *home primary*. When it returns it first rejoins as a replica of the interim primary (its
  own database is backed up; changes it made while cut off are not merged) and receives the current
  state. Once it has stayed connected for 30 s and caught up, the interim primary starts no new runs,
  lets running ones finish (up to 2 minutes), ships a final snapshot and hands control back: the home
  primary is promoted under a new term and the interim primary becomes a replica again. Cards still
  running at the handover are resumed by the home primary. Any other returning primary simply stays a
  replica of the current primary.
- **Two primaries** (the interim primary and the original one restarted while the other was down):
  whichever starts second probes the members; it steps down to a primary of a higher term, or tells a
  primary of a lower term to step down. Failback then hands control back to the home primary.
- **Reconnecting**: a replica retries the primary every 1 s, doubling up to 10 s, and logs each failed
  attempt with its reason (`[cluster] connecting to the primary failed (attempt 3): …; retrying in
  4 s`), at most once a minute while the reason stays the same. The link state (`connected`,
  `connecting`, `electing`) is also on the public `GET /api/v1/cluster/info`.
- **Auto-restart** (a replica stays cut off): every replica runs a disconnect watchdog that checks
  its link every 5 s. Once it has had no session with its primary for **Restart after** seconds
  (Settings → Cluster on the primary, group **Replica auto-restart**; default 300, 60–86400, never
  less than the failover timeout + 60 s) it restarts its server through `bin/supervisor.mjs` (exit
  code 75), which starts it again to connect from a fresh process. Every further restart in a row
  without a session doubles the wait, up to 1 hour unless the setting is longer; the count is kept in
  `node.json` (`autoRestarts`) and a session resets it. The clock runs apart from the failover: the
  election always comes first, and following another primary after it does not reset the clock —
  only a session does. The restarted server reports why to the primary, which posts "Node X was
  restarted on its machine (auto-restart: no connection to the primary p1 for 5 min (last error: …))
  and is back online" (the server writes the reason to the file named by `OMP_UI_RESTART_REASON_FILE`
  in a private 0700 temp dir per supervisor; the supervisor passes it on as `OMP_UI_RESTART_REASON`).
  A node running without the supervisor (nodes started by the join command run under it) never exits:
  it posts one warning notice per disconnect episode and keeps reconnecting. The watchdog also starts
  a connect loop that has stopped again (one notice, then with backoff). The switch and the wait
  default to the server's `OMP_UI_CLUSTER_AUTO_RESTART` (`true`/`1`/`yes`/`on`, `false`/`0`/`no`/
  `off`) and `OMP_UI_CLUSTER_RESTART_AFTER_SEC`. This is apart from the primary's auto-healing, which
  asks an unhealthy node to restart.
- **Restoring a replica by hand**: Settings → Cluster on a replica has **Reconnect** (connect to the
  primary now, the retry backoff starts over) and **Restart node** (restart the server through the
  supervisor; refused on a node without it). The primary's notice then names "restore requested by an
  admin". Both are `POST /api/v1/cluster/restore` (admin) with `{ restart: false | true }`.

Replication is asynchronous: the database is shipped every 15 s when it changed, project and card
files every 60 s. A promotion can therefore lose up to that much work; interrupted cards are resumed.
With only two machines a network split cannot be told apart from a crash: both sides may act as
primary until they see each other again, when the lower term steps down.

## Security

- Nodes authenticate with the join token through a mutual HMAC-SHA256 challenge (the token itself is
  never sent, and a node also checks that the primary knows the token). Every message after that is
  encrypted with AES-256-GCM using per-direction keys derived from the token and both sides' nonces,
  so AI provider keys and credentials never cross the network in clear text, even over plain HTTP.
- Rotating the token (Settings → Cluster) keeps connected nodes in and locks out everyone else.
- Changes a node sends back can only touch the folders of its own runs. Paths are validated, symlinks
  must stay inside their folder, and git configuration, hooks and repository pointers (`.git/config`,
  `config.worktree`, `commondir`, `.git/hooks/`, worktree `.git` files) are never accepted from a node.
- Replicas get the primary's `AUTH_SECRET` and credentials key (file or `CREDENTIALS_KEY`), so sessions
  and saved secrets keep working after a promotion; agents never see either. `node.json` and copied
  keys are written with mode 0600.
- A replica accepts no changes except sign-in and cluster actions; everything else answers 409 and
  names the primary.
- The join script, the app bundle and the Node/omp binaries are public downloads (they contain no
  secrets: `.env` files and the data dir are never bundled); joining requires the token.

## Ports

| Port | Purpose |
| --- | --- |
| `PORT` (3000) | web UI and API; the join script downloads from it |
| `OMP_UI_CLUSTER_PORT` (7790) | cluster channel (TCP), on every node |

Nodes connect to the cluster port directly when they can (fastest). When it is not reachable — the
primary is published through a reverse proxy or a tunnel such as Cloudflare Tunnel, which only pass
HTTPS — they fall back to the same encrypted channel as a WebSocket on the web URL
(`wss://<primary>/api/v1/cluster/ws`), automatically and without extra setup; the node remembers
which way worked. The proxy must allow WebSockets (Cloudflare does).

When a machine starts cluster mode (enable, join, or a restart in a cluster role) it opens its
cluster port in an active host firewall with root rights: `ufw allow <port>/tcp` or
`firewall-cmd --add-port=<port>/tcp` (runtime and permanent), run directly as root or through
`sudo -n` (it never asks for a password). Without root rights it posts a notice with the command to
run. Cloud firewalls and security groups are outside the machine: open the port there yourself, or
rely on the WebSocket fallback.

## Limits

- Binaries are shared only between machines of the same OS and architecture; a node of another
  platform needs omp installed locally.
- Replicas serve a read-only UI; changes are made on the primary.
- OAuth subscriptions whose refresh tokens rotate may ask for a new login if two machines refresh the
  same token at once.
