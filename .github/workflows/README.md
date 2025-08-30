# GitHub Actions Workflows

This directory contains GitHub Actions workflows for automated CI/CD processes.

## Workflows

### 🚀 Release Workflow (`release.yml`)

Automatically handles NPM package releases with version tagging and GitHub releases.

**Triggers:**
- **Automatic**: When `package.json` version is changed and pushed to main/master
- **Manual**: Via GitHub Actions UI with release type selection (patch/minor/major/prerelease)

**Features:**
- ✅ Runs comprehensive tests before release
- 🏷️ Creates Git tags automatically
- 📦 Publishes to NPM with provenance
- 📝 Generates GitHub releases with changelog
- 🔄 Handles both stable and prerelease versions
- 🛡️ Prevents duplicate releases

**Usage:**

1. **Automatic Release** (recommended):
   ```bash
   # Update version in package.json
   npm version patch  # or minor, major
   git push origin main --tags
   ```

2. **Manual Release**:
   - Go to Actions tab in GitHub
   - Select "Release" workflow
   - Click "Run workflow"
   - Choose release type

### 🔍 CI Workflow (`ci.yml`)

Continuous integration testing for all pull requests and pushes.

**Features:**
- 🧪 Tests on multiple Node.js versions (18, 20, 21)
- 🔍 Type checking with TypeScript
- 📦 Build verification and package testing
- 🔒 Security audits
- ✅ Compatibility checks
- 📏 Package size monitoring

**Runs on:**
- Pull requests to main/master/develop
- Pushes to main/master/develop
- Manual triggers

## Setup Requirements

### NPM Token

1. Create an NPM access token:
   - Go to [npmjs.com](https://www.npmjs.com) → Account → Access Tokens
   - Create a new "Automation" token
   
2. Add to GitHub repository secrets:
   - Go to repository Settings → Secrets and variables → Actions
   - Add new secret: `NPM_TOKEN` with your token value

### GitHub Token

The `GITHUB_TOKEN` is automatically provided by GitHub Actions. No setup required.

## Release Process

### Version Bumping

The workflow supports semantic versioning:

- **patch**: Bug fixes (0.1.0 → 0.1.1)
- **minor**: New features (0.1.0 → 0.2.0)  
- **major**: Breaking changes (0.1.0 → 1.0.0)
- **prerelease**: Pre-release versions (0.1.0 → 0.1.1-0)

### Changelog Generation

Changelogs are automatically generated from Git commits between releases. For better changelogs, use conventional commit messages:

```
feat: add new caching strategy
fix: resolve memory leak in cache cleanup
docs: update API documentation
chore: bump dependencies
```

### Prerelease Handling

Prerelease versions (containing `-` in version) are:
- Tagged with `next` on NPM
- Marked as prerelease on GitHub

## Troubleshooting

### Release Failed

1. **Check NPM token**: Ensure `NPM_TOKEN` secret is valid
2. **Version conflicts**: Make sure version doesn't already exist on NPM
3. **Build errors**: Check CI workflow for build issues

### CI Failures

1. **Type errors**: Run `npm run type-check` locally
2. **Build issues**: Run `npm run build` locally
3. **Node version**: Ensure compatibility with Node 18+

### Manual Recovery

If automatic release fails, you can manually release:

```bash
# Ensure you're on main branch with latest changes
git checkout main
git pull origin main

# Build and test
npm ci
npm run build
npm run test

# Publish (if version is already bumped)
npm publish

# Create tag if missing
git tag v$(node -p "require('./package.json').version")
git push origin --tags
```

## Best Practices

1. **Always test locally** before pushing version changes
2. **Use semantic versioning** for clear version progression  
3. **Write descriptive commit messages** for better changelogs
4. **Review CI results** before merging PRs
5. **Monitor package size** to keep bundle lightweight

## Security

- All workflows use pinned action versions for security
- NPM publishing includes provenance for supply chain security
- Security audits run on every CI build
- Tokens are stored securely in GitHub secrets
