import { fail, type Candidate, type IdentifyErrorCode, type IdentifyOk, type IdentifyResult } from '$lib/identify/types';
import type { Draft } from './drafts';

// Pure orchestration, no browser APIs: the caller passes the function that really sends a draft.

export type DraftState =
	| { phase: 'idle' }
	| { phase: 'loading' }
	| { phase: 'ok'; result: IdentifyOk; sent: number; candidates: Candidate[] }
	| { phase: 'error'; code: IdentifyErrorCode; message: string }
	/** Not sent because an earlier draft hit a limit that would waste or burn quota. */
	| { phase: 'skipped' };

export type SendDraft = (files: File[]) => Promise<{ result: IdentifyResult; sent: number }>;

/** After one of these every further request would fail or spend quota for nothing. */
const STOPPING: ReadonlySet<IdentifyErrorCode> = new Set(['quota', 'forbidden', 'not_configured', 'upstream']);

/**
 * Sends the drafts one at a time, in order. Never retries on its own: Pl@ntNet quota is spent
 * before the answer arrives, so a retry is always the owner's explicit click.
 */
export async function analyzeDrafts(
	drafts: Draft[],
	send: SendDraft,
	onState: (id: string, state: DraftState) => void,
	cancelled: () => boolean = () => false
): Promise<void> {
	let stopped = false;
	for (const draft of drafts) {
		if (cancelled()) return;
		if (stopped) {
			onState(draft.id, { phase: 'skipped' });
			continue;
		}
		onState(draft.id, { phase: 'loading' });
		const { result, sent } = await send(draft.files);
		const failure = result.ok ? (result.candidates.length > 0 ? null : fail('no_match')) : result;
		if (!failure && result.ok) {
			onState(draft.id, { phase: 'ok', result, sent, candidates: result.candidates });
			continue;
		}
		const code = failure?.code ?? 'no_match';
		onState(draft.id, { phase: 'error', code, message: failure?.message ?? fail('no_match').message });
		// A draft that never left the browser (sent 0) cost nothing and says nothing about the API.
		if (sent > 0 && STOPPING.has(code)) stopped = true;
	}
}
