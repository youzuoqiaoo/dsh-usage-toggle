# dsh-usage-toggle

A DSH (DeepSeek Harness) web plugin that adds a **show/hide toggle** for the
token/step usage line that appears below the composer. The toggle is a compact
**eye icon** placed in the composer tool row immediately **before the model
selector**; clicking it shows or hides the usage line below the input.

```
[ 👁 ]  [ model selector ]  ContextMeter   [ send ]      ← composer tool row
              ┌────────────────────────────┐
              │ 2 turns · 3 steps | LLM …  │  ← usage line (toggled)
              └────────────────────────────┘
```

- **Open eye** (default): usage line visible.
- **Eye + slash**: usage line hidden.

It renders the same statistics as the built-in line (turn/step counts, LLM and
tool-call durations, TTFT, tokens-per-second, cache-hit %, and input/output
tokens), reproduced faithfully.

> Purely client-side UI. No host-side behavior, no persistence: the toggle
> state lives in memory and resets to "show" on page reload.

---

## Install

The plugin is a regular npm package that DSH mounts through a `cordis.patch.yml`
bundle. Install it into a profile with the DSH CLI:

```sh
# From a published npm package:
dsh plugin --profile web add dsh-usage-toggle

# From a GitHub repository directly:
dsh plugin --profile web add https://github.com/youzuoqiaoo/dsh-usage-toggle

# From a local directory (for development):
dsh plugin --profile web add dsh-usage-toggle@file:../dsh-usage-toggle
```

This command installs the package into the profile's `node_modules`, appends it
to `dsh.profile.bundles`, and the next profile start mounts the plugin row from
`cordis.patch.yml`. **Restart the profile** (the web app window) for it to take
effect.

> Note: this is a *real* plugin package, so it does **not** need the in-session
> dynamic-plugin approval flow. It is installed and mounted at boot.

---

## Build

The package compiles with TypeScript only (no bundler required):

```sh
npm install
npm run build
```

This emits `lib/` (the `main` entry) and `lib/client/` (the browser half, served
through `exports["./client"]` and discovered by the `dsh.client` declaration in
`package.json`).

---

## Project layout

```
dsh-usage-toggle/
├── package.json            # name/version, dsh.client + dsh.bundle.patch declarations
├── cordis.patch.yml        # mounts the plugin row into the profile bundle stack
├── tsconfig.json
├── src/
│   ├── index.ts            # host half (empty apply — pure UI plugin)
│   └── client/
│       └── index.ts        # client half: usage line + eye toggle (React)
├── lib/                    # build output (compiled)
├── README.md
├── README.zh.md
└── LICENSE
```

### How the two halves work

- **Host half** (`lib/index.js`): an empty `apply` so the package registers a
  row on the host roster.
- **Client half** (`lib/client/index.js`): exported via `exports["./client"]` and
  auto-discovered from the `dsh.client` declaration. It registers into:
  - `conversation.composer.dock` — replaces the built-in `stats` cell with the
    toggle-aware usage line.
  - `conversation.input.right` — adds the eye toggle before the model selector,
    sharing state with the usage line through a module-scoped store.

---

## Publishing to GitHub

1. **Create the repository**, then update the links in `package.json`
   (`repository.url`, `homepage`) and push:

   ```sh
   git init
   git add .
   git commit -m "dsh-usage-toggle: initial commit"
   git branch -M main
git remote add origin git@github.com:youzuoqiaoo/dsh-usage-toggle.git
   git push -u origin main
   ```

2. **Publish to npm** (so others can `dsh plugin add dsh-usage-toggle`):

   ```sh
   npm login
   npm publish --access public
   ```

   `publishConfig.access` is already `public`; `files` in `package.json` already
   lists the published artifacts.

3. **Install from GitHub** (without npm) is also supported via the git URL shown
   above.

---

## License

MIT
