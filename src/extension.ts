import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { validateNamingConventions } from './diagnostics';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('extension.prepopulateYangFile', () => {
        console.log("Command 'prepopulateYangFile' invoked.");
        const panel = vscode.window.createWebviewPanel(
            'prepopulateYangFile',
            'Prepopulate YANG File',
            vscode.ViewColumn.One,
            {}
        );

        panel.webview.options = {
            enableScripts:true,
            enableCommandUris:true
        };
        
        panel.webview.html = getWebviewContent_prepopulation();

        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'generateFile':
                        createYangFile(message.data);
                        return;
                }
            },
            undefined,
            context.subscriptions
        );
    });

    context.subscriptions.push(disposable);

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.yangValidation', () => {
            const panel = vscode.window.createWebviewPanel(
                'yangValidation',
                'YANG Validation',
                vscode.ViewColumn.One,
                { enableScripts: true }
            );

            // 在 Webview 中展示 HTML 内容
            panel.webview.html = getWebviewContent_validation();

            // 处理 Webview 中的消息
            panel.webview.onDidReceiveMessage(
                message => {
                    switch (message.command) {
                        case 'validate':
                            validateYangFile(message.filePath, message.expectedVersion);
                            return;
                    }
                },
                undefined,
                context.subscriptions
            );
        })
    );

    const diagnostics = vscode.languages.createDiagnosticCollection('yang');
	context.subscriptions.push(diagnostics);

	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument((event) => {
			const document = event.document;
			diagnostics.clear();
			if (document.languageId === 'yang') {
				validateNamingConventions(document, diagnostics);
			}
		})
	);
	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument(document => {
			if (document.languageId === 'yang') {
				validateNamingConventions(document, diagnostics);
			}
		})
	);
	vscode.workspace.textDocuments.forEach((document) => {
		if (document.languageId === 'yang') {
			validateNamingConventions(document, diagnostics);
		}
	});
	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument(document => {
			diagnostics.clear();
			if (document.languageId === 'yang') {
				validateNamingConventions(document, diagnostics);
			}
		})
	);

    
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

function createYangFile(data: any) {
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
else{
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
function validateYangFile(filePath: string, expectedVersion: string) {
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            vscode.window.showErrorMessage(`Error reading file: ${err.message}`);
            return;
        }

        // 使用正则表达式查找文件中的 YANG 版本
        const versionMatch = data.match(/yang-version\s+(\d+\.\d+)/);
        let version = '1.0';  // 如果没有找到版本，默认使用 1.0
        if (versionMatch) {
            version = versionMatch[1];
            vscode.window.showInformationMessage(`YANG version ${version} found in the file.`);
        } else {
            vscode.window.showWarningMessage(`YANG version not specified, defaulting to ${version}.`);
        }

        // 检查版本是否匹配
        if (version === expectedVersion) {
            vscode.window.showInformationMessage(`YANG version ${version} matches expected version.`);
			const pyangCommand = `pyang ${filePath}`;
            exec(pyangCommand, (error, stdout, stderr) => {
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
                } else {
                    vscode.window.showInformationMessage(`${filePath} validated successfully.`);
                }
            });
        } else {
            vscode.window.showErrorMessage(`Version mismatch! Found ${version}, but expected ${expectedVersion}.`);
        }
    });
}

export function deactivate() {}
