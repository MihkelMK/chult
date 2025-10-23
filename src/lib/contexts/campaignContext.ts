import { setContext, getContext } from 'svelte';
import type { LocalState } from '$lib/stores/localState.svelte';
import type { RemoteStateDM } from '$lib/stores/remoteStateDM.svelte';
import type { RemoteStatePlayer } from '$lib/stores/remoteStatePlayer.svelte';

// Context keys
const LOCAL_STATE_KEY = Symbol('local_state');
const REMOTE_STATE_KEY = Symbol('remote_state');

// Local state (reactive UI state + SSE)
export function setLocalState(state: LocalState) {
	setContext(LOCAL_STATE_KEY, state);
}

export function getLocalState(): LocalState {
	return getContext<LocalState>(LOCAL_STATE_KEY);
}

// Remote state (API batching coordinator)
export function setRemoteState(state: RemoteStateDM | RemoteStatePlayer) {
	setContext(REMOTE_STATE_KEY, state);
}

export function getRemoteState(): RemoteStateDM | RemoteStatePlayer {
	return getContext<RemoteStateDM | RemoteStatePlayer>(REMOTE_STATE_KEY);
}
