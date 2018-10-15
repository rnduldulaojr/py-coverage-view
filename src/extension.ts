    'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import {exec} from 'child_process';


class CoverageStats {
    public lines : Array<any>;
    public numLines : string;
    public missedLines: string;
    public percentCovered: string;
    constructor(lines: Array<any>, numLines: string, missedLines: string, percentCovered:string) {
        this.lines = lines;
        this.numLines = numLines;
        this.missedLines = missedLines;
        this.percentCovered = percentCovered;
    }

}


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    let workspaceCache: { [id: string]: CoverageStats } = {};
    let decorCache: { [id: string]: vscode.TextEditorDecorationType } = {};
    let outputChannel = vscode.window.createOutputChannel("PyCov-Test");
    let statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    //initialize

    initCache(workspaceCache, decorCache);
    let covFileWatcher = vscode.workspace.createFileSystemWatcher(getCoverageFilePattern(), false, false, false);
    covFileWatcher.onDidChange((uri) => {
        //console.log("Coverage file changed");
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
     
        if (editor) {
            //get TOTAL path if any
            let total = "-";
            if ("TOTAL" in workspaceCache) {
                total = workspaceCache["TOTAL"].percentCovered;
            }
            let path = editor.document.uri.fsPath;

            if (path in workspaceCache) {
                //let stats = workspaceCache[path];
                if (total !== '-') {
                    total = workspaceCache[path].percentCovered + "   /   " + total + (" (OVERALL)");
                } else {
                    total = workspaceCache[path].percentCovered;
                }
                updateStatusBar(statusBar, workspaceCache[path].numLines, workspaceCache[path].missedLines, total);
            }
        }
    });

    vscode.workspace.onDidChangeTextDocument(ev => {
        if (!ev.document.fileName.endsWith("py")) {
            updateStatusBar(statusBar, "-", "-", "-");  
            return;
        }
        //console.log(ev.document.uri.fsPath + " changed ");
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
            runPytestCov(outputChannel, statusBar, workspaceCache);
        }
    });

    //console.log('Congratulations, your extension "py-coverage-view" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('pycoveragedisplay.runPytestCov', () => {
        runPytestCov(outputChannel, statusBar, workspaceCache);
    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(statusBar);
    context.subscriptions.push(outputChannel);

    //init status bar:
   // updateStatusBar(statusBar, "-", "-", "-");    
    runPytestCov(outputChannel, statusBar, workspaceCache);
    

}

// this method is called when your extension is deactivated
export function deactivate() {
}

function initCache(cache: { [id: string]: CoverageStats }, decors: { [id: string]: vscode.TextEditorDecorationType } ) {
    console.log("Init cache");
    vscode.workspace.findFiles(getCoverageFilePattern()).then(values => {
        values.forEach(value => {

            let content = fs.readFileSync(value.fsPath);

            let x = content.indexOf("{");
            if (x >= 0) {
                let buffer = content.slice(x);
                let jsonData = JSON.parse(buffer.toString());
                processCoverageFileContent(jsonData, cache, decors);
            }
        });
    });
}

