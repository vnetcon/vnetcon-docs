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
developed against large production codebases and generalised here to be
project-agnostic.

## Assess your own codebase for free

**If you came here to evaluate your own project, start here.** The first three
commands are plain local Node scripts: **no AI, no network, no accounts, no access
granted to anyone.** Your code does not go anywhere.

Prerequisites: `git`, **Node 18+**, `bash`. On Windows use **WSL2** or Git Bash —
PowerShell is not enough.

```bash
git clone https://github.com/vnetcon/vnetcon-docs.git
vnetcon-docs/tyokalut/asenna.sh /path/to/your-project
cd /path/to/your-project/vnetcon-docs
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
point of two agents is precisely that they disagree before the code changes.
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
| Ticket preparation | `/valmistele-tiketti` | Claude | `tiketit/<id>/` context + plan + a ready prompt for Codex |
| Ticket implementation | `/toteuta-tiketti` | Codex | Phase 3b: verifies the plan against the code and raises its disagreements → after go-ahead, code change + documentation update |
| Maintenance | `/synkronoi-dokumentaatio`, `/yhdenmukaista-dokumentaatio` | either | Docs brought in line with code or method changes |
| Verification | `vnetcon-ai linkit --lahteet` | — | Broken links and `lahteet` (provenance) paths — needs no agent and no dependencies |
| Provider setup | `/agentit` | Claude | Point Claude/Codex at a cloud provider or your own account |

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

**Prerequisites on the target machine:** bash (on Windows use **WSL2** or Git
Bash — not PowerShell), `claude` and/or `codex` signed in, Node.js 18+ and
preferably git. Full list with reasons:
[`dist/README.md` → Esivaatimukset](dist/README.md#esivaatimukset). To check a
target: `./tyokalut/vnetcon-ai/vnetcon-ai doctor`.

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
version is in use. For delivery without network access, use the
[release zip](#releasing) — the contents are identical.

## Repository layout

```
dist/                  The package, copied into a project as vnetcon-docs/
tyokalut/asenna.sh     Copies dist/ → <target>/vnetcon-docs (idempotent; --paivita updates the engine)
tyokalut/paketoi.sh    Builds a distributable vnetcon-docs-<version>.zip
tyokalut/testaa.sh     Smoke test: builds temporary projects and asserts on the results
VERSIO                 Package version (asenna.sh writes it into the target)
LICENSE                Apache-2.0
```

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
`tiedostot` list, phantom rows, blind-spot scoping):

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
