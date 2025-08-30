#!/bin/bash

# Release script for cached-middleware-fetch-next
# Usage: ./scripts/release.sh [patch|minor|major|prerelease]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default release type
RELEASE_TYPE=${1:-patch}

echo -e "${BLUE}🚀 Starting release process for cached-middleware-fetch-next${NC}"
echo -e "${BLUE}Release type: ${RELEASE_TYPE}${NC}"

# Validate release type
if [[ ! "$RELEASE_TYPE" =~ ^(patch|minor|major|prerelease)$ ]]; then
    echo -e "${RED}❌ Invalid release type. Use: patch, minor, major, or prerelease${NC}"
    exit 1
fi

# Check if we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "master" ]]; then
    echo -e "${YELLOW}⚠️  Warning: You're not on main/master branch (current: $CURRENT_BRANCH)${NC}"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}❌ Release cancelled${NC}"
        exit 1
    fi
fi

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
    echo -e "${RED}❌ You have uncommitted changes. Please commit or stash them first.${NC}"
    git status --short
    exit 1
fi

# Pull latest changes
echo -e "${BLUE}📥 Pulling latest changes...${NC}"
git pull origin $CURRENT_BRANCH

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${BLUE}Current version: ${CURRENT_VERSION}${NC}"

# Run tests
echo -e "${BLUE}🧪 Running tests...${NC}"
npm run test

# Clean and build
echo -e "${BLUE}🏗️  Building package...${NC}"
npm run clean
npm run build

# Test package
echo -e "${BLUE}📦 Testing package...${NC}"
npm run test:package

# Bump version
echo -e "${BLUE}📈 Bumping version...${NC}"
npm version $RELEASE_TYPE --no-git-tag-version

# Get new version
NEW_VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}✅ Version bumped to: ${NEW_VERSION}${NC}"

# Commit version change
echo -e "${BLUE}💾 Committing version change...${NC}"
git add package.json package-lock.json
git commit -m "chore: bump version to v${NEW_VERSION}"

# Create and push tag
echo -e "${BLUE}🏷️  Creating and pushing tag...${NC}"
git tag -a "v${NEW_VERSION}" -m "Release v${NEW_VERSION}"
git push origin $CURRENT_BRANCH
git push origin "v${NEW_VERSION}"

echo -e "${GREEN}✅ Release process completed!${NC}"
echo -e "${GREEN}📦 Version ${NEW_VERSION} has been tagged and pushed${NC}"
echo -e "${GREEN}🚀 GitHub Actions will handle the NPM publishing${NC}"
echo
echo -e "${BLUE}Next steps:${NC}"
echo -e "  1. Monitor the GitHub Actions workflow"
echo -e "  2. Check the release on GitHub: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^.]*\).*/\1/')/releases"
echo -e "  3. Verify the package on NPM: https://www.npmjs.com/package/cached-middleware-fetch-next"
