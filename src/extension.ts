import {
	commands, ConfigurationTarget, Disposable, ExtensionContext, TabInputText, window, workspace
} from 'vscode';

import { CONFIG, setConfiguration } from './configuration';
import { sortActiveEditor, sortAllOpenedEditors } from './sorter';
import { promptToShowReleaseNotes } from './utils';

let autoSortDisposable: Disposable | undefined;

// this method is called when your extension is activated
export function activate(context: ExtensionContext) {

	// Set configuration
	setConfiguration();

	applyAutoSorting();

	function applyAutoSorting() {
		const config = CONFIG.sortEditorsAutomatically;
		if (config === true) {
			autoSortDisposable = window.tabGroups.onDidChangeTabs(({ opened }) => {
				const openedEditors = opened.filter(t => t.input instanceof TabInputText).map(t => (t.input as TabInputText).uri.path);
				openedEditors.length && sortActiveEditor(openedEditors);
			});
			context.subscriptions.push(autoSortDisposable);
		} else if (autoSortDisposable) {
			autoSortDisposable.dispose();
		}
	}

	context.subscriptions.push(...[
		commands.registerCommand('sortEditors.sortActiveEditor', () => {
			window.activeTextEditor && sortActiveEditor([window.activeTextEditor.document.uri.path]);
		}),

		commands.registerCommand('sortEditors.sortActiveTabEditors', () => {
			sortAllOpenedEditors([window.tabGroups.activeTabGroup]);
		}),

		commands.registerCommand('sortEditors.sortAllEditors', () => {
			sortAllOpenedEditors(window.tabGroups.all);
		}),

		commands.registerCommand('sortEditors.enableAutoSorting', () => {
			toggleAutoSorting(true);
		}),

		commands.registerCommand('sortEditors.disableAutoSorting', () => {
			toggleAutoSorting(false);
		})
	]);

	function toggleAutoSorting(value: boolean) {
		const config = workspace.getConfiguration('sortEditors');
		config.update('sortEditorsAutomatically', value, ConfigurationTarget.Global);
	}

	// Subscribe to configuration change
	workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration('sortEditors.sortEditorsAutomatically')) {
			setConfiguration();
			applyAutoSorting();
			autoSortingToggled();
		} else if (e.affectsConfiguration('sortEditors.sortEditorsOrder')) {
			setConfiguration();
			sortingOrderChanged();
		}
	});

	function autoSortingToggled() {
		const config = CONFIG.sortEditorsAutomatically;
		if (config === true && window.tabGroups.activeTabGroup.tabs.length > 0) {
			window.showInformationMessage('Automatic Sorting is Enabled. Do you want to sort opened editors?', 'Yes', 'No')
				.then(answer => { answer === 'Yes' && sortAllOpenedEditors([window.tabGroups.activeTabGroup]); });
			return;
		}

		window.showInformationMessage(`Automatic Sorting is ${config ? 'Enabled' : 'Disabled'}`);
	}

	function sortingOrderChanged() {
		const sortOrder = CONFIG.sortEditorsOrder;
		if (window.tabGroups.activeTabGroup.tabs.length > 0) {
			window.showInformationMessage(`Sorting order changed to ${sortOrder}. Do you want to sort opened editors?`, 'Yes', 'No')
				.then(answer => { answer === 'Yes' && sortAllOpenedEditors([window.tabGroups.activeTabGroup]); });
			return;
		}

		window.showInformationMessage(`Sorting order changed to ${sortOrder}`);
	}

	// Prompt to show release notes on extension updated
	promptToShowReleaseNotes(context);
}

// this method is called when your extension is deactivated
export function deactivate() {
	if (autoSortDisposable) {
		autoSortDisposable.dispose();
	}
}
