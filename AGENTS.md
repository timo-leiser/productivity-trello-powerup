# Project instructions

## GitHub identity

- This project belongs to `timo-leiser/productivity-trello-powerup`.
- Use Git author/committer `timo-leiser <timo@leiser.me>`.
- Use `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/github.ps1 ...` for GitHub CLI operations. It selects and verifies the `timo-leiser` account without changing global login settings.
- Do not use raw `gh` for mutations or change the global Git/GitHub identity.
- If configuring a new checkout, run `scripts/setup-git.ps1`. Keep the verified HTTPS credential helper and project hooks enabled.

## Development and release

- Static files published on GitHub Pages are in `docs/`; retain the `main /docs` Pages source and `.nojekyll`.
- Keep personal Trello tokens, API secrets, actual board content and local debug artifacts out of the repository and published files.
- Run `npm.cmd test` and `npm.cmd run check` for behavior changes.
- Verify meaningful UI changes in the actual settings form. `?demo=1` uses synthetic data; it does not prove live Trello integration.
- Before reporting a release as live, check the Pages build status, deployed commit and HTTP responses. Preserve any unrelated work.
- Do not publish the Power-Up to Trello's public directory unless the user requests it.
- Do not infer elapsed phase time from card creation ID, install time or dateLastActivity when a recorded entry is missing.
