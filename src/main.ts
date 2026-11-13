import { Plugin, Notice } from 'obsidian';
import { KeepBoardView, VIEW_TYPE_KEEP_BOARD } from './view';

export default class KeepBoardPlugin extends Plugin {
	async onload() {
		// Register the custom view
		this.registerView(
			VIEW_TYPE_KEEP_BOARD,
			(leaf) => new KeepBoardView(leaf)
		);

		// Add a ribbon icon to open the board
		this.addRibbonIcon('layout-grid', 'Open Keep Board', () => {
			this.activateView();
		});

		// Add a command to open the board
		this.addCommand({
			id: 'open-keep-board',
			name: 'Open Keep Board',
			callback: () => {
				this.activateView();
			}
		});
	}

	onunload() {
		// Clean up any open views
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_KEEP_BOARD);
		for (const leaf of leaves) {
			leaf.detach();
		}
	}

	async activateView() {
		const { workspace } = this.app;

		// Check if the view already exists
		const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_KEEP_BOARD);
		if (existingLeaves.length > 0) {
			// Focus the existing view
			const existingLeaf = existingLeaves[0];
			if (existingLeaf) {
				workspace.revealLeaf(existingLeaf);
			}
			return;
		}

		// Create a new leaf for the view
		let leaf = workspace.getLeaf('tab');
		if (leaf === undefined) {
			new Notice('Failed to create leaf for Keep Board');
			return;
		}
		await leaf.setViewState({ type: VIEW_TYPE_KEEP_BOARD, active: true });
		workspace.revealLeaf(leaf);
	}
}