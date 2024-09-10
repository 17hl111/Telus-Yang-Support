import * as vscode from 'vscode';
import { exec }  from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export function validateNamingConventions(document: vscode.TextDocument, diagnostics: vscode.DiagnosticCollection) {
        const text = document.getText();
        const moduleRegex = /module\s+([\w-]+)\s*{/;
        const namespaceRegex = /namespace\s+"([^"]+)";/;
        const prefixRegex = /prefix\s+([\w-]+);/;
    
        const moduleMatch = moduleRegex.exec(text);
        const namespaceMatch = namespaceRegex.exec(text);
        const prefixMatch = prefixRegex.exec(text);
    
        let diagnosticList: vscode.Diagnostic[] = [];
    
        if (moduleMatch) {
            const moduleName = moduleMatch[1];
            const moduleStart = moduleMatch.index + 7; // 'module ' length is 7
            const moduleRange = new vscode.Range(document.positionAt(moduleStart), document.positionAt(moduleStart + moduleName.length));
            if (!moduleName.startsWith('telus-')) {
                const diagnostic = new vscode.Diagnostic(
                    moduleRange,
                    `Module name "${moduleName}" should start with "telus-"`,
                    vscode.DiagnosticSeverity.Warning
                );
            
                diagnostic.code = 'moduleNamingConvention'; // 设置诊断信息的代码，以便 CodeActionProvider 识别
                diagnosticList.push(diagnostic);
            }

		const moduleEndPosition = document.positionAt(moduleMatch.index + moduleMatch[0].length);
		const nextLine = moduleEndPosition.line + 1;
		const nextLineText = document.lineAt(nextLine).text.trim();

        // 如果下一行不包含注释，则发出警告
        if (!nextLineText.startsWith('//') && !nextLineText.startsWith('/*')) {
            const warningRange = new vscode.Range(new vscode.Position(nextLine, 0), new vscode.Position(nextLine, nextLineText.length));
            diagnosticList.push(new vscode.Diagnostic(
                warningRange,
                `Please provide the description for this module.`,
                vscode.DiagnosticSeverity.Warning
            ));
        }
        }
    
        if (namespaceMatch) {
            const namespace = namespaceMatch[1];
            const namespaceStart = namespaceMatch.index + 11; // 'namespace "' length is 11
            const namespaceRange = new vscode.Range(document.positionAt(namespaceStart), document.positionAt(namespaceStart + namespace.length));
            if (!namespace.startsWith('https://tinaa.telus.com/')) {
                diagnosticList.push(new vscode.Diagnostic(
                    namespaceRange,
                    `Namespace "${namespace}" should start with "https://tinaa.telus.com/"`,
                    vscode.DiagnosticSeverity.Warning
                ));
            }
        }
    
        if (prefixMatch) {
            const prefix = prefixMatch[1];
            const prefixStart = prefixMatch.index + 7; // 'prefix ' length is 7
            const prefixRange = new vscode.Range(document.positionAt(prefixStart), document.positionAt(prefixStart + prefix.length));
            if (!prefix.startsWith('telus-')) {
                diagnosticList.push(new vscode.Diagnostic(
                    prefixRange,
                    `Prefix "${prefix}" should start with "telus-"`,
                    vscode.DiagnosticSeverity.Warning
                ));
            }
        }
    
        diagnostics.set(document.uri, diagnosticList);
}

