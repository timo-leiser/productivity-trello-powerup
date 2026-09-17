# Productivity for Trello

Productivity shows how long every card has been in its **current Trello list**, with green, orange and red time thresholds configurable per list. The interface is in English. Static HTML, CSS and ES modules are published from `docs/`.

- [Live demo and setup](https://productivity-trello-powerup.pages.dev/)
- [Plain-text setup guide](https://productivity-trello-powerup.pages.dev/setup.txt)
- Connector: `https://productivity-trello-powerup.pages.dev/connector`

## Features

- Card-front and card-detail time badges, refreshed every 60 seconds.
- Settings open from each list’s ... menu or from a card.
- Independent green, orange and red thresholds in hours or days.
- Actual latest list-entry action; no fabricated fallback from card creation IDs, installation time or `dateLastActivity`.
- Shared board settings and private member tokens stored in Trello plugin data.
- Browser-only processing with no application backend, ads or analytics.

## Development

Node.js 22 or later; no runtime dependencies:

```powershell
npm.cmd run dev
npm.cmd test
npm.cmd run check
```

Open `http://127.0.0.1:4173`. The demo uses synthetic data and does not prove the live Trello integration.

## Git and GitHub identity

This project uses **timo-leiser <timo@leiser.me>** for repository operations. Do not change the global GitHub account.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/setup-git.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/github.ps1 api user --jq .login
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/github.ps1 repo view
```

## Publishing

Cloudflare Pages deploys `main /docs` to the production hostname and applies the security headers in `docs/_headers`. GitHub remains the source repository; its Pages deployment is only a mirror because GitHub Pages does not apply custom response headers.

Before publishing a change:

```powershell
npm.cmd test
npm.cmd run check
git add .
git commit -m "Describe the change"
git push origin main
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/github.ps1 api repos/timo-leiser/productivity-trello-powerup/pages/builds/latest
```

The registered Power-Up ID is `6aa901a6de4bf8ac86c834f7`. The public application key is in `docs/js/config.js`; no secret or personal token belongs in this repository.

## Time source and limits

`docs/js/domain.js` derives phase entry time from Trello action history. Returning to a list starts a new stay; comments, renames and reordering do not. Calendar time includes nights and weekends. Missing or inconsistent history remains unknown. Requests are paginated, deduplicated, cached briefly and rate-limited.

Only the badge is colored. Large boards or Trello rate limits can delay loading. Trello shared writes are not atomic, so simultaneous settings edits may conflict.

## Primary references

- [Public Power-Up guidelines](https://developer.atlassian.com/cloud/trello/guides/power-ups/public-power-up-guidelines/)
- [Power-Up security](https://developer.atlassian.com/cloud/trello/guides/power-ups/security/)
- [Dynamic card badges](https://developer.atlassian.com/cloud/trello/power-ups/capabilities/card-badges/)
- [Plugin data](https://developer.atlassian.com/cloud/trello/power-ups/client-library/getting-and-setting-data/)
- [Authorization](https://developer.atlassian.com/cloud/trello/power-ups/client-library/t-authorize/)
