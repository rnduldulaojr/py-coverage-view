# py-coverage-view README

Highlights test covered python code on the editor. This extension uses the results of pytest-cov/coverage.py (.coverage by default) to highlight covered code.

## Features

TODO: animation

## Requirements

The extension requires the following modules on your python environment.

* Install pytest

```
pip install pytest
```

* Install pytext-cov
```
pip install pytest-cov
```

## Extension Settings

This extension contributes the following settings:

* `python.coveragepy.file`: The coverage.py internal file for saving coverage results.
* `python.coveragepy.highlight`: Highlight color.

## Known Issues

This tool cannot yet process branch coverage info.  Make sure to not use the --branch flag when running coverage.py or pytest-cov, using .coveragerc file, this would be:

```
[run]
branch = True
```
TODO: arcs / branch coverage

## Release Notes

Initial version.  WARNING:  This was created to support  the author's workflow  at work and a means to learn how to create VS Code extensions :D  Please email: rduldulao@salarium.com for suggestions/improvements.

### 0.0.1

Initial release 



