'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';

var terminal: vscode.Terminal;
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    let workspaceCache: { [id: string]: Array<any> } = {};
    let decorCache: { [id: string]: vscode.TextEditorDecorationType } = {};
    //initialize

    initCache(workspaceCache, decorCache);
    let covFileWatcher = vscode.workspace.createFileSystemWatcher(getCoverageFilePattern(), false, false, false);
    covFileWatcher.onDidChange((uri) => {
        console.log("Coverage file changed");
        updateCache(workspaceCache, uri, decorCache);
    });

    covFileWatcher.onDidCreate(uri => {
        console.log("Coverage file created");
        updateCache(workspaceCache, uri, decorCache);
    });

    //TODO: add delete handler
    vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && editor.document.uri.fsPath in workspaceCache) {
            let lines = workspaceCache[editor.document.uri.fsPath];
            let ranges: Array<vscode.Range> = [];
            lines.forEach(value => {
                ranges.push(editor.document.lineAt(value - 1).range);
            });

            if (editor.document.uri.fsPath in decorCache) {
                if (editor){
                    decorCache[editor.document.uri.fsPath].dispose();

                }
            }
            
            let decor = getHighlightDecoration();
            editor.setDecorations(decor, ranges);
            decorCache[editor.document.uri.fsPath] = decor;

        }
    });

    vscode.workspace.onDidChangeTextDocument(ev => {
        console.log(ev.document.uri.fsPath + " changed ");
        let editor = vscode.window.activeTextEditor;
        if (editor && editor.document.uri.fsPath === ev.document.uri.fsPath) {
                if (editor && editor.document.uri.fsPath in decorCache) {
                    decorCache[editor.document.uri.fsPath].dispose();
                    delete decorCache[editor.document.uri.fsPath] ;
                }
        }
        //remove from cache
        delete workspaceCache[ev.document.uri.fsPath];

    });

    vscode.workspace.onDidSaveTextDocument(doc => {
        if (doc.fileName.endsWith("py")) {
            runPytestCov();
        }
    });

    console.log('Congratulations, your extension "py-coverage-view" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('pycoveragedisplay.runPytestCov', () => {
        runPytestCov();
    });

    context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
}

function initCache(cache: { [id: string]: Array<any> }, decors: { [id: string]: vscode.TextEditorDecorationType } ) {
    console.log("Init cache");
    let editor = vscode.window.activeTextEditor;
    let activeEditorFS: string = "";
    if (editor) {
        activeEditorFS = editor.document.uri.fsPath;
    }
    vscode.workspace.findFiles(getCoverageFilePattern()).then(values => {
        values.forEach(value => {

            let content = fs.readFileSync(value.fsPath);
            console.log(content);

            let x = content.indexOf("{");
            console.log(x);
            if (x >= 0) {
                let buffer = content.slice(x);
                console.log(buffer.toString());
                let jsonData = JSON.parse(buffer.toString());
                console.log(jsonData);
                Object.keys(jsonData.lines).forEach(
                    key => {
                        console.log("Got key " + key);
                        cache[key] = jsonData.lines[key];
                        if (editor && key === activeEditorFS) {
                            let ranges: Array<vscode.Range> = [];
                            cache[key].forEach(value => {

                                if (editor) {
                                    ranges.push(editor.document.lineAt(value - 1).range);
                                }
                            });
                            let decor = getHighlightDecoration();
                            editor.setDecorations(decor, ranges);
                            decors[editor.document.uri.fsPath] = decor;
                        }
                    }
                );
            }
        });
    });
}
function getCoverageFilePattern(): string {
    const configuredFilename = vscode.workspace.getConfiguration().get("python.coveragepy.file");
    if (configuredFilename) {
        return "**/" + configuredFilename;
    }
    return "**/.coverage";
}

function updateCache(cache: { [id: string]: Array<any> }, uri: vscode.Uri, decors:{[id:string]: vscode.TextEditorDecorationType}) {
    console.log("Updating cache");
    fs.readFile(uri.fsPath, (err, data) => {
        if (err) {
            console.error(err);
            return;
        }

        //find enclosing coverage data {...}
        let x = data.indexOf("{");
        if (x >= 0) {
            let buffer = data.slice(x);
            let jsonData = JSON.parse(buffer.toString());
            Object.keys(jsonData.lines).forEach(
                key => {
                    cache[key] = jsonData.lines[key];
                }
            );
            updateOpenedEditors(cache, decors);

        }
    });
}

function updateOpenedEditors(cache: { [id: string]: Array<any> }, decors:{[id:string]: vscode.TextEditorDecorationType}) {
    let editors = vscode.window.visibleTextEditors;
    editors.forEach(editor => {
        let path = editor.document.uri.fsPath;
        if (path in decors) {
            decors[path].dispose();
            delete decors[path];
        }
        let ranges: Array<vscode.Range> = [];
        cache[path].forEach(value => {

            if (editor) {
                ranges.push(editor.document.lineAt(value - 1).range);
            }
        });
        let decor = getHighlightDecoration();
        editor.setDecorations(decor, ranges);
        decors[editor.document.uri.fsPath] = decor;
    });

}

function getHighlightDecoration(): vscode.TextEditorDecorationType {
    let decor = vscode.window.createTextEditorDecorationType(
        { backgroundColor: vscode.workspace.getConfiguration().get("python.coveragepy.highlight")}
    );
    return decor;
}

function runPytestCov() {
    if (!terminal) {
        terminal = vscode.window.createTerminal("PyTest-Cov");
    }
    terminal.sendText("py.test --cov=.", true);
}

