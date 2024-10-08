import * as vscode from 'vscode';
import axios from 'axios';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { validateNamingConventions } from './diagnostics';


class NamingConventionFixProvider implements vscode.CodeActionProvider {
    provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext): vscode.CodeAction[] | undefined {
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
    static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix
    ];
}


export function activate(context: vscode.ExtensionContext) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
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


    context.subscriptions.push(
        vscode.commands.registerCommand('extension.connectGitLab', () => {
            const panel = vscode.window.createWebviewPanel(
                'gitLabConnection',
                'Connect to GitLab',
                vscode.ViewColumn.One,
                {
                    enableScripts: true
                }
            );

            // 设置Webview内容
            panel.webview.html = getWebviewContent_gitlabconnection();

            // 监听来自Webview的消息
            panel.webview.onDidReceiveMessage(async message => {
                if (message.command === 'selectCAFile') {
                    // 打开文件选择对话框
                    const caFileUri = await vscode.window.showOpenDialog({
                        canSelectFiles: true,
                        openLabel: 'Select CA Certificate',
                        filters: {
                            'Certificate Files': ['crt', 'pem'],
                            'All Files': ['*']
                        }
                    });

                    if (caFileUri && caFileUri.length > 0) {
                        const caFilePath = caFileUri[0].fsPath;
                        panel.webview.postMessage({ command: 'caFilePath', path: caFilePath });
                    }
                } else if (message.command === 'connect') {
                    const { gitLabUrl, privateToken, caFilePath } = message;

                    if (!gitLabUrl || !privateToken || !caFilePath) {
                        vscode.window.showErrorMessage('GitLab URL, Private Token, and CA file are required.');
                        return;
                    }

                    try {
                        const ca = fs.readFileSync(caFilePath);
                        console.log(ca);

                        const response = await axios.get(gitLabUrl, {
                            headers: {
                                'PRIVATE-TOKEN': privateToken
                            },
                            httpsAgent: new https.Agent({
                                ca: ca,
                                rejectUnauthorized: false
                            })
                        });

                        if (response.status === 200) {
                            vscode.window.showInformationMessage('Successfully connected to GitLab!');
                        }
                    } catch (error) {
                        if (error instanceof Error) {
                            vscode.window.showErrorMessage(`Failed to connect: ${error.message}`);
                        } else {
                            vscode.window.showErrorMessage('Unknown error occurred.');
                        }
                    }
                }
            });
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.triggerPipeline', function () {
            // 创建一个 Webview 面板
            const panel = vscode.window.createWebviewPanel(
                'triggerPipeline',
                'Trigger Pipeline',
                vscode.ViewColumn.One,
                {
                    enableScripts: true // 允许 Webview 执行脚本
                }
            );
    
            // 为 Webview 设置 HTML 内容
            panel.webview.html = getWebviewContent_triggerpipeline();
    
            // 处理从 Webview 传来的消息
            panel.webview.onDidReceiveMessage(async (message) => {
                if (message.command === 'triggerPipeline') {
                    try {
                        // 1. 弹出文件选择对话框，用户选择证书文件
                        const fileUri = await vscode.window.showOpenDialog({
                            canSelectMany: false,
                            openLabel: 'Select Certificate',
                            filters: {
                                'Certificates': ['crt', 'pem', 'cer']
                            }
                        });
    
                        if (fileUri && fileUri.length > 0) {
                            const pathToCert = fileUri[0].fsPath;
    
                            // 读取证书文件
                            const ca = fs.readFileSync(pathToCert);
    
                            // 创建 Post 数据
                            const postdata = new FormData();
                            postdata.append('token', message.triggerToken);
                            postdata.append('variables[COMMIT_ID]', message.commitId);
                            postdata.append('variables[ENTITY_NAME]', message.entityName);
                            postdata.append('variables[MODEL_COMMIT_ID]', message.modelCommitId);
                            postdata.append('variables[MODEL_FILENAME]', message.modelFilename);
                            postdata.append('variables[MODEL_NAME]', message.modelName);
                            postdata.append('variables[MODEL_URL]', message.modelUrl);
                            postdata.append('variables[URL]', message.url);
    
                            // GitLab API 的触发 URL
                            const pipeurl = `https://gitlab.tinaa.osc.tac.net/api/v4/projects/720/trigger/pipeline`;
    
                            // 发送请求触发流水线
                            const response = await axios.post(pipeurl, postdata, {
                                headers: {
                                    'PRIVATE-TOKEN': message.privateToken,
                                },
                                httpsAgent: new https.Agent({
                                    ca: ca,
                                    rejectUnauthorized: false,
                                }),
                            });
    
                            // 成功触发流水线后
                            if (response.status === 201 || response.status === 200) {
                                vscode.window.showInformationMessage('Pipeline triggered successfully!');
    
                                // 获取流水线状态和 ID
                                const pipelinesUrl = `https://gitlab.tinaa.osc.tac.net/api/v4/projects/720/pipelines`;
                                const pipelinesResponse = await axios.get(pipelinesUrl, {
                                    headers: { 'PRIVATE-TOKEN': message.privateToken },
                                    httpsAgent: new https.Agent({
                                        ca: ca,
                                        rejectUnauthorized: false,
                                    }),
                                    params: {
                                        ref: message.ref,
                                        per_page: 1,
                                        order_by: 'id',
                                        sort: 'desc',
                                    },
                                });
    
                                if (pipelinesResponse.status === 200 && pipelinesResponse.data.length > 0) {
                                    const pipelineId = pipelinesResponse.data[0].id;
                                    vscode.window.showInformationMessage(`Pipeline ID: ${pipelineId}`);
                                    panel.webview.postMessage({ command: 'pipelineId', pipelineId: pipelineId });
                                } else {
                                    vscode.window.showErrorMessage('Failed to retrieve the latest pipeline ID');
                                }
                            } else {
                                vscode.window.showErrorMessage(`Failed to trigger pipeline: ${response.statusText}`);
                            }
                        } else {
                            vscode.window.showErrorMessage('Certificate file was not selected.');
                        }
                    } catch (error) {
                        const errorMessage = (error as Error).message || 'Unknown error';
                        vscode.window.showErrorMessage(`Error triggering pipeline: ${errorMessage}`);
                    }
                }
            });
        })
    );



    context.subscriptions.push(
        vscode.commands.registerCommand('extension.yangQuickValidation', () => {
            vscode.window.showInformationMessage("The command is invoked!");
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const document = editor.document;
                const filePath = document.uri.fsPath;
    
                // 调用 pyang 来验证 YANG 文件
                exec(`pyang ${filePath}`, (error, stdout, stderr) => {
                    if (error) {
                        vscode.window.showErrorMessage(`Error running pyang: ${error.message}`);
                        return;
                    }
                    if (stderr) {
                        vscode.window.showErrorMessage(`pyang validation error: ${stderr}`);
                        return;
                    }
                    vscode.window.showInformationMessage(`Validation successful: ${stdout}`);
                });
            }else{
                
            }
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

function getWebviewContent_triggerpipeline() {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <body>
            <h2>Trigger GitLab Pipeline</h2>

            <label for="privateToken">Private Token:</label><br>
            <input type="text" id="privateToken" /><br>

            <label for="triggerToken">Trigger Token:</label><br>
            <input type="text" id="triggerToken" /><br>

            <label for="ref">Ref:</label><br>
            <input type="text" id="ref" /><br>

            <label for="commitId">Commit ID:</label><br>
            <input type="text" id="commitId" /><br>

            <label for="entityName">Entity Name:</label><br>
            <input type="text" id="entityName" /><br>

            <label for="modelCommitId">Model Commit ID:</label><br>
            <input type="text" id="modelCommitId" /><br>

            <label for="modelFilename">Model Filename:</label><br>
            <input type="text" id="modelFilename" /><br>

            <label for="modelName">Model Name:</label><br>
            <input type="text" id="modelName" /><br>

            <label for="modelUrl">Model URL:</label><br>
            <input type="text" id="modelUrl" /><br>

            <label for="url">URL:</label><br>
            <input type="text" id="url" /><br><br>

            <button id="triggerPipelineButton">Trigger Pipeline</button>

            <script>
                const vscode = acquireVsCodeApi();

                document.getElementById('triggerPipelineButton').addEventListener('click', () => {
                    const privateToken = document.getElementById('privateToken').value;
                    const triggerToken = document.getElementById('triggerToken').value;
                    const ref = document.getElementById('ref').value;
                    const commitId = document.getElementById('commitId').value;
                    const entityName = document.getElementById('entityName').value;
                    const modelCommitId = document.getElementById('modelCommitId').value;
                    const modelFilename = document.getElementById('modelFilename').value;
                    const modelName = document.getElementById('modelName').value;
                    const modelUrl = document.getElementById('modelUrl').value;
                    const url = document.getElementById('url').value;

                    vscode.postMessage({
                        command: 'triggerPipeline',
                        privateToken,
                        triggerToken,
                        ref,
                        commitId,
                        entityName,
                        modelCommitId,
                        modelFilename,
                        modelName,
                        modelUrl,
                        url
                    });
                });
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


function getWebviewContent_gitlabconnection(){
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Connect to GitLab</title>
        </head>
        <body>
            <h2>Connect to GitLab</h2>
            <form>
                <label for="gitLabUrl">GitLab URL:</label><br>
                <input type="text" id="gitLabUrl" name="gitLabUrl" placeholder="https://gitlab.yourcompany.com"><br>
                <label for="privateToken">Private Token:</label><br>
                <input type="password" id="privateToken" name="privateToken"><br>
                <label for="caFile">CA Certificate Path:</label><br>
                <input type="text" id="caFile" readonly><br>
                <button type="button" id="selectCAFileButton">Select CA Certificate</button><br><br>
                <button type="button" id="connectButton">Connect to GitLab</button>
            </form>

            <script>
                const vscode = acquireVsCodeApi();

                // 选择 CA 文件
                document.getElementById('selectCAFileButton').addEventListener('click', () => {
                    vscode.postMessage({ command: 'selectCAFile' });
                });

                // 连接到 GitLab
                document.getElementById('connectButton').addEventListener('click', () => {
                    const gitLabUrl = document.getElementById('gitLabUrl').value;
                    const privateToken = document.getElementById('privateToken').value;
                    const caFilePath = document.getElementById('caFile').value;
                    vscode.postMessage({
                        command: 'connect',
                        gitLabUrl,
                        privateToken,
                        caFilePath
                    });
                });

                // 接收 CA 文件路径的回调
                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'caFilePath') {
                        document.getElementById('caFile').value = message.path;
                    }
                });
            </script>
        </body>
        </html>
    `;
    
}

// 连接到 GitLab 的函数
async function connectToGitLab(gitLabUrl: string, privateToken: string, pathToCert: string) {
    if (gitLabUrl === '' || privateToken === '' || pathToCert === '') {
        vscode.window.showErrorMessage('GitLab URL, Token, and Path to Certification are required.');
        return;
    }
    
    if (!fs.existsSync(pathToCert)) {
        vscode.window.showErrorMessage('CA cert not found');
        return;
    }

    const ca = fs.readFileSync(pathToCert);

    try {
        const response = await axios.get(gitLabUrl, {
            headers: {
                'PRIVATE-TOKEN': privateToken
            },
            httpsAgent: new https.Agent({
                ca: ca,
                rejectUnauthorized: false
            })
        });

        if (response.status === 200) {
            vscode.window.showInformationMessage('Successfully connected to GitLab');
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        } else if (error instanceof Error) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        } else {
            vscode.window.showErrorMessage('Unknown error occurred');
        }
    }
}

export function deactivate() {}
