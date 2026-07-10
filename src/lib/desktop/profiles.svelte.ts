import { isTauri } from '@tauri-apps/api/core';

/**
 * Server profiles: which DroppedNeedle server(s) the app knows about.
 * Non-secret data only — bearer tokens live in the OS credential store
 * keyed by profile id (see $lib/desktop/secrets).
 *
 * Persisted via tauri-plugin-store (profiles.json in appData); browser dev
 * falls back to localStorage.
 */
export interface ServerProfile {
	id: string;
	name: string;
	baseUrl: string;
	acceptInvalidCerts: boolean;
	lastUser: { id: string; display_name: string; role: string } | null;
	lastConnectedAt: string | null;
}

interface ProfilesFile {
	version: 1;
	activeProfileId: string | null;
	profiles: ServerProfile[];
}

const STORE_FILE = 'profiles.json';
const DEV_KEY = 'dn-desktop-dev-profiles';
const EMPTY: ProfilesFile = { version: 1, activeProfileId: null, profiles: [] };

function createProfilesStore() {
	let data = $state<ProfilesFile>(EMPTY);
	let loaded = $state(false);

	async function persist(): Promise<void> {
		if (isTauri()) {
			const { load } = await import('@tauri-apps/plugin-store');
			const store = await load(STORE_FILE);
			await store.set('data', $state.snapshot(data));
			await store.save();
		} else {
			localStorage.setItem(DEV_KEY, JSON.stringify($state.snapshot(data)));
		}
	}

	return {
		get loaded() {
			return loaded;
		},
		get profiles() {
			return data.profiles;
		},
		get active(): ServerProfile | null {
			return data.profiles.find((p) => p.id === data.activeProfileId) ?? null;
		},
		async init(): Promise<void> {
			if (loaded) return;
			try {
				if (isTauri()) {
					const { load } = await import('@tauri-apps/plugin-store');
					const store = await load(STORE_FILE);
					data = ((await store.get('data')) as ProfilesFile | undefined) ?? EMPTY;
				} else {
					const raw = localStorage.getItem(DEV_KEY);
					data = raw ? (JSON.parse(raw) as ProfilesFile) : EMPTY;
				}
			} catch {
				data = EMPTY;
			}
			loaded = true;
		},
		async add(profile: Omit<ServerProfile, 'id'>): Promise<ServerProfile> {
			const created: ServerProfile = { ...profile, id: crypto.randomUUID() };
			data = { ...data, profiles: [...data.profiles, created], activeProfileId: created.id };
			await persist();
			return created;
		},
		async update(id: string, patch: Partial<Omit<ServerProfile, 'id'>>): Promise<void> {
			data = {
				...data,
				profiles: data.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p))
			};
			await persist();
		},
		async remove(id: string): Promise<void> {
			data = {
				...data,
				profiles: data.profiles.filter((p) => p.id !== id),
				activeProfileId: data.activeProfileId === id ? null : data.activeProfileId
			};
			await persist();
		},
		async setActive(id: string | null): Promise<void> {
			data = { ...data, activeProfileId: id };
			await persist();
		}
	};
}

export const profilesStore = createProfilesStore();
