import { debounce } from 'debounce';
import { basename } from 'path';
import {
	commands, ConfigurationTarget, Disposable, ExtensionContext, ProgressLocation, ProgressOptions,
	TabGroup, TabInputText, TextDocument, window, workspace
} from 'vscode';

let autoSortDisposable: Disposable | undefined;

// this method is called when your extension is activated
export function activate(context: ExtensionContext) {

	const collator = new Intl.Collator(undefined, {
		numeric: true,
		sensitivity: 'base',
		ignorePunctuation: true
	});

	const progressOptions: ProgressOptions = {
		location: ProgressLocation.Notification,
		title: 'Sorting files',
		cancellable: true
	};

	function sortTabGroupEditors(tabGroups: readonly TabGroup[]) {
		const sortOrder = workspace.getConfiguration('sortEditors').get('sortEditorsOrder');
		const formatPath = (a: string) => sortOrder === 'alphabetical' ? basename(a) : a;

		return tabGroups.flatMap(g => {
			return g.tabs
				.filter(t => t.input instanceof TabInputText)
				.map(t => ({ ...t, uri: (t.input as TabInputText).uri }))
				.sort((a, b) => b.isPinned ? 1 : collator.compare(formatPath(a.uri.path), formatPath(b.uri.path)));
		});
	}

	async function sortActiveEditor(editor: TextDocument) {
		const editors = sortTabGroupEditors([window.tabGroups.activeTabGroup]);

		for (let i = 0; i < editors.length; i++) {
			if (editors[i].uri.path === editor.uri.path) {
				await commands.executeCommand('moveActiveEditor', { to: 'position', value: i + 1 });
				break;
			}
		}
	}

	async function sortAllOpenedEditors(tabGroups: readonly TabGroup[]) {
		const editors = sortTabGroupEditors(tabGroups);
		const lastActiveEditor = window.activeTextEditor;
		const increment = 100 / editors.length;

		await window.withProgress(progressOptions, async (progress, cancellationToken) => {
			for (let i = 0; i < editors.length; i++) {
				if (cancellationToken.isCancellationRequested) {
					break;
				}

				progress.report({ message: `${i + 1}/${editors.length}` });

				if (editors[i].isPinned === false) {
					await window.showTextDocument(editors[i].uri, { preview: false, viewColumn: editors[i].group.viewColumn });
					await commands.executeCommand('moveActiveEditor', { to: 'position', value: i + 1 });
				}

				progress.report({ increment });
			}
		});

		if (lastActiveEditor) {
			await window.showTextDocument(lastActiveEditor.document, { viewColumn: lastActiveEditor.viewColumn });
		}
	}

	function applyAutoSorting() {
		const config = workspace.getConfiguration('sortEditors').get('sortEditorsAutomatically');
		if (config === true) {
			autoSortDisposable = workspace.onDidOpenTextDocument(debounce(sortActiveEditor, 50));
			context.subscriptions.push(autoSortDisposable);
		} else if (autoSortDisposable) {
			autoSortDisposable.dispose();
		}

		return config;
	}

	applyAutoSorting();

	function toggleAutoSorting(value: boolean) {
		const config = workspace.getConfiguration('sortEditors');
		config.update('sortEditorsAutomatically', value, ConfigurationTarget.Global);
	}

	function onToggleAutoSorting() {
		const config = applyAutoSorting();
		if (config === true && window.tabGroups.activeTabGroup.tabs.length > 0) {
			window.showInformationMessage('Automatic Sorting is Enabled. Do you want to sort opened editors?', 'Yes', 'No')
				.then(answer => { answer === 'Yes' && sortAllOpenedEditors([window.tabGroups.activeTabGroup]); });
			return;
		}

		window.showInformationMessage(`Automatic Sorting is ${config ? 'Enabled' : 'Disabled'}`);
	}

	function onToggleSortingOrder() {
		const sortOrder = workspace.getConfiguration('sortEditors').get('sortEditorsOrder');
		if (window.tabGroups.activeTabGroup.tabs.length > 0) {
			window.showInformationMessage(`Sorting order changed to ${sortOrder}. Do you want to sort opened editors?`, 'Yes', 'No')
				.then(answer => { answer === 'Yes' && sortAllOpenedEditors([window.tabGroups.activeTabGroup]); });
			return;
		}

		window.showInformationMessage(`Sorting order changed to ${sortOrder}`);
	}

	workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration('sortEditors.sortEditorsAutomatically')) {
			onToggleAutoSorting();
		} else if (e.affectsConfiguration('sortEditors.sortEditorsOrder')) {
			onToggleSortingOrder();
		}
	});

	context.subscriptions.push(...[
		commands.registerCommand('sortEditors.sortActiveEditor', () => {
			window.activeTextEditor && sortActiveEditor(window.activeTextEditor.document);
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
}

// this method is called when your extension is deactivated
export function deactivate() {
	if (autoSortDisposable) {
		autoSortDisposable.dispose();
	}
}
