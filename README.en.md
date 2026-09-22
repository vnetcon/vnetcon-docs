# vnetcon-docs — a project-agnostic AI documentation and ticket environment

> 🇫🇮 Suomeksi: [`README.md`](README.md) · **Note on language:** the method
> documents under [`dist/metodi/`](dist/metodi/) are written in Finnish. They are
> instructions the AI agent reads, not end-user documentation. The language of the
> **documentation the tool produces** is configurable
> (`vnetcon.config.yaml` → `dokumentaatio.kieli`, e.g. `en`), so an
> English-speaking project gets English output. See
> [Language](#language) below.

This repository is the **source of the tool**. It produces a `dist/` directory
that is copied into the root of any project under the name `vnetcon-docs/`. After
that, a single command (`/vnetcon-init`) turns the project into a self-directing
documentation system and ticket implementation environment. The method was
developed to be project-agnostic and proven against large production codebases;
project-specific implementations are shaped from the parts of this package.

## Assess your own codebase for free

**If you came here to evaluate your own project, start here.** The first three
commands are plain local Node scripts: **no AI, no network, no accounts, no access
granted to anyone.** Your code does not go anywhere.

Prerequisites: `git` and **Node 18+**. **No bash, Git Bash or WSL is required** —
every tool is a Node program, and PowerShell is enough on Windows. The same
holds for the method itself: the survey commands are spelled out for both
shells, see [PowerShell support](#powershell-support).

bash (macOS, Linux, WSL, Git Bash):

```bash
git clone https://github.com/vnetcon/vnetcon-docs.git
vnetcon-docs/tyokalut/asenna.sh /path/to/your-project
cd /path/to/your-project/vnetcon-docs
```

PowerShell (Windows without bash):

```powershell
git clone https://github.com/vnetcon/vnetcon-docs.git
vnetcon-docs\tyokalut\asenna.cmd C:\path\to\your-project
cd C:\path\to\your-project\vnetcon-docs
```

Then:

| Command | What it tells you |
|---------|-------------------|
| `./tyokalut/vnetcon-ai/vnetcon-ai moduulit` | What modules the codebase has, how large they are, and what to document first. Works before onboarding |
| `./tyokalut/vnetcon-ai/vnetcon-ai kalibroi` | Writes `kalibrointiraportti.md`: scope estimate in hours and AI cost, blind spots, documentation state. **Contains no code** — you can forward it |
| `./tyokalut/vnetcon-ai/vnetcon-ai doctor` | What is installed and configured. Run this if something fails |

> The output and the report are in Finnish by default. Set
> `dokumentaatio.kieli: en` in `vnetcon.config.yaml` for English documentation
> output — see [Language](#language).

### What to expect on the first run

The report will say **"3 estoa: käyttöönotto kesken"** (3 blockers: onboarding
incomplete). That is the expected first state, not an error — it means the module
split has not been confirmed yet, so the survey uses only generic searches. The
scope estimate, module sizes and blind spots are usable regardless.

The report also states the questions it **cannot answer itself**: zero hits in a
search area means either that the area does not exist, or that it is implemented
in a way a generic search does not recognise. The latter is the case that produces
incomplete documentation unnoticed — and it is resolved by reading code, not by
running the tool again.

### The next step needs an AI account

When you want the real module split instead of generic candidates, start an agent
in this directory and run `/vnetcon-init` (see
[Installing into a target project](#installing-into-a-target-project)). Measured
cost: about **$16 on your own AI account** for a 60,000-line project.

A browsable sample of what finished documentation looks like:
[vnetcon.com/nayte](https://vnetcon.com/nayte/).

---

The system supports **two agents**: documentation is typically run with Claude and
ticket implementation with Codex, but either can do both. The handoff between
them is **interactive at both ends**: the implementing agent does not start
coding from a ready-made prompt — it verifies the plan against the code, states
where it disagrees, and waits for the developer's explicit go-ahead (phase 3b,
[`dist/metodi/tiketti-tyonkulku.md`](dist/metodi/tiketti-tyonkulku.md)). The
point of two agents is precisely that they disagree before the code changes —
and the disagreement is settled in that same session with the implementing
agent, so it rarely costs a round-trip back to planning.

**The same applies to tests.** They are proposed and approved *before*
implementation, derived from the acceptance criteria rather than from the code —
and **the agent changes no test without permission**, not even one it wrote
itself. A test the agent may rewrite whenever it fails has stopped being a check.
By default it uses the
**customer's own AI account** — code never passes through a third party. Other
providers (your own cloud tenant, a direct API key, or your organisation's own
internal proxy) are configurable; see
[`dist/metodi/agentit.md`](dist/metodi/agentit.md).

## How it is used

The customer installs the package and **runs the first passes themselves** — no
code has to be handed to anyone. `kalibroi` (calibrate) reports mechanically how
well the generic baseline fits this particular project and **what falls into the
blind spot**. Blind spots are structural and expected: generic searches do not
know a project's own idioms.

The calibration report contains **no code**, so it can be sent onward for
assessment. Fixes always target extension points
([`dist/metodi/laajennuspisteet.md`](dist/metodi/laajennuspisteet.md)), so
updating the package never overwrites them.

---

## What it does

| Stage | Command | Agent | Result |
|-------|---------|-------|--------|
| Onboarding | `/vnetcon-init` | Claude | Project survey, `vnetcon.config.yaml`, the `tila/` registry, a stack-specific `metodi/kartoitus.md` |
| Module list | `vnetcon-ai moduulit` | — | Modules by area, status, lines of code, document counts + a suggestion for what to do next. Works before onboarding |
| Baseline | `/kalibroi` or `vnetcon-ai kalibroi` | — | `kalibrointiraportti.md`: blind spots, coverage, quality and a scope estimate. Code-free, shareable |
| Documentation | `/dokumentoi <module>` | Claude | `moduulit/<module>/` — overview, processes, data flows, data structures |
| Bulk run | `/dokumentoi-kaikki [area]` | Claude | A whole area in parallel (multi-agent workflow) |
| End-to-end | `/dokumentoi-jarjestelmaprosessi` | Claude | `jarjestelmaprosessit/` — flows that cross module boundaries |
| Browsable version | `/generoi-html` | either | `html/` — static site, search + Mermaid, works over `file://` |
| Ticket preparation | `/valmistele-tiketti` | Claude | `tiketit/<id>/` context + plan + **a test list agreed before implementation** + a ready prompt for Codex |
| Ticket implementation | `/toteuta-tiketti` | Codex | Phase 3b: verifies the plan against the code and raises its disagreements → after go-ahead, code change, the approved tests + documentation update. Changes no test without permission |
| Maintenance | `/synkronoi-dokumentaatio`, `/yhdenmukaista-dokumentaatio` | either | Docs brought in line with code or method changes |
| Verification | `vnetcon-ai linkit --lahteet` | — | Broken links and `lahteet` (provenance) paths — needs no agent and no dependencies |
| Agent setup | `/agentit` | Claude | Work split + whose account the agents run against: your own login, your own cloud tenant, or your organisation's proxy |

## Installing into a target project

```bash
# 1. get this repository (once)
git clone https://github.com/vnetcon/vnetcon-docs.git
cd vnetcon-docs

# 2. copy the package into the target project root
tyokalut/asenna.sh /path/to/target-project

# 3. start the agent inside the package directory
cd /path/to/target-project/vnetcon-docs
claude
```

and in Claude's input field:

```
/vnetcon-init
```

**Prerequisites on the target machine:** `claude` and/or `codex` signed in,
Node.js 18+ and preferably git. The agents and every tool in the package run
natively on Windows in PowerShell — **no bash, Git Bash or WSL needed.** Full
list with reasons:
[`dist/README.md` → Esivaatimukset](dist/README.md#esivaatimukset). To check a
target: `./tyokalut/vnetcon-ai/vnetcon-ai doctor`.

### From a blank machine to the first ticket (the zip route)

For when both the source code and the package arrive as zip files — an
air-gapped environment, a fresh workstation, or a customer with no access to
this repository. Each sequence is complete: copy your own platform's block from
top to bottom.

**Prerequisites:** `git`, Node 18+, and `claude` and/or `codex` signed in. On
Linux, make sure `unzip` is present (minimal installs omit it:
`apt install unzip` / `dnf install unzip`). On Windows, install **Git for
Windows** for `git` — bash is not needed.

#### macOS / Linux / *nix

```bash
# 1. unpack the source code
unzip project.zip -d ~/projects/
cd ~/projects/project

# 2. make it a git repo — the documentation scope is git ls-files
git init
git add -A
git commit -m "starting point"

# 3. unpack vnetcon-docs into the project root
unzip ~/Downloads/vnetcon-docs-<version>.zip

# 4. start the agent in the package directory (not the project root)
cd vnetcon-docs
claude
```

#### Windows (PowerShell)

```powershell
# 1. unpack the source code
Expand-Archive project.zip -DestinationPath C:\projects\
cd C:\projects\project

# 2. make it a git repo — the documentation scope is git ls-files
git init
git add -A
git commit -m "starting point"

# 3. unpack vnetcon-docs into the project root
Expand-Archive $HOME\Downloads\vnetcon-docs-<version>.zip -DestinationPath .

# 4. start the agent in the package directory (not the project root)
cd vnetcon-docs
claude
```

Then, in the agent's input field, in the same order on both platforms:

```
/vnetcon-init          onboarding: survey, configuration, state
/kalibroi              baseline and blind spots (uses no AI)
/valmistele-tiketti    ticket context + plan + implementation prompt
/toteuta-tiketti       phase 3b receiving gate, then implementation
```

**Documentation does not have to exist before the first ticket.** If the area a
ticket touches is undocumented, the workflow surveys it straight from the code
([`dist/metodi/tiketti-tyonkulku.md`](dist/metodi/tiketti-tyonkulku.md), phase 1
item 4) and proposes documenting that area as part of the ticket.

**Two platform differences, and only two:**

1. **The executable bit.** `paketoi.sh` runs `chmod +x` before packaging and
   `unzip` preserves it, so `./tyokalut/vnetcon-ai/vnetcon-ai` works on *nix.
   `Expand-Archive` does not preserve permissions → on Windows use the
   `tyokalut\vnetcon-ai\vnetcon-ai.cmd` launcher (or `.ps1`), which needs no
   executable bit.
2. **On Windows, step 3 is usually unnecessary.** With the default
   (`tarjoaja: oma`) the agent is started with plain `claude` or `codex`.

**Bash is not needed on either platform** — every tool is Node.

> **Step 2 is the one people forget.** Source code unpacked from a zip is not a
> git repo, and the method relies on it: the scope is `git -C .. ls-files`,
> `/synkronoi-dokumentaatio` is based on commit diffs, and a ticket records
> `HEAD` when it starts. Without `git init`, `/vnetcon-init` detects this and
> sets `projekti.versionhallinta: none` — the system works, but you lose
> synchronisation and updates are done by hand.

## PowerShell support

Platform independence covers not just the tools but the **method**. The survey
commands come from the stack profiles
([`dist/metodi/pinot/`](dist/metodi/pinot/)), and in every profile each section
is written out twice: once for bash, once for PowerShell. 53 blocks of each
across nine profiles (generic, .NET, JVM, Node/TS, Python, PHP, Go, frontend,
Excel workbook).

Why this matters: the commands from those profiles end up in the project's own
`metodi/kartoitus.md`, which the agent runs. If that file contains `grep` and
`head` pipelines, they break in PowerShell — or worse, return zero hits, which
is indistinguishable from a genuine blind spot. That is why the PowerShell
equivalents are written out instead of being left for the agent to translate.

Pick the block by **shell, not operating system**:

| Shell | Which block |
|-------|-------------|
| macOS, Linux, WSL2, Git Bash | bash |
| Windows without bash | PowerShell |

Git Bash is bash running on Windows, so it uses the bash blocks. `asenna.mjs`
detects it from `MSYSTEM` and prints forward-slash paths instead of
backslashes.

## Excel workbooks

The most common undocumented business system is not code but an **Excel
workbook**: the logic lives in formulas, the configuration on a parameter sheet,
and there is no version history, no tests and no review. `.xlsx` is a binary, so
`git grep` cannot see inside it — without a method of its own the survey returns
**zero hits for every search area**, which is indistinguishable from a genuine
blind spot.

The package ships a stack profile for this
([`dist/metodi/pinot/excel.md`](dist/metodi/pinot/excel.md), in Finnish) and a
tool ([`dist/tyokalut/xlsx-kartta.mjs`](dist/tyokalut/xlsx-kartta.mjs)) that
turns a workbook into text — searchable, and quotable into documents as is:

```
node tyokalut/xlsx-kartta.mjs ../<workbook>.xlsx --osa riskit
```

| Part (`--osa`) | What it prints |
|----------------|----------------|
| `rakenne` (structure) | sheets, header rows, hidden sheets, named ranges |
| `kaavat` (formulas) | formulas as rules — row numbers normalised, so 500 identical rows collapse into one |
| `funktiot` (functions) | the functions in use, plus a warning when the risk analysis is incomplete (`INDIRECT`, `OFFSET`) or the result is not reproducible (`NOW`, `TODAY`, `RAND`) |
| `arvot` (values) | parameter sheets in full: percentages, tiers, multipliers, thresholds |
| `linkit` (links) | external links to other workbooks, the cells referencing them, and a Mermaid dependency graph |
| `riskit` (risks) | `IFERROR` swallowing errors, lookup ranges shorter than the table, hard-coded conditions and numbers, hidden sheets, dates stored as text, VBA |

The tool is a dependency-free Node program (`.xlsx` is a zip of XML and `zlib`
ships with Node), so it runs in PowerShell with nothing to install. `.xlsb` is a
binary format it does **not** parse — record that as a blind spot.

## Distribution model — the package is copied, not linked

This differs from what a developer usually expects, so it is worth stating
plainly: `asenna.sh` **copies** the `dist/` directory into the target project as
`vnetcon-docs/`. It is not a submodule, an npm dependency or a symlink.

The reason is self-containment: it works without network access, without
`npm install` (except for HTML generation) and without adding a dependency to the
customer's build pipeline. The price is that **updating is a deliberate act**:

```bash
cd /path/to/this/repo && git pull
tyokalut/asenna.sh /path/to/target-project --paivita
```

A `.vnetcon-docs-versio` file is written into the target so you can see which
version is in use.

> **The zip is for first installation, not for updating.** Its contents match
> `dist/`, but the *effect* differs: `--paivita` copies only the engine, whereas
> unzipping over an existing installation also overwrites the project's own
> content with templates — `tila/projekti.yaml`, `tila/rekisteri.yaml` (what has
> been documented), `tila/rakenne.yaml`, `tila/edistyminen.md`,
> `tila/synkronoitu.yaml`, `johdanto.md`, `metodi/kartoitus.md`,
> `metodi/sanasto.md` and `.claude/settings.json`. The templates cannot be left
> out of the zip, because a first installation needs them.
>
> **In an air-gapped environment, update by hand:** unpack the zip into a
> temporary directory and copy only these over the existing installation:
> `metodi/` (except `kartoitus.md` and `sanasto.md`), `tyokalut/`,
> `.claude/skills/`, `.claude/workflows/`, `tila/metodi.yaml`, `CLAUDE.md`,
> `AGENTS.md`, `README.md`, `vnetcon.config.example.yaml`, `.gitignore` — the
> same list `asenna.sh --paivita` uses. If `vnetcon-docs/` is under the
> customer's version control (the default — it is not gitignored), any damage
> shows up in `git diff` and can be reverted.

## Repository layout

```
dist/                  The package, copied into a project as vnetcon-docs/
tyokalut/asenna.mjs    Copies dist/ → <target>/vnetcon-docs (idempotent; --paivita updates the engine)
tyokalut/asenna.sh     Launcher for *nix   (asenna.cmd = the same for Windows)
tyokalut/testaa.mjs    Smoke test: builds temporary projects and asserts on the results
tyokalut/testaa.sh     Launcher for *nix   (testaa.cmd = the same for Windows)
tyokalut/paketoi.sh    Builds a distributable vnetcon-docs-<version>.zip (maintainer only, macOS/Linux)
VERSIO                 Package version (the installer writes it into the target)
LICENSE                Apache-2.0
```

The implementations live in the `.mjs` files; `.sh`/`.cmd`/`.ps1` are thin
launchers — the same code runs on every platform and bash is never required.

## Language

| Layer | Language | Configurable |
|-------|----------|--------------|
| Documentation the tool **produces** | `vnetcon.config.yaml` → `dokumentaatio.kieli` (default `fi`) | **yes** — set `en` and the output, including the generated HTML, is English |
| Method documents (`dist/metodi/**`) and skills | Finnish | no |
| This repository's own README | Finnish + English | — |

The method documents are deliberately kept in a single language. They are a
prompt the agent follows, not prose for humans: two language versions would have
to stay identical in *behaviour*, and any drift between them would produce
different documentation from the same code — which would defeat the consistency
the tool exists to provide.

If you need the method itself in English (for example because your organisation
must audit it before adopting it), get in touch. Translating it requires fixing
the terminology once and for all first, so it is done deliberately rather than
incrementally.

## Development

`dist/` is the source of truth. Changes are made there and delivered with
`asenna.sh`.

`--paivita` updates only the **engine** (`metodi/**`, `tyokalut/**`,
`.claude/skills|workflows`, `CLAUDE.md`, `AGENTS.md`, `README.md`,
`vnetcon.config.example.yaml`, `.gitignore`) and always preserves the project's
own content: `vnetcon.config.yaml`, `tila/`, `johdanto.md`, the document
directories, `metodi/kartoitus.md`, `metodi/sanasto.md`,
`.claude/settings.json` and any skills the project added itself. Files removed
from the package are not cleaned up — they stay in the target, so check
`git status` after updating.

If the method changes such that already-written documents need updating,
increment `dist/tila/metodi.yaml` → `metodi_versio` and add a `muutokset` entry;
target projects then run `/yhdenmukaista-dokumentaatio`.

### Smoke test

**Run this before every release.** It builds two temporary projects, installs the
package into them and asserts on the results — including the cases that have been
broken once before (a module that is not a directory, line attribution from a
`tiedostot` list, phantom rows, blind-spot scoping) and the Excel workbook traps
`xlsx-kartta.mjs` has to find:

```bash
tyokalut/testaa.sh           # exit 0 = pass
tyokalut/testaa.sh --pida    # leaves the temporary directories for inspection
```

Beyond that, test against a **real, large codebase**: install the package there
and run `kalibroi`. It is a read-only operation, so it does not modify the target
project. Verify that the zero-hit areas are genuine blind spots and not bugs in
the search patterns.

HTML generation needs network access once and is not part of the smoke test:

```bash
(cd dist/tyokalut/html-generaattori && npm install && node generoi.mjs)
```

## Releasing

```bash
tyokalut/testaa.sh                       # mandatory
# increment VERSIO
tyokalut/paketoi.sh                      # → vnetcon-docs-<version>.zip
git commit -am "vX.Y.Z: <what changed>"
git tag vX.Y.Z && git push --tags
```

Attach the zip to the GitHub release: in air-gapped environments it is the only
delivery route, and it doubles as an audit artefact of exactly which version was
delivered. The zip is produced by `paketoi.sh` and is not maintained separately.

## License

Apache-2.0, see [`LICENSE`](LICENSE). The method is public on purpose: the
package is copied in its entirety into the customer's repository, so being able
to inspect it is a reason to buy rather than a risk.
