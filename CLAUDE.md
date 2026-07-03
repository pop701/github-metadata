# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`jekyll-github-metadata` (gem name) is a Jekyll plugin that populates the `site.github` Liquid namespace with data fetched from the GitHub API (via Octokit), and sets fallback values for `site.title`, `site.description`, `site.url`, and `site.baseurl`. It's the plugin that powers `site.github.*` on GitHub Pages sites. It also registers a `github_edit_link` Liquid tag.

## Setup & common commands

```bash
bundle config set --local path vendor/bundle   # first time only
script/bootstrap                                # bundle install --jobs=8
```

- `script/test` — run the full RSpec suite (sets `PAGES_ENV=test`). Equivalent to `script/spec`.
- `script/test spec/owner_spec.rb` — run a single spec file. Add `-e "some example name"` to target one example.
- `script/test --order defined` — run in file order instead of random order.
- `script/test --seed 12345` — reproduce a previous random run.
- `script/test --format documentation` — verbose output.
- `script/fmt` — run Rubocop (`-S -D -E`) to check style; fails the build on offenses.
- `script/fmt -a` — auto-fix Rubocop offenses.
- `script/console` — open a Pry console with the plugin loaded (`PAGES_ENV=dotcom`) for manual experimentation against the real API.
- `script/test-site` — serve `spec/test-site` with `jekyll serve` to manually preview `site.github` output in a browser at `http://127.0.0.1:4000`.
- `script/cibuild` — what CI runs: test, fmt, then `bundle exec rake build` (gem builds cleanly). Run this before considering a change complete.
- `script/release` — test, fmt, then `bundle exec rake release` (tags + pushes gem). Only for maintainers cutting a release; bumping `lib/jekyll-github-metadata/version.rb` on `main` triggers `.github/workflows/release.yml` to publish to RubyGems.
- `script/webmock-repopulate` — regenerate the fixtures in `spec/webmock/*.json` from the live GitHub API (requires `GITHUB_TOKEN`). Use when a spec needs updated/real API response shapes.

CI (`.github/workflows/ci.yaml`) runs `script/cibuild` across the Ruby 2.7–3.2 / Faraday 1.0–2.0 matrix.

## Architecture

Everything lives under `lib/jekyll-github-metadata/`, namespaced `Jekyll::GitHubMetadata`, and is `autoload`ed from `lib/jekyll-github-metadata.rb`. That file also holds the module-level singletons (`GitHubMetadata.client`, `.repository`, `.repository_finder`, `.site=`, `.reset!`) that the rest of the plugin shares.

Data flow, roughly outside-in:

1. **`SiteGitHubMunger`** (`site_github_munger.rb`) hooks into Jekyll's lifecycle:
   - `site: after_init` → sets title/description fallbacks and, in production/Pages-build contexts, `site.url`/`site.baseurl` fallbacks (via lazy `Value` procs, not eager fetches).
   - `site: pre_render` → injects the `github` namespace into the Liquid payload (`payload.site["github"]`).
   - `site: post_render` → restores the original config so repeated builds (e.g. `jekyll serve`) don't accumulate injected state.
2. **`RepositoryFinder`** determines the repo's "NWO" (name-with-owner, e.g. `jekyll/jekyll-github-metadata`), checked in this precedence: `PAGES_REPO_NWO` env var → `repository` key in `_config.yml` → the `origin` git remote (only in `development`/`test` env).
3. **`Repository`** (plus **`RepositoryCompat`** for pre-Pages-API fallback logic like guessing `pages_url`/`domain`/`source` when the real Pages API data is unavailable) is the model wrapping one repo's metadata — license, tagline, urls, releases, contributors, etc. Built from the NWO.
4. **`Owner`** is the analogous model for the repo's owner (user or org).
5. **`MetadataDrop`** (a `Jekyll::Drops::Drop`) is what actually gets exposed to Liquid as `site.github`; it delegates individual keys out to `Repository`/`Owner`/`Pages`. This is the place to look when you need to know exactly which `site.github.*` keys exist (see also `docs/site.github.md` for the full sample payload).
6. **`Pages`** is a stateless module of class methods reading `PAGES_*`/`OCTOKIT_*` env vars (with defaults) to answer questions like `enterprise?`, `dotcom?`, `custom_domains_enabled?`, `github_hostname`, etc. Almost every other class consults `Pages` for environment-dependent behavior (dotcom vs. GitHub Enterprise, test vs. production).
7. **`Client`** wraps Octokit with a whitelist (`API_CALLS`) of allowed methods, a manual per-process cache keyed on method+args, and error handling that degrades gracefully (no internet, rate limits, 404s → return a default instead of raising) except for bad credentials, which raises `BadCredentialsError`.
8. **`Value`** wraps a literal or a `Proc` (arity 0/1/2, receiving `client`/`repository` as needed) and memoizes+sanitizes the result on `#render`. Used everywhere API calls are deferred so a Jekyll build that never touches `site.github.*` never has to hit the network.
9. **`Sanitizer`** recursively converts Octokit/Sawyer response objects and hashes into plain Ruby hashes/strings/etc. suitable for Liquid.
10. **`EditLinkTag`** is the separate `{% github_edit_link %}` Liquid tag implementation; it reads `site.github.repository_url`/`source` (already-injected metadata) rather than hitting the API itself.

Key convention: **API calls are always lazy and memoized** via `Value.new(key, proc { |c| ... })` — never call Octokit directly in a getter. This is what keeps builds fast/offline-safe when a template doesn't reference `site.github`.

## Configuration & environment variables (for understanding behavior, not just docs)

The plugin's behavior is heavily driven by env vars read through `Pages` — see `docs/configuration.md` and `docs/authentication.md` for the user-facing list (`PAGES_REPO_NWO`, `JEKYLL_GITHUB_TOKEN`, `PAGES_ENV`, `OCTOKIT_*`, `SSL`, `SUBDOMAIN_ISOLATION`, etc.). `Jekyll.env` (`JEKYLL_ENV`) gates whether the git-remote NWO lookup and URL/baseurl fallbacks are active; `PAGES_ENV` (defaulting from `JEKYLL_ENV`) drives `Pages.env` (`development`/`test`/`dotcom`/`enterprise`).

## Testing conventions

- Spec helpers live in `spec/spec_helpers/` (`env_helper`, `integration_helper`, `stub_helper`, `web_mock_helper`, `fixture_helper`) and are auto-included via `spec/spec_helper.rb`.
- All HTTP is stubbed with WebMock (`WebMock.disable_net_connect!`); fixtures are recorded JSON API responses under `spec/webmock/`. Use `script/webmock-repopulate` to refresh them rather than hand-editing.
- `Jekyll::GitHubMetadata.reset!` runs before every example to clear memoized client/repository/site state.
- `spec/integration_spec.rb` builds/serves the sample site at `spec/test-site` (and `spec/test-site-uninject*`) end-to-end; these directories are fixtures, not scratch space.
- Rubocop config extends `rubocop-jekyll`; `script` files and `spec/**/*` are excluded from certain metrics cops (see `.rubocop.yml`).

## Docs

User-facing docs live in `docs/` (`README.md`, `configuration.md`, `authentication.md`, `site.github.md`, `edit-on-github-link.md`, `development.md`) and are the canonical reference for supported config keys, env vars, and the full `site.github` payload shape — check them before changing behavior that's part of the public contract.
