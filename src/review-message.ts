import { Race } from '@firestone-hs/reference-data';

export interface ReviewMessage {
	readonly reviewId: string;
	readonly replayKey: string;
	readonly uploaderToken: string;
	readonly gameMode: string;
	readonly playerRank: string;
	readonly availableTribes: readonly Race[];
	readonly bannedTribes: readonly Race[];
	readonly currentDuelsRunId: string;
	readonly runId: string;
	readonly appVersion: string;
	readonly normalizedXpGained: number;
}
