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
            updateOpenedEditors(workspaceCache, decorCache);
        }
    });

    vscode.workspace.onDidChangeTextDocument(ev => {
        if (!ev.document.fileName.endsWith("py")) {
            return;
        }
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
    vscode.workspace.findFiles(getCoverageFilePattern()).then(values => {
        values.forEach(value => {

            let content = fs.readFileSync(value.fsPath);

            let x = content.indexOf("{");
            if (x >= 0) {
                let buffer = content.slice(x);
                let jsonData = JSON.parse(buffer.toString());
                processCoverageFileContent(jsonData, cache, decors)
            }
        });
    });
}

function processCoverageFileContent(jsonData: any, cache: {[id:string]: Array<any>}, decors: {[id:string]: vscode.TextEditorDecorationType}){
    if ('arcs' in jsonData) {     
        console.log("Arcs data found.")   
        Object.keys(jsonData.arcs).forEach(
            key => {
                let lines = new Set();
                let arcs: Array<any> = jsonData.arcs[key];
                arcs.forEach(
                    item => {
                        //get the nums as long as they are not nega
                        item.forEach(
                            (subitem: any) => {
                                if (subitem > 0) { 
                                    lines.add(subitem);
                                }
                            }
                        );
                    }
                );
                cache[key] = Array.from(lines.values());
            }
        );   
    } else {
        Object.keys(jsonData.lines).forEach(
            key => {
                cache[key] = jsonData.lines[key];
            }
        );
    }
    updateOpenedEditors(cache, decors);
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
            processCoverageFileContent(jsonData, cache, decors);
        }
    });
}

function updateOpenedEditors(cache: { [id: string]: Array<any> }, decors:{[id:string]: vscode.TextEditorDecorationType}) {
    let editors = vscode.window.visibleTextEditors;
    let mode = vscode.workspace.getConfiguration().get("python.coverageView.highlightMode")
    editors.forEach(editor => {
        let path = editor.document.uri.fsPath;
        if (path in decors) {
            decors[path].dispose();
            delete decors[path];
        }
        let ranges: Array<vscode.Range> = [];
        if (mode === "covered") {
            cache[path].forEach(value => {
                if (editor && !isCommentOrDocstring(editor.document.lineAt(value -1).text)) {
                    ranges.push(editor.document.lineAt(value - 1).range);
                }
            });
        } else {
            let lines = new Set(Array.from(Array(editor.document.lineCount).keys()));
            cache[path].forEach(value => {
                lines.delete(value-1);
            });
            lines.forEach(value => {
                if (editor && !isCommentOrDocstring(editor.document.lineAt(value).text)) {
                    ranges.push(editor.document.lineAt(value).range);
                }
            });

        }
        let decor = getHighlightDecoration();
        editor.setDecorations(decor, ranges);
        decors[editor.document.uri.fsPath] = decor;
    });

}

function isCommentOrDocstring(line: string): boolean {
    line = line.trimLeft();
    return (line.length > 0 && (line.charAt(0) == "#" || line.startsWith("\"\"\""))) ;
}

function getHighlightDecoration(): vscode.TextEditorDecorationType {
    let decor = vscode.window.createTextEditorDecorationType(
        { backgroundColor: vscode.workspace.getConfiguration().get("python.coverageView.highlight")}
    );
    return decor;
}

function runPytestCov() {
    if (!terminal) {
        terminal = vscode.window.createTerminal("PyTest-Cov");
    }
    terminal.sendText("py.test --cov=.", true);
}

