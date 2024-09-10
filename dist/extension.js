/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(__webpack_require__(1));
const child_process_1 = __webpack_require__(2);
const fs = __importStar(__webpack_require__(3));
const diagnostics_1 = __webpack_require__(4);
class NamingConventionFixProvider {
    provideCodeActions(document, range, context) {
        // 过滤出诊断信息中属于 'moduleNamingConvention' 的问题
        const diagnostics = context.diagnostics.filter(diag => diag.code === 'moduleNamingConvention');
        if (diagnostics.length === 0) {
            return;
        }
        // 创建一个修复操作
        const fix = new vscode.CodeAction(`Prepend 'telus-' to module name`, vscode.CodeActionKind.QuickFix);
        fix.edit = new vscode.WorkspaceEdit();
        const diagnostic = diagnostics[0];
        const moduleName = document.getText(diagnostic.range);
        // 添加 'telus-' 到 module name
        const newModuleName = `telus-${moduleName}`;
        fix.edit.replace(document.uri, diagnostic.range, newModuleName);
        fix.diagnostics = [diagnostic];
        return [fix];
    }
    // 注册该 Quick Fix 为可用的 CodeAction
    static providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix
    ];
}
function activate(context) {
    let disposable = vscode.commands.registerCommand('extension.prepopulateYangFile', () => {
        console.log("Command 'prepopulateYangFile' invoked.");
        const panel = vscode.window.createWebviewPanel('prepopulateYangFile', 'Prepopulate YANG File', vscode.ViewColumn.One, {});
        panel.webview.options = {
            enableScripts: true,
            enableCommandUris: true
        };
        panel.webview.html = getWebviewContent_prepopulation();
        panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'generateFile':
                    createYangFile(message.data);
                    return;
            }
        }, undefined, context.subscriptions);
    });
    context.subscriptions.push(disposable);
    context.subscriptions.push(vscode.commands.registerCommand('extension.yangValidation', () => {
        const panel = vscode.window.createWebviewPanel('yangValidation', 'YANG Validation', vscode.ViewColumn.One, { enableScripts: true });
        // 在 Webview 中展示 HTML 内容
        panel.webview.html = getWebviewContent_validation();
        // 处理 Webview 中的消息
        panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'validate':
                    validateYangFile(message.filePath, message.expectedVersion);
                    return;
            }
        }, undefined, context.subscriptions);
    }));
    const diagnostics = vscode.languages.createDiagnosticCollection('yang');
    context.subscriptions.push(diagnostics);
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((event) => {
        const document = event.document;
        diagnostics.clear();
        if (document.languageId === 'yang') {
            (0, diagnostics_1.validateNamingConventions)(document, diagnostics);
        }
    }));
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(document => {
        if (document.languageId === 'yang') {
            (0, diagnostics_1.validateNamingConventions)(document, diagnostics);
        }
    }));
    vscode.workspace.textDocuments.forEach((document) => {
        if (document.languageId === 'yang') {
            (0, diagnostics_1.validateNamingConventions)(document, diagnostics);
        }
    });
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(document => {
        diagnostics.clear();
        if (document.languageId === 'yang') {
            (0, diagnostics_1.validateNamingConventions)(document, diagnostics);
        }
    }));
    vscode.languages.registerCodeActionsProvider('yang', new NamingConventionFixProvider(), {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
    });
}
function getWebviewContent_prepopulation() {
    return `
        <html>
        <body>
            <h1>Prepopulate YANG File</h1>
            <form id="yangForm">
                <label>Module Name:</label><br>
                <input type="text" id="modulename"><br>
                
                <label>Import Name:</label><br>
                <input type="text" id="importname"><br>
                
                <label>Container Name:</label><br>
                <input type="text" id="containername"><br>
                
                <label>Container Description:</label><br>
                <input type="text" id="container_description"><br>
                
                <label>List Name:</label><br>
                <input type="text" id="listname"><br>
                
                <label>List Description:</label><br>
                <input type="text" id="list_description"><br>
                
                <label>Leaf Name:</label><br>
                <input type="text" id="leafname"><br>
                
                <label>Leaf Description:</label><br>
                <input type="text" id="leaf_description"><br><br>
                
                <button type="button" onclick="generateYangFile()">Generate YANG File</button>
            </form>
            <script>
                console.log("Webview loaded.");
                const vscode = acquireVsCodeApi();
                function generateYangFile() {
                    const data = {
                        modulename: document.getElementById('modulename').value,
                        importname: document.getElementById('importname').value,
                        containername: document.getElementById('containername').value,
                        container_description: document.getElementById('container_description').value,
                        listname: document.getElementById('listname').value,
                        list_description: document.getElementById('list_description').value,
                        leafname: document.getElementById('leafname').value,
                        leaf_description: document.getElementById('leaf_description').value,
                    };
                    console.log("Sending message to extension:", data);
                    vscode.postMessage({
                        command: 'generateFile',
                        data: data
                    });
                }
            </script>
        </body>
        </html>
    `;
}
function createYangFile(data) {
    const yangTemplate = `
module ${data.modulename} {
    namespace ${data.modulename};
    prefix arp;
    import ${data.importname} {
        prefix inet;
    }
    // Import more if needed
    container ${data.containername} {
        status deprecated;
        description "${data.container_description}";
        list ${data.listname} {
            status deprecated;
            description "${data.list_description}";
            leaf ${data.leafname} {
                status deprecated;
                description "${data.leaf_description}";
            }
        }
    }
}
`;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
        const filePath = vscode.Uri.joinPath(workspaceFolder.uri, `${data.modulename}.yang`);
        vscode.workspace.fs.writeFile(filePath, Buffer.from(yangTemplate, 'utf8')).then(() => {
            vscode.window.showInformationMessage(`YANG file '${data.modulename}.yang' generated successfully.`);
        });
    }
    else {
        vscode.window.showInformationMessage(`Error. Please generate the yang file under correct workspace folder`);
    }
}
function getWebviewContent_validation() {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>YANG Validation</title>
        </head>
        <body>
            <h1>YANG Validation</h1>
            <label for="version">Expected YANG Version:</label>
            <input type="text" id="version" placeholder="Enter YANG Version"/>
            <br><br>
            <label for="file">Select YANG File:</label>
            <input type="file" id="file"/>
            <br><br>
            <button onclick="validate()">Validate</button>

            <script>
                const vscode = acquireVsCodeApi();

                function validate() {
                    const version = document.getElementById('version').value;
                    const file = document.getElementById('file').files[0].path;

                    vscode.postMessage({
                        command: 'validate',
                        expectedVersion: version,
                        filePath: file
                    });
                }
            </script>
        </body>
        </html>
    `;
}
// 验证 YANG 文件的函数
function validateYangFile(filePath, expectedVersion) {
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            vscode.window.showErrorMessage(`Error reading file: ${err.message}`);
            return;
        }
        // 使用正则表达式查找文件中的 YANG 版本
        const versionMatch = data.match(/yang-version\s+(\d+\.\d+)/);
        let version = '1.0'; // 如果没有找到版本，默认使用 1.0
        if (versionMatch) {
            version = versionMatch[1];
            vscode.window.showInformationMessage(`YANG version ${version} found in the file.`);
        }
        else {
            vscode.window.showWarningMessage(`YANG version not specified, defaulting to ${version}.`);
        }
        // 检查版本是否匹配
        if (version === expectedVersion) {
            vscode.window.showInformationMessage(`YANG version ${version} matches expected version.`);
            const pyangCommand = `pyang ${filePath}`;
            (0, child_process_1.exec)(pyangCommand, (error, stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(`Error running pyang: ${error.message}`);
                    return;
                }
                if (stderr) {
                    vscode.window.showErrorMessage(`Pyang stderr: ${stderr}`);
                    return;
                }
                if (stdout) {
                    vscode.window.showInformationMessage(`Pyang validation successful:\n${stdout}`);
                }
                else {
                    vscode.window.showInformationMessage(`${filePath} validated successfully.`);
                }
            });
        }
        else {
            vscode.window.showErrorMessage(`Version mismatch! Found ${version}, but expected ${expectedVersion}.`);
        }
    });
}
function deactivate() { }


/***/ }),
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ ((module) => {

module.exports = require("child_process");

/***/ }),
/* 3 */
/***/ ((module) => {

module.exports = require("fs");

/***/ }),
/* 4 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.validateNamingConventions = validateNamingConventions;
const vscode = __importStar(__webpack_require__(1));
function validateNamingConventions(document, diagnostics) {
    const text = document.getText();
    const moduleRegex = /module\s+([\w-]+)\s*{/;
    const namespaceRegex = /namespace\s+"([^"]+)";/;
    const prefixRegex = /prefix\s+([\w-]+);/;
    const moduleMatch = moduleRegex.exec(text);
    const namespaceMatch = namespaceRegex.exec(text);
    const prefixMatch = prefixRegex.exec(text);
    let diagnosticList = [];
    if (moduleMatch) {
        const moduleName = moduleMatch[1];
        const moduleStart = moduleMatch.index + 7; // 'module ' length is 7
        const moduleRange = new vscode.Range(document.positionAt(moduleStart), document.positionAt(moduleStart + moduleName.length));
        if (!moduleName.startsWith('telus-')) {
            const diagnostic = new vscode.Diagnostic(moduleRange, `Module name "${moduleName}" should start with "telus-"`, vscode.DiagnosticSeverity.Warning);
            diagnostic.code = 'moduleNamingConvention'; // 设置诊断信息的代码，以便 CodeActionProvider 识别
            diagnosticList.push(diagnostic);
        }
        const moduleEndPosition = document.positionAt(moduleMatch.index + moduleMatch[0].length);
        const nextLine = moduleEndPosition.line + 1;
        const nextLineText = document.lineAt(nextLine).text.trim();
        // 如果下一行不包含注释，则发出警告
        if (!nextLineText.startsWith('//') && !nextLineText.startsWith('/*')) {
            const warningRange = new vscode.Range(new vscode.Position(nextLine, 0), new vscode.Position(nextLine, nextLineText.length));
            diagnosticList.push(new vscode.Diagnostic(warningRange, `Please provide the description for this module.`, vscode.DiagnosticSeverity.Warning));
        }
    }
    if (namespaceMatch) {
        const namespace = namespaceMatch[1];
        const namespaceStart = namespaceMatch.index + 11; // 'namespace "' length is 11
        const namespaceRange = new vscode.Range(document.positionAt(namespaceStart), document.positionAt(namespaceStart + namespace.length));
        if (!namespace.startsWith('https://tinaa.telus.com/')) {
            diagnosticList.push(new vscode.Diagnostic(namespaceRange, `Namespace "${namespace}" should start with "https://tinaa.telus.com/"`, vscode.DiagnosticSeverity.Warning));
        }
    }
    if (prefixMatch) {
        const prefix = prefixMatch[1];
        const prefixStart = prefixMatch.index + 7; // 'prefix ' length is 7
        const prefixRange = new vscode.Range(document.positionAt(prefixStart), document.positionAt(prefixStart + prefix.length));
        if (!prefix.startsWith('telus-')) {
            diagnosticList.push(new vscode.Diagnostic(prefixRange, `Prefix "${prefix}" should start with "telus-"`, vscode.DiagnosticSeverity.Warning));
        }
    }
    diagnostics.set(document.uri, diagnosticList);
}


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__(0);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=extension.js.map