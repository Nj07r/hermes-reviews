# Getting started

In this tutorial, we clone Reviews, build the Desktop bundle from source, run the backend tests and validate the plugin with Hermes. At the end we have a clean checkout that Hermes accepts as a plugin.

## Before we start

We need these tools on the machine:

- `git` with access to `github.com/Nj07r/hermes-reviews` (the repository is private).
- Node.js and npm. This tutorial used Node v22.13.1 and npm 10.9.2.
- A Hermes agent install, with the `hermes` CLI on `PATH` and its Python at `~/.hermes/hermes-agent/venv/bin/python`.

## 1. Clone the repository

Run this command in a folder of your choice:

```bash
git clone https://github.com/Nj07r/hermes-reviews.git
```

The output should look like this:

```text
Cloning into 'hermes-reviews'...
```

Go into the new folder:

```bash
cd hermes-reviews
```

## 2. Install the build tools

Install the npm packages:

```bash
npm install
```

The output should look like this:

```text
added 57 packages, and audited 58 packages in 2s

28 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

These packages are build tools only: `esbuild`, `@pierre/diffs` and `@pierre/trees` (see `package.json`).

## 3. Build the Desktop bundle

Build `desktop/plugin.js` from `desktop/src`:

```bash
npm run build
```

The output should look like this:

```text
> build
> node scripts/build.mjs

desktop/plugin.js 2.88 MB
```

Check the working tree:

```bash
git status --short
```

This command prints nothing. Our build is the same as the committed `desktop/plugin.js`. If the command prints ` M desktop/plugin.js`, the new build differs from the committed file.

## 4. Run the backend tests

Run the unit tests with the Python of the Hermes agent:

```bash
~/.hermes/hermes-agent/venv/bin/python -m unittest discover -s tests
```

The output should look like this:

```text
...............
----------------------------------------------------------------------
Ran 15 tests in 0.005s

OK
```

The tests replace `gh` with mocks, so they need no network and no GitHub sign-in.

## 5. Validate the plugin

Ask Hermes to check the plugin:

```bash
hermes plugins validate .
```

The output should look like this:

```text
✓ manifest — plugin.yaml parses
✓ manifest fields — name, version, description present
✓ requires_hermes — spec '>=0.23.1' parses
✓ config schema — shape valid
✓ requires_env — all entries UPPER_SNAKE
✓ oauth — not declared
✓ loadable — entry: __init__.py, desktop/plugin.js
✓ python dependencies — none declared
✓ capability probe — register() ran in isolation
✓ declared tools — matches registrations
✓ declared hooks — matches registrations
✓ declared middleware — matches registrations
✓ built-in tool collisions — no tools to check
✓ security scan — safe
✓ no core override — no runtime rebinds of Hermes core
✓ desktop surface — stays inside the plugin SDK surface
◆ Isolation — runs in the plugin host (plugins.isolation: host)

Validation passed.
```

Notice the line `loadable`. Hermes found both halves of the plugin: `__init__.py` for the agent and `desktop/plugin.js` for Desktop.

## What we did

We cloned Reviews, built the same Desktop bundle that the repository ships, ran all 15 backend tests and got `Validation passed.` from Hermes.

## Where to go next

- The settings that the page needs, for example `owner`: [api.md](api.md#settings)
- How the parts connect: [architecture.md](architecture.md)
- The module reference: [README.md](README.md#module-map)