function processCoverageFileContent(jsonData: any, cache: {[id:string]: CoverageStats}, decors: {[id:string]: vscode.TextEditorDecorationType}){
    if ('arcs' in jsonData) {     
        //console.log("Arcs data found.")   
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
                if (key in cache) {
                    cache[key].lines = jsonData.lines[key];
                } else {
                    cache[key] = new CoverageStats(jsonData.lines[key],'-','-','-%');
                }
                
            }
        );   
    } else {
        Object.keys(jsonData.lines).forEach(
            key => {
                if (key in cache) {
                    cache[key].lines = jsonData.lines[key];
                } else {
                    cache[key] = new CoverageStats(jsonData.lines[key],'-','-','-%');
                }
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

function updateCache(cache: { [id: string]: CoverageStats }, uri: vscode.Uri, decors:{[id:string]: vscode.TextEditorDecorationType}) {
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
    updateOpenedEditors(cache, decors);
}

function updateOpenedEditors(cache: { [id: string]: CoverageStats }, decors:{[id:string]: vscode.TextEditorDecorationType}) {
    let editors = vscode.window.visibleTextEditors;
    if (editors.length === 0) {
        return;
    }
    let mode = vscode.workspace.getConfiguration().get("python.coverageView.highlightMode");
    editors.forEach(editor => {
        let path = editor.document.uri.fsPath;
        if (path in decors) {
            decors[path].dispose();
            delete decors[path];
        }
        let ranges: Array<vscode.Range> = [];
        if (mode === "covered" ) {
            if (path in cache) {
                let lines = cache[path].lines;
                lines.forEach(value => {
                    if (editor && !isIgnorable(editor.document.lineAt(value -1).text)) {
                        ranges.push(editor.document.lineAt(value - 1).range);
                    }
                });
            }
        } else {
            let rlines = new Set(Array.from(Array(editor.document.lineCount).keys()));
            if (path in cache) {
                let lines = cache[path].lines;
                lines.forEach(value => {
                    rlines.delete(value-1);
                });
            }
            rlines.forEach(value => {
                if (editor && !isIgnorable(editor.document.lineAt(value).text)) {
                    ranges.push(editor.document.lineAt(value).range);
                }
            });

        }
        let decor = getHighlightDecoration();
        editor.setDecorations(decor, ranges);
        decors[editor.document.uri.fsPath] = decor;
    });

}

function isIgnorable(line: string): boolean {
    line = line.trim();
    return (line.length > 0 && (line.charAt(0) === "#"    || 
                                line.startsWith("\"\"\"") || 
                                line === "pass"           || 
                                line === "else:"          ||
                                line === ""))             ||
                                line.startsWith("def ");
}

function getHighlightDecoration(): vscode.TextEditorDecorationType {
    let decor = vscode.window.createTextEditorDecorationType(
        { backgroundColor: vscode.workspace.getConfiguration().get("python.coverageView.highlight")}
    );
    return decor;
}

function runPytestCov(outputChannel: vscode.OutputChannel, statusBar: vscode.StatusBarItem, cache:  { [id: string]: CoverageStats }) {
    
    let folders = vscode.workspace.workspaceFolders;
    if (folders === undefined) {
        outputChannel.append("No folders...");
        return;
    }
    let rootPath = folders[0].uri.fsPath;
    let cmd = "cd " + rootPath + " && py.test --cov=. "; 
    if (!rootPath.endsWith("/")) {
        rootPath += "/";
    }
    //console.log(cmd)
    exec(cmd, (err, stdout, stderr) => {
       
        if (err) {
            outputChannel.append(stderr);
            console.log(stderr);
            updateStatusBar(statusBar, "-", "-", "-");
            return;
        }
         let lines = stdout.split("\n");
        lines.forEach(line => {
             if (line.trim().endsWith("%")) {
                let items = line.replace(/\s\s+/g, ' ').split(' ');
                if (items.length !== 4) {
                    return;
                } 
                let key = rootPath + items[0]; //the filename
                 if (key in cache) {
                    let stats = cache[key];
                    stats.numLines = items[1];
                    stats.missedLines = items[2];
                    stats.percentCovered = items[3];
                    cache[key] = stats;
                    
                } else if (items[0] === "TOTAL") {
                    cache["TOTAL"] = new CoverageStats(new Array(0), items[1], items[2], items[3]);
                } 

            }
        });
        
        let activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            //get TOTAL path if any
            let total = "-";
            if ("TOTAL" in cache) {
                total = cache["TOTAL"].percentCovered;
            }
            let path = activeEditor.document.uri.fsPath;
            if (path in cache) {
                if (total !== '-') {
                    total = cache[path].percentCovered + "   /   " + total + (" (OVERALL)");
                } else {
                    total = cache[path].percentCovered;
                }
                updateStatusBar(statusBar, cache[path].numLines, cache[path].missedLines, total);
            }
        }
       
    });
	
}



function updateStatusBar(statusBar: vscode.StatusBarItem, total: string, misses: string, percent: string) {
    statusBar.hide();
    let mode = vscode.workspace.getConfiguration().get("python.coverageView.highlightMode");
    statusBar.text = "Highlight: " + mode + "  Current File --  Lines: " + total + "   Misses: " + misses + "   Cover: " + percent;
    statusBar.show();
}
