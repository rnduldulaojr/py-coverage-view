# py-coverage-view README

Highlights test covered python code on the editor. This extension uses the results of pytest-cov/coverage.py (.coverage by default) to highlight covered code.


## Features
- Highlights uncovered(default) or covered code (set via settings).
- Displays coverage stats and highlight mode in the IDE status bar.


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
* `python.coverageView.highlight`: Highlight color.
* `python.coverageView.highlightMode`: Highlight mode: ```uncovered```(default) or ```covered```.

## Known Issues

TODO:

## Release Notes

Initial version.  WARNING:  This was created to support  the author's workflow  at work and a means to learn how to create VS Code extensions :D  Please email: rduldulao@salarium.com for suggestions/improvements.


### 0.0.8
- Added ```def ``` lines as ignored line.

### 0.0.7
- Modified status display  - now displays stats for current python file in active editor with the OVERALL coverage.
- Will not highlight "blank" lines, although coverage.py might still detect them as uncovered.

### 0.0.6
- Added Status bar item for displaying Highlight mode as well as coverage stats.
- Ignore ```pass``` and ```else:``` lines in highlighting
- Py Cov now runs in a background shell via ```exec```

### 0.0.5
- Minor changes, skipped version

### 0.0.4
- Does not highlight comment lines.

### 0.0.3

- Changed option name for highlight: ```python.coverageView.highlight```
- Added highlight mode.
- From this version: by default, uncovered code will be highlighted. This behavior can be modified via the ```python.coverageView.highlightMode``` option.

### 0.0.2

Added support for arcs data.

### 0.0.1

Initial release 





