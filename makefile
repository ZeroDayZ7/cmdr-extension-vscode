.PHONY: build release metadata

build:
	npm run build:full

metadata:
	npm run prepare:metadata

release:
	node scripts/release-tag.js