import { workspace } from 'vscode';
import { Configuration } from './interfaces';

export const CONFIG: Configuration = {};

export function setConfiguration(): void {
	const getConfig = workspace.getConfiguration('sortEditors');

	Object.assign(CONFIG, {
		sortEditorsAutomatically: getConfig.get('sortEditorsAutomatically'),
		sortEditorsOrder: getConfig.get('sortEditorsOrder')
	});
}
