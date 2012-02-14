

build:
	@cat \
		`npm root eventemitter`/eventemitter/index.js \
		lib/prefix.js \
		lib/io.js \
		lib/page.js \
		lib/sqlite.js \
		lib/suffix.js \
		> demo/sqlite.js