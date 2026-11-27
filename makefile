.PHONY: build release

build:
	npm run build:full

release:
	node scripts/release-tag.js