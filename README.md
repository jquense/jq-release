rf-release
==========

Tag, push, changelog, and publish your repositories with one command.

Installation
------------

```sh
npm install rf-release
# or
npm install rf-release -g
```

What it does
------------

1. prompts you for the new version
2. updates `package.json` and `bower.json` (if they exist)
3. commits the version updates with a simple commit message
   ("release {version}")
4. creates the tag "v{version}"
5. pushes master and the new tag to origin
6. publishes to npm


License and Copyright
---------------------

MIT License

(c) 2014 Ryan Florence


