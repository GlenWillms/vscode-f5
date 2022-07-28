'use strict';

import path from "path";
import fs from "fs";

import {
    commands,
    ExtensionContext,
    Diagnostic,
    DiagnosticCollection,
    DiagnosticSeverity,
    languages,
    Position,
    Range,
    TextDocument,
    Uri
} from "vscode";

import { logger } from "./logger";

export type xcDiagRule = {
    code: string;
    severity: "Error" | "Warning" | "Information" | "Hint";
    title: string;
    message: string;
    regex: string;
};



export class XcDiag {

    diagXC: DiagnosticCollection;

    settingsFileLocation: string;
    rules: xcDiagRule[];

    constructor(context: ExtensionContext) {
        // create diag collection
        this.diagXC = languages.createDiagnosticCollection('f5-tmos-xc');

        this.settingsFileLocation = path.join(context.extensionPath, 'out', 'tmosXcRules.json'); 
        this.rules = this.loadRules();

    }

    loadRules() {
        logger.info("loading tmos -> xc rules file");
        return this.rules = JSON.parse(fs.readFileSync(this.settingsFileLocation).toString());
    }
    
    openRules() {
        // const loc = path.join(context.Extens)
        // workspace.openTextDocument(this.settingsFileLocation);
        logger.info("opening tmos -> xc rules file");
        return commands.executeCommand("vscode.open", Uri.file(this.settingsFileLocation));
        // workbench.action.files.openFile
    }

    getDiagnostic(text: string): Diagnostic[] {

        // setup diagnostics array
        const diags: Diagnostic[] = [];

        const severities = [];
    
        const lines = text.split('\n');
    
        lines.forEach((value, index) => {
    
            // loop through rules on each line
            this.rules.forEach(rule => {
    
                // if rule empty, pass
                if (rule.regex === '') { return; }
    
                // look for rule regex
                const match = value.match(rule.regex);
    
    
                if (match && match.index) {
    
                    // set rule severity
                    const severity
                        = rule.severity === "Error" ? DiagnosticSeverity.Error
                            : rule.severity === "Warning" ? DiagnosticSeverity.Warning
                                : rule.severity === "Information" ? DiagnosticSeverity.Information
                                    : DiagnosticSeverity.Hint;
    
                    // push diagnostic
                    diags.push({
                        code: rule.code,
                        message: rule.message,
                        range: new Range(
                            new Position(index, match.index),
                            new Position(index, match[0].length + match.index)
                        ),
                        severity
                    });

                    
                }
            });
        });
        return diags;
    }

    getDiagStats(diags: Diagnostic[]) {
        
        const stats: {
            Error?: number;
            Warning?: number;
            Information?: number;
            Hint?: number
        } = {};

        diags.forEach((d) => {

            if(d.severity === 0) {
                if( stats.Error ) {
                    stats.Error = stats.Error + 1;
                } else {
                    stats.Error =  1;
                }
            }

            if(d.severity === 1) {
                if( stats.Warning ) {
                    stats.Warning = stats.Warning + 1;
                } else {
                    stats.Warning =  1;
                }
            }

            if(d.severity === 2) {
                if( stats.Information ) {
                    stats.Information = stats.Information + 1;
                } else {
                    stats.Information =  1;
                }
            }
            
            if(d.severity === 3) {
                if( stats.Hint ) {
                    stats.Hint = stats.Hint + 1;
                } else {
                    stats.Hint =  1;
                }
            }


        });

        return stats;
    }

    updateDiagnostic(doc: TextDocument) {
        // clear current diags dispalyed
        this.diagXC.clear();

        // get the text from the doc/editor and feed through xc diagnostics
        const diags = this.getDiagnostic(doc.getText());

        // pubish the diags to document
        this.diagXC.set(doc.uri, diags);
    }
}

