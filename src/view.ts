import {
	ItemView,
	WorkspaceLeaf,
	TFile,
	debounce,
	Debouncer,
} from 'obsidian';

export const VIEW_TYPE_KEEP_BOARD = 'keep-board';

interface NoteCard {
	file: TFile;
	el: HTMLElement;
	height: number;
}

export class KeepBoardView extends ItemView {
	private container: HTMLElement | null = null;
	private toolbar: HTMLElement | null = null;
	private searchInput: HTMLInputElement | null = null;
	private board: HTMLElement | null = null;
	private notes: NoteCard[] = [];
	private closeFocus: (() => void) | null = null;
	private renderGeneration = 0;
	private scrollPosition: number = 0;
	private resizeObserver: ResizeObserver | null = null;
	private renderDebounce: Debouncer<[], Promise<void>>;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.renderDebounce = debounce(() => this.renderBoard(), 100, true);
	}

	getViewType(): string {
		return VIEW_TYPE_KEEP_BOARD;
	}

	getDisplayText(): string {
		return 'Keep Board';
	}

	getIcon(): string {
		return 'layout-grid';
	}

	async onOpen() {
		this.container = this.contentEl;
		this.container.empty();
		this.container.addClass('keep-board-container');

		// Create toolbar
		this.toolbar = this.container.createDiv({ cls: 'keep-toolbar' });

		// Search input
		const searchWrapper = this.toolbar.createDiv({ cls: 'keep-search-wrapper' });
		const searchIcon = searchWrapper.createDiv({ cls: 'keep-search-icon' });
		searchIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';

		this.searchInput = searchWrapper.createEl('input', {
			type: 'text',
			placeholder: 'Search notes...',
			cls: 'keep-search-input',
		});

		this.searchInput.addEventListener('input', () => {
			this.renderBoard();
		});

		// Board container
		this.board = this.container.createDiv({ cls: 'keep-board' });

		// Setup resize observer
		this.resizeObserver = new ResizeObserver(() => {
			this.calculateMasonry();
		});
		if (this.board) {
			this.resizeObserver.observe(this.board);
		}

		// Register vault event handlers
		this.registerEvent(this.app.vault.on('create', (file) => {
			if (file instanceof TFile && file.extension === 'md') {
				this.renderDebounce();
			}
		}));

		this.registerEvent(this.app.vault.on('modify', (file) => {
			if (file instanceof TFile && file.extension === 'md') {
				this.renderDebounce();
			}
		}));

		this.registerEvent(this.app.vault.on('delete', (file) => {
			if (file instanceof TFile && file.extension === 'md') {
				this.renderDebounce();
			}
		}));

		this.registerEvent(this.app.vault.on('rename', () => {
			this.renderDebounce();
		}));

		this.registerEvent(this.app.metadataCache.on('changed', (file) => {
			if (file instanceof TFile && file.extension === 'md') {
				this.renderDebounce();
			}
		}));

		// Initial render
		await this.renderBoard();
	}

	async onClose() {
		this.renderDebounce.cancel();
		this.renderGeneration++;
		this.closeFocus?.();
		this.board = null;
		this.notes = [];
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
	}

	private async renderBoard() {
		if (!this.board) return;

		// Only the newest render may finish after asynchronous note reads.
		const generation = ++this.renderGeneration;
		const scrollPosition = this.board.scrollTop;

		// Clear board
		this.board.empty();
		this.notes = [];

		// Get all markdown files
		let files = this.app.vault.getMarkdownFiles();

		// Filter by search query
		if (this.searchInput) {
			const query = this.searchInput.value.trim().toLowerCase();
			if (query) {
				files = files.filter(file => {
					const name = file.basename.toLowerCase();
					const path = file.path.toLowerCase();
					return name.includes(query) || path.includes(query);
				});
			}
		}

		// Sort by modification time (newest first)
		files.sort((a, b) => b.stat.mtime - a.stat.mtime);

		// Render cards
		for (const file of files) {
			await this.renderCard(file, generation);
			if (generation !== this.renderGeneration) return;
		}

		// Calculate masonry layout
		this.calculateMasonry();

		// Restore scroll position
		this.board.scrollTop = scrollPosition;
	}

	private async renderCard(file: TFile, generation: number) {
		if (!this.board) return;

		const card = this.board.createDiv({ cls: 'keep-card' });
		card.dataset.path = file.path;

		// Card header with title
		const header = card.createDiv({ cls: 'keep-card-header' });
		const title = header.createDiv({ cls: 'keep-card-title' });
		title.setText(file.basename);

		// Card content preview
		try {
			const content = await this.app.vault.cachedRead(file);
			const preview = this.getPreview(content, file);
			if (preview) {
				const contentEl = card.createDiv({ cls: 'keep-card-content' });
				contentEl.setText(preview);
			}
		} catch (e) {
			// Ignore errors
		}

		if (generation !== this.renderGeneration) return;

		// Card footer with date
		const footer = card.createDiv({ cls: 'keep-card-footer' });
		const date = footer.createDiv({ cls: 'keep-card-date' });
		const modified = new Date(file.stat.mtime);
		date.setText(this.formatDate(modified));

		// Click handler for focus mode
		card.addEventListener('click', () => {
			this.openFocusMode(file);
		});

		this.notes.push({ file, el: card, height: 0 });
	}

	private getPreview(content: string, file: TFile): string {
		// Strip frontmatter
		let text = content;
		// Delimiters must occupy whole lines, not merely contain three dashes.
		text = text.replace(/^\uFEFF?---\r?\n(?:[\s\S]*?\r?\n)?(?:---|\.\.\.)(?:\r?\n|$)/, '');

		// Remove images
		text = text.replace(/!\[\[[^\]\r\n]*\]\]/g, '').replace(/!\[[^\]\r\n]*\]\([^\)\r\n]*\)/g, '');

		// Remove links but keep text
		text = text.replace(/\[\[([^\]\r\n]*)\]\]/g, '$1').replace(/\[([^\]\r\n]*)\]\([^\)\r\n]*\)/g, '$1');

		// Remove formatting
		text = text.replace(/#{1,6}\s+/g, '');
		text = text.replace(/\*\*(.*?)\*\*/g, '$1');
		text = text.replace(/\*(.*?)\*/g, '$1');
		text = text.replace(/`(.*?)`/g, '$1');

		// Limit length
		const maxLen = 200;
		if (text.length > maxLen) {
			text = text.substring(0, maxLen) + '...';
		}

		return text.trim();
	}

	private formatDate(date: Date): string {
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 1) return 'Just now';
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		if (days < 7) return `${days}d ago`;

		return date.toLocaleDateString();
	}

	private calculateMasonry() {
		if (!this.board) return;

		const boardWidth = this.board.clientWidth;
		const cardWidth = 300;
		const gap = 16;
		const columns = Math.max(1, Math.floor((boardWidth + gap) / (cardWidth + gap)));

		// Use CSS columns for masonry layout
		this.board.style.columnCount = `${columns}`;
		this.board.style.columnGap = `${gap}px`;

		// Style cards for column layout
		for (const note of this.notes) {
			note.el.style.width = '100%';
			note.el.style.breakInside = 'avoid';
			note.el.style.marginBottom = `${gap}px`;
		}
	}

	private openFocusMode(file: TFile) {
		if (!this.container || !this.board) return;
		this.closeFocus?.();
		const previousFocus = this.container.ownerDocument.activeElement as HTMLElement | null;
		if (this.board) {
			this.scrollPosition = this.board.scrollTop;
		}

		// Create focus overlay
		const overlay = this.container.createDiv({ cls: 'keep-focus-overlay' });
		overlay.setAttribute('role', 'dialog');
		overlay.setAttribute('aria-label', file.basename);

		// Close button
		const closeBtn = overlay.createEl('button', { cls: 'keep-focus-close' });
		closeBtn.setAttribute('aria-label', 'Close note');
		closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

		// Note title
		const title = overlay.createDiv({ cls: 'keep-focus-title' });
		title.setText(file.basename);

		// Note content
		const content = overlay.createDiv({ cls: 'keep-focus-content' });

		// Load and display content
		this.app.vault.cachedRead(file).then(text => {
			content.setText(text);
		}).catch(() => {
			content.setText('Error loading note');
		});

		// Close handlers
		const close = () => {
			overlay.removeEventListener('keydown', keyHandler);
			overlay.remove();
			this.closeFocus = null;
			if (previousFocus?.isConnected) previousFocus.focus();
			if (this.board) {
				this.board.scrollTop = this.scrollPosition;
			}
		};

		closeBtn.addEventListener('click', close);

		// Escape key
		const keyHandler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				close();
				e.preventDefault();
				e.stopPropagation();
			}
		};
		overlay.addEventListener('keydown', keyHandler);
		this.closeFocus = close;

		// Back button for mobile
		const backBtn = overlay.createEl('button', { cls: 'keep-focus-back' });
		backBtn.setAttribute('aria-label', 'Back to board');
		backBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
		backBtn.addEventListener('click', close);
		closeBtn.focus();
	}
}