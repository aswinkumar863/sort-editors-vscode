import { basename } from 'path';
import {
    commands, ProgressLocation, ProgressOptions, TabGroup, TabInputText, window, workspace
} from 'vscode';

import { CONFIG } from './configuration';

const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: 'base',
    ignorePunctuation: true
});

const progressOptions: ProgressOptions = {
    location: ProgressLocation.Notification,
    title: 'Sorting editors',
    cancellable: true
};

function sortTabGroupEditors(tabGroups: readonly TabGroup[]) {
    const formatPath = (a: string) => CONFIG.sortEditorsOrder === 'alphabetical' ? basename(a) : a;

    return tabGroups.flatMap(g => {
        return g.tabs
            .filter(t => t.input instanceof TabInputText)
            .map(t => ({ ...t, uri: (t.input as TabInputText).uri }))
            .sort((a, b) => b.isPinned ? 1 : collator.compare(formatPath(a.uri.path), formatPath(b.uri.path)));
    });
}

export async function sortActiveEditor(openedEditors: Array<String>) {
    const sortedEditors = sortTabGroupEditors([window.tabGroups.activeTabGroup]);

    for (let i = 0; i < sortedEditors.length; i++) {
        if (openedEditors.includes(sortedEditors[i].uri.path)) {
            try {
                await commands.executeCommand('moveActiveEditor', { to: 'position', value: i + 1 });
            } catch (error: any) {
                window.showErrorMessage(error.message ?? 'Unknown Exception');
            }
            break;
        }
    }
}

export async function sortAllOpenedEditors(tabGroups: readonly TabGroup[]) {
    const sortedEditors = sortTabGroupEditors(tabGroups);
    const lastActiveEditor = window.activeTextEditor;
    const increment = 100 / sortedEditors.length;

    await window.withProgress(progressOptions, async (progress, cancellationToken) => {
        for (let i = 0; i < sortedEditors.length; i++) {
            if (cancellationToken.isCancellationRequested) {
                break;
            }

            progress.report({ message: `${i + 1}/${sortedEditors.length}` });

            if (sortedEditors[i].isPinned === false) {
                try {
                    await window.showTextDocument(sortedEditors[i].uri, { preview: false, viewColumn: sortedEditors[i].group.viewColumn });
                    await commands.executeCommand('moveActiveEditor', { to: 'position', value: i + 1 });
                } catch (error: any) {
                    window.showErrorMessage(error.message ?? 'Unknown Exception');
                }
            }

            progress.report({ increment });
        }
    });

    if (lastActiveEditor) {
        try {
            await window.showTextDocument(lastActiveEditor.document, { viewColumn: lastActiveEditor.viewColumn });
        } catch (error: any) {
            window.showErrorMessage(error.message ?? 'Unknown Exception');
        }
    }
}
