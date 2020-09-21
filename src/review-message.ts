export interface ReviewMessage {
	readonly reviewId: string;
	readonly replayKey: string;
	readonly uploaderToken: string;
	readonly gameMode: string;
	readonly playerRank: string;
}
