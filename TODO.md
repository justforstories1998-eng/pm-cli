# pm-ai-cli release checklist

- [x] Diagnose: banner printed twice / dist missing in local checkout
- [x] Fix: prevent duplicate banner by removing extra `printCleanBanner()` calls
- [x] Bump version to 1.0.4
- [x] Create tag v1.0.4
- [x] Push commits + tags to GitHub (publish workflow triggers on v*)
- [ ] Update README.md professionally (correct package name, version, install steps, commands)
- [ ] Commit + push README changes (create a new tag/publish if required)

- [ ] Verify locally: `npm run build` and `node dist/index.js --help` after README update

