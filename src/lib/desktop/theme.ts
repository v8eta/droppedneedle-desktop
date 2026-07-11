/**
 * Theme picker. DroppedNeedle's signature palette ('droppedneedle') is the
 * default; every daisyUI v5 built-in theme is selectable. The chosen theme is
 * persisted to localStorage and applied as `data-theme` on the root element.
 * A tiny inline script in app.html applies the stored theme before first paint
 * (no flash); this module keeps it in sync at runtime.
 */
const STORAGE_KEY = 'dn-theme';
export const DEFAULT_THEME = 'touki';

/** touki (custom synthwave) + droppedneedle + the daisyUI v5 built-ins. */
export const THEMES: { name: string; label: string; dark: boolean }[] = [
	{ name: 'touki', label: 'touki', dark: true },
	{ name: 'droppedneedle', label: 'DroppedNeedle', dark: true },
	{ name: 'dark', label: 'Dark', dark: true },
	{ name: 'light', label: 'Light', dark: false },
	{ name: 'dim', label: 'Dim', dark: true },
	{ name: 'night', label: 'Night', dark: true },
	{ name: 'dracula', label: 'Dracula', dark: true },
	{ name: 'sunset', label: 'Sunset', dark: true },
	{ name: 'forest', label: 'Forest', dark: true },
	{ name: 'nord', label: 'Nord', dark: true },
	{ name: 'business', label: 'Business', dark: true },
	{ name: 'coffee', label: 'Coffee', dark: true },
	{ name: 'luxury', label: 'Luxury', dark: true },
	{ name: 'halloween', label: 'Halloween', dark: true },
	{ name: 'black', label: 'Black', dark: true },
	{ name: 'abyss', label: 'Abyss', dark: true },
	{ name: 'synthwave', label: 'Synthwave', dark: true },
	{ name: 'cyberpunk', label: 'Cyberpunk', dark: false },
	{ name: 'aqua', label: 'Aqua', dark: true },
	{ name: 'nord', label: 'Nord', dark: true },
	{ name: 'retro', label: 'Retro', dark: false },
	{ name: 'valentine', label: 'Valentine', dark: false },
	{ name: 'lofi', label: 'Lo-fi', dark: false },
	{ name: 'winter', label: 'Winter', dark: false },
	{ name: 'cupcake', label: 'Cupcake', dark: false },
	{ name: 'emerald', label: 'Emerald', dark: false },
	{ name: 'corporate', label: 'Corporate', dark: false },
	{ name: 'garden', label: 'Garden', dark: false },
	{ name: 'pastel', label: 'Pastel', dark: false }
].filter((t, i, arr) => arr.findIndex((x) => x.name === t.name) === i);

export function getTheme(): string {
	try {
		return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME;
	} catch {
		return DEFAULT_THEME;
	}
}

export function setTheme(name: string): void {
	try {
		localStorage.setItem(STORAGE_KEY, name);
	} catch {
		// non-critical
	}
	applyTheme(name);
}

export function applyTheme(name: string): void {
	if (typeof document !== 'undefined') {
		document.documentElement.setAttribute('data-theme', name);
	}
}
