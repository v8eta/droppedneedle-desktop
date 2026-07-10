import { API } from '$lib/constants';
import type { DownloadProgress } from '$lib/types';
// DESKTOP: bearer-authenticated SSE over the Rust transport
import { createEventSource, type FetchEventSource } from '$lib/desktop/sse';

interface DownloadStreamState {
	progress: DownloadProgress | null;
	status: string | null;
	done: boolean;
}

function parse(event: Event): Record<string, unknown> {
	try {
		return JSON.parse((event as MessageEvent).data) as Record<string, unknown>;
	} catch {
		return {};
	}
}

// DESKTOP: upstream used native EventSource (cookie auth); the desktop client
// streams over the Rust transport with the bearer header via createEventSource.
// no 'error' handler so keepalive gaps/close don't clobber a terminal state
export function createDownloadStream() {
	let state = $state<DownloadStreamState>({ progress: null, status: null, done: false });
	let source: FetchEventSource | null = null;

	function stop() {
		if (source) {
			source.close();
			source = null;
		}
	}

	function start(taskId: string) {
		stop();
		state = { progress: null, status: null, done: false };
		// DESKTOP: EventSource → createEventSource (bearer-authenticated SSE)
		source = createEventSource(API.downloads.stream(taskId));
		source.addEventListener('status', (e) => {
			const d = parse(e);
			state = { ...state, status: (d.status as string) ?? state.status };
		});
		source.addEventListener('progress', (e) => {
			const d = parse(e);
			state = {
				...state,
				progress: {
					bytes_downloaded: Number(d.bytes_downloaded ?? 0),
					bytes_total: Number(d.bytes_total ?? 0),
					files_completed: Number(d.files_completed ?? 0),
					files_total: Number(d.files_total ?? 0),
					progress_percent: Number(d.progress_percent ?? 0)
				}
			};
		});
		source.addEventListener('complete', (e) => {
			const d = parse(e);
			state = { ...state, status: (d.status as string) ?? state.status, done: true };
			stop();
		});
	}

	return {
		get state() {
			return state;
		},
		start,
		stop
	};
}
