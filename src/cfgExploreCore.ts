/*
 * Copyright 2020. F5 Networks, Inc. See End User License Agreement ("EULA") for
 * license terms. Notwithstanding anything to the contrary in the EULA, Licensee
 * may copy and modify this software product for its internal business purposes.
 * Further, Licensee may upload, publish and distribute the modified version of
 * the software product on devcentral.f5.com or github.com/f5devcentral.
 */

'use strict';

import { window, commands, ExtensionContext } from "vscode";
import { ext } from "./extensionVariables";
import { CfgProvider } from "./treeViewsProviders/cfgTreeProvider";
import fs from 'fs';

import { logger } from './logger';

export function cfgExplore(context: ExtensionContext) {


    const cfgProvider = new CfgProvider();
    // const cfgView = window.registerTreeDataProvider('cfgTree', cfgProvider);
    const cfgView = window.createTreeView('cfgTree', {
        treeDataProvider: cfgProvider,
        showCollapseAll: true,
        canSelectMany: true
    });

    context.subscriptions.push(commands.registerCommand('f5.cfgExploreOnConnect', async (item) => {

        if (!ext.f5Client) {
            await commands.executeCommand('f5.connectDevice', item.command.arguments[0]);
        }

        // return await ext.f5Client?.ucs?.
        return await ext.f5Client?.ucs?.get({ mini: true, localDestPathFile: ext.cacheDir })
            .then(async resp => {
                logger.debug('Got mini_ucs -> extracting config with corkscrew');
                cfgProvider.makeExplosion(resp.data.file);
            });
    }));

    /**
     * this command is exposed via right click in editor so user does not have to connect to F5
     * this flow assumes the file is local
     */
    context.subscriptions.push(commands.registerCommand('f5.cfgExplore', async (item) => {

        let filePath: string;

        if (!item) {
            // no input means we need to browse for a local file
            item = await window.showOpenDialog({
                canSelectMany: false
            });

            // if we got a file from the showOpenDialog, it comes in an array, even though we told it to only allow single item selection -> return the single array item
            if (Array.isArray(item)) {
                item = item[0];
            }
        }

        if (item?._fsPath) {

            logger.info(`f5.cfgExplore _fsPath recieved:`, item._fsPath);
            filePath = item._fsPath;

        } else if (item?.path) {

            logger.info(`f5.cfgExplore path revieved:`, item.path);
            filePath = item.path;

        } else {

            return logger.error('f5.cfgExplore -> Neither path supplied was valid', JSON.stringify(item));

        }

        try {
            // test that we can access the file
            const x = fs.statSync(filePath);
        } catch (e) {
            // if we couldn't get to the file, trim leading character
            // remove leading slash -> i think this is a bug like:  https://github.com/microsoft/vscode-remote-release/issues/1583
            // filePath = filePath.replace(/^(\\|\/)/, '');
            logger.info(`could not find file with supplied path of ${filePath}, triming leading character`);
            filePath = filePath.substr(1);
        }

        logger.info(`f5.cfgExplore: exploding config @ ${filePath}`);

        cfgProvider.makeExplosion(filePath);

        await new Promise(resolve => { setTimeout(resolve, 2000); });
        commands.executeCommand('cfgTree.focus');

    }));


    context.subscriptions.push(commands.registerCommand('f5.cfgExploreRawCorkscrew', async (text) => {
        // no input means we need to browse for a local file
        const file = await window.showOpenDialog({
            canSelectMany: false
        }).then(x => {
            if (Array.isArray(x)) {
                return x[0];
            }
        });

        let filePath;

        if (file?.fsPath) {

            logger.info(`f5.cfgExploreRawCorkscrew _fsPath recieved:`, file.fsPath);
            filePath = file.fsPath;

        } else if (file?.path) {

            logger.info(`f5.cfgExploreRawCorkscrew path revieved:`, file.path);
            filePath = file.path;

        } else {

            return logger.error('f5.cfgExploreRawCorkscrew -> Neither path supplied was valid', JSON.stringify(file));

        }

        try {
            // test that we can access the file
            const x = fs.statSync(filePath);
        } catch (e) {
            // if we couldn't get to the file, trim leading character
            // remove leading slash -> i think this is a bug like:  https://github.com/microsoft/vscode-remote-release/issues/1583
            // filePath = filePath.replace(/^(\\|\/)/, '');
            logger.info(`could not find file with supplied path of ${filePath}, triming leading character`);
            filePath = filePath.substr(1);
        }

        if (filePath) {
            try {
                const read = fs.readFileSync(filePath, 'utf-8');
                // parse json
                const read2 = JSON.parse(read);
                await cfgProvider.importExplosion(read2);
            } catch (e) {
                logger.error('cfgExploreRawCorkscrew import failed', e);
            }
        }

        cfgProvider.refresh();	// refresh with the new information
    }));



    context.subscriptions.push(commands.registerCommand('f5.cfgExploreReveal', async (text) => {
        // await new Promise(resolve => { setTimeout(resolve, 2000); });
        commands.executeCommand('cfgTree.focus');
        // if (cfgProvider.viewElement) {
        //     cfgView.reveal(cfgProvider.viewElement, {
        //         select: true,
        //         focus: true,
        //         expand: true
        //     });
        // }
    }));



    context.subscriptions.push(commands.registerCommand('f5.cfgExploreClear', async (text) => {
        cfgProvider.clear();
    }));

    context.subscriptions.push(commands.registerCommand('f5.cfgExploreRefresh', async (text) => {
        cfgProvider.refresh();
    }));

    context.subscriptions.push(commands.registerCommand('f5.cfgExplore-show', async (text) => {
        const x = cfgView.selection;
        let full: string[] = [];
        // let text2;
        if (Array.isArray(x) && x.length > 1) {
            // got multi-select array, push all necessary details to a single object

            x.forEach((el) => {
                const y = el.command?.arguments;
                if (y) {
                    full.push(y[0].join('\n'));
                    full.push('\n\n#############################################\n\n');
                }
            });
            text = full;

            // } else if (Array.isArray(x) && x.length === 1) {
            // 	return window.showWarningMessage('Select multiple apps with "Control" key');
        } else if (typeof text === 'string') {
            // just text, convert to single array with render
            text = [text];
        }

        // todo: add logic to catch single right click

        cfgProvider.render(text);
    }));



}