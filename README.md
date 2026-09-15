# Productivity for Trello

Shows how long each card has been in its **current Trello list**, with orange and red badge thresholds configurable per list. Static HTML, CSS and ES modules, served directly by GitHub Pages. No build service, application server or runtime package dependencies.

- [Live demo and setup](https://timo-leiser.github.io/productivity-trello-powerup/)
- [Plain-text installation guide](https://timo-leiser.github.io/productivity-trello-powerup/setup.txt)
- Connector: `https://timo-leiser.github.io/productivity-trello-powerup/connector.html`

## Features

- Card-front and card-detail time badges; refresh every 60 seconds.
- Per-list settings via the board button, card button and list menu.
- Thresholds in hours/days, fractional values, and independently disabled colors.
- Default orange at 48 hours, red at 120 hours. Thresholds are inclusive.
- Actual latest list-entry action; works for existing cards and while the board is closed.
- A return to a previous list starts a new stay. Comments, renames and reordering do not restart it.
- Calendar time, including nights/weekends; completion and archival do not pause time.
- Read-only REST access. Shared settings and private member tokens live in Trello plugin data.
- Unknown/unavailable history is clearly identified. No fabricated install-time or last-activity fallback.

Only the **badge** is colored. Trello's Power-Up API does not expose arbitrary card-background styling through card badges.

## Development

Node.js 22 or later; nothing to install:

```powershell
npm.cmd run dev
npm.cmd test
npm.cmd run check
```

Open `http://127.0.0.1:4173`. The demo dialog uses the actual settings form with synthetic data. Its localStorage contains only demo thresholds. Live Trello data is never stored there.

## Git / GitHub account

This project uses **timo-leiser <timo@leiser.me>** exclusively for the configured GitHub workflow. No global account switching.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/setup-git.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/github.ps1 api user --jq .login
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/github.ps1 repo view
```

`setup-git.ps1` sets repo-local author identity, resets inherited GitHub credential helpers, and installs a helper that gets the `timo-leiser` token from the existing GitHub CLI credential store and verifies `/user` before giving it to Git. HTTPS origin and hooks reject unintended push destinations and configured author changes. No secrets are written into the repository. Raw `gh` still follows the global CLI account; **use `scripts/github.ps1` or `npm.cmd run github -- ...` in this project**. Git configuration and hooks can be deliberately overridden; they are accident prevention, not a security boundary.

## Deploy to GitHub Pages

GitHub Pages uses **main /docs**, with `.nojekyll`. Commit and push tested changes to main. There is no custom GitHub Actions workflow and no dependency installation/build job; GitHub performs its standard Pages publication. Verify the latest Pages build and published files before declaring a deployment successful.

```powershell
npm.cmd test
npm.cmd run check
git add .
git commit -m "Describe the change"
git push origin main
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/github.ps1 api repos/timo-leiser/productivity-trello-powerup/pages/builds/latest
```

The initial Pages source is configured through the GitHub API with `source.branch=main`, `source.path=/docs`, `build_type=legacy`. `docs/` is the only published directory; tests and scripts stay outside it.

## Install privately

Follow [docs/setup.txt](docs/setup.txt). Register in the workspace owning your board, enable all eight capabilities, generate a public app API key and configure the allowed origin. Enter that key through the Power-Up UI; no source edit/deployment is required. Each user separately authorizes read access. The public repository/website does **not** put the Power-Up in Trello's public directory.

The developer agreement, creation of API credentials and authorization of account access may require the account owner to complete or explicitly approve those steps. No OAuth secret is needed by this static app.

## Time source and limits

`docs/js/domain.js` derives entry time from the latest relevant action. `api.js` requests filtered card actions with pagination, a 60-second in-memory cache, duplicate-request suppression and rate-limit backoff. Card/list/activity changes invalidate the cache. Missing history, imported or moved lists, or an inconsistent API/UI snapshot produce an unknown time rather than an older, misleading result. Card board-transfer events are used only when they identify the destination list.

Large boards may take longer to load (up to five history requests start per second per connector). Network failure, denied authorization and rate limiting have explicit neutral badge states. Retries happen on refresh. Filtering scans at most 20 × 100 actions per card; a still-unresolved history is unknown. Trello plugin data has a 4096-character limit per scope/visibility; saves leave headroom and report errors. Trello shared writes are not atomic: simultaneous settings edits can conflict despite reading the latest config before saving.

## Before a public directory release

Verify real Trello flows across supported browsers and large boards, review accessibility/theme behavior and Trello's current review/branding/privacy requirements, choose distribution/license terms, and submit the Power-Up separately. The current version is intended for personal workspace use.

## Primary references

- [Trello app registration](https://developer.atlassian.com/cloud/trello/guides/power-ups/managing-apps/)
- [Dynamic card badges](https://developer.atlassian.com/cloud/trello/power-ups/capabilities/card-badges/)
- [Plugin data](https://developer.atlassian.com/cloud/trello/power-ups/client-library/getting-and-setting-data/)
- [Authorization](https://developer.atlassian.com/cloud/trello/power-ups/client-library/t-authorize/)
- [Nested actions and pagination](https://developer.atlassian.com/cloud/trello/guides/rest-api/nested-resources/)
