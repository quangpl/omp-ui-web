# OMP-UI: the OMP web UI, OMP kanban board and OMP workflow, self-hosted

[![npm version](https://img.shields.io/npm/v/omp-ui.svg)](https://www.npmjs.com/package/omp-ui)
[![CI](https://github.com/quangpl/omp-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/quangpl/omp-ui/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![node >=22.13](https://img.shields.io/badge/node-%3E%3D22.13-brightgreen.svg)](https://nodejs.org)

**OMP-UI is the self-hosted OMP UI for [omp](https://omp.sh/docs) (oh-my-pi), the AI coding agent.** It gives omp a web interface: an OMP kanban board where each card is a task, an OMP workflow that takes every card from plan to pull request, and an OMP web dashboard you can open from your desktop or phone. Self-host OMP-UI on your own machine or server with one command, `npx omp-ui`.

**Website:** [omp-ui.quang.asia](https://omp-ui.quang.asia) · **npm package:** [omp-ui on npm](https://www.npmjs.com/package/omp-ui) · **Releases:** [GitHub Releases](https://github.com/quangpl/omp-ui/releases)

![OMP UI: the OMP kanban board with cards in To do, In progress and Done](docs/images/board.png)

## Features

- **OMP kanban board.** Cards move through To do, In progress and Done as omp agents work on them.
- **OMP workflow from plan to pull request.** Describe the idea, an omp agent builds it, you review it through comments, then ship it as a PR or a push. Conflicts with the base branch are resolved automatically.
- **OMP web UI on any device.** Watch agent output live in the browser, on desktop or phone.
- **Self-host OMP in one command.** `npx omp-ui` starts it under pm2 with SQLite by default. Docker is supported too.
- **Developer-friendly.** A CLI, a [REST API](docs/API.md), keyboard shortcuts, and GitHub pull requests or GitLab merge requests.
- **Schedulers and stats.** Recurring cards on a cron schedule, plus usage and cost stats.
- **Cluster mode.** Spread agent runs across several machines ([details](docs/CLUSTER.md)).
- **Open source.** MIT licensed.

## Screenshots

![OMP-UI kanban board for omp AI coding agents](docs/images/board.png)

*The board: cards move through To do, In progress and Done as agents work on them.*

![OMP-UI card detail with agent feedback comments](docs/images/card.png)

*Card detail: steer the agent with feedback comments and follow its run live.*

![OMP-UI stats page with agents running, AI spend and token usage](docs/images/stats.png)

*Stats: running agents, AI spend, token usage and host health.*

![OMP-UI new task dialog for creating a card from free text](docs/images/new-task.png)

*New task: describe the work in plain text and the agent starts right away.*

<img src="docs/images/mobile.png" alt="OMP-UI mobile kanban board on a phone" width="300">

*Mobile: follow and steer your agents from a phone.*

## Requirements

- Node.js 22.13 or newer
- omp, installed and signed in:

```sh
curl -fsSL https://omp.sh/install | sh
omp            # run once and sign in to an AI provider
```

## Quick start: self-host OMP-UI

```sh
npx omp-ui
```

This one command sets everything up, starts OMP-UI in the background with pm2 and prints its URL. It asks for a password for the `admin` account, or generates one and prints it. Open the URL, sign in and follow the setup wizard.

To install it permanently:

```sh
npm i -g omp-ui
omp-ui
```

Or install a build straight from [GitHub Releases](https://github.com/quangpl/omp-ui/releases) (every push to `main` publishes one):

```sh
npm i -g https://github.com/quangpl/omp-ui/releases/latest/download/omp-ui.tgz   # latest release
npm i -g https://github.com/quangpl/omp-ui/releases/download/nightly/omp-ui.tgz  # latest main build
```

Settings and data live in `~/.omp-ui`. SQLite is the default database, so you don't need to set one up.

If npm's global bin folder is not on your `PATH` (common with Homebrew's `node@22`), the install links `omp-ui` into a folder that is, such as `/usr/local/bin` or `~/.local/bin`, and prints a one-line command that adds the folder to your shell config and reloads it. Run that command and `omp-ui` works right away. You can also run it yourself:

```sh
echo "export PATH=\"$(npm prefix -g)/bin:\$PATH\"" >> ~/.zshrc && source ~/.zshrc
```

## Basic commands

| Command | What it does |
| --- | --- |
| `omp-ui` | Set up and start OMP-UI |
| `omp-ui status` | Check whether it is running and show its URL |
| `omp-ui stop` / `start` / `restart` | Stop, start or restart the server |
| `omp-ui logs -f` | Follow the server log |
| `omp-ui open` | Open OMP-UI in your browser |
| `omp-ui config set port 8080` | Change a setting (`port`, `data-dir`, `db-url`), then run `restart` |
| `omp-ui doctor` | Check Node.js, omp, git, gh and pm2 |
| `omp-ui update` | Update to the latest version and restart |
| `omp-ui help` | List every command |

## The OMP workflow on the kanban board

1. **Create a project.** Pick a folder or clone a Git repository.
2. **Add a card.** Describe the task in your own words, and an agent starts working on it.
3. **Give feedback.** Comment on the card. The agent reads your comments and keeps going.
4. **Ship it.** Click **Create PR**, **Push to main** or **Push to current branch**.

## Open the OMP web UI from anywhere

OMP-UI runs commands on your machine. Before exposing it, set a strong admin password with `omp-ui passwd`.

### Tailscale (private, recommended)

Reach OMP-UI only from your own devices, over HTTPS:

```sh
tailscale serve --bg 3000
```

Open `https://<machine-name>.<tailnet>.ts.net` on any device in your tailnet. To share it with people outside your tailnet, use `tailscale funnel --bg 3000` instead.

### Cloudflare Tunnel

To get a temporary public link right away:

```sh
omp-ui public          # prints an https://….trycloudflare.com link
omp-ui public stop
```

The link changes every time it starts. For a permanent address on your own domain, create a [named Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) that points to `http://localhost:3000`.

If you use Tailscale, Cloudflare or another proxy, add `VINEXT_TRUST_PROXY=1` to `~/.omp-ui/.env`, then run `omp-ui restart`.

## Self-host OMP-UI with Docker

```sh
docker compose up -d   # then open http://localhost:3000
```

## FAQ

**What is OMP-UI?**
A web UI for omp. It runs omp agents on cards from an OMP kanban board and shows their work in the browser.

**Is there an official OMP UI or OMP web interface?**
omp itself is a terminal tool. OMP-UI is an open-source OMP web UI built on top of it.

**Can I self-host OMP?**
Yes. OMP-UI runs on your own machine or server: `npx omp-ui`, pm2 or Docker. Your code and data stay with you.

**How does the OMP workflow work?**
Plan, build, review, ship: write a card, an omp agent builds it in your repository, you review it through comments, then you open a pull request or push.

## Learn more

- [Advanced guide](docs/ADVANCED.md): every feature, the full CLI, PM2, systemd, Docker, databases, clustering and configuration.
- [API reference](docs/API.md)
- [Cluster mode](docs/CLUSTER.md)
- [Changelog](CHANGELOG.md)
- [Security policy](SECURITY.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).

```sh
pnpm install
pnpm dev
pnpm test
```

## License

[MIT](LICENSE)
