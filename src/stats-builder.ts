/* eslint-disable @typescript-eslint/no-use-before-define */
import { parseHsReplayString, Replay } from '@firestone-hs/hs-replay-xml-parser/dist/public-api';
import { getConnection } from './db/rds';
import { S3 } from './db/s3';
// import { fetch } from 'node-fetch';
// import { Rds } from './db/rds';
import { ReviewMessage } from './review-message';
import { bgsHeroPickExtractor } from './service/hero-pick-extractor';
import { Stat } from './stat';

const s3 = new S3();

export class StatsBuilder {
	public async buildStats(messages: readonly ReviewMessage[]) {
		return await Promise.all(messages.map(msg => this.buildStat(msg)));
	}

	private async buildStat(message: ReviewMessage) {
		// console.log('building stat for', message.reviewId, message.replayKey);
		const replayString = await this.loadReplayString(message.replayKey);
		if (!replayString || replayString.length === 0) {
			// console.log('empty replay, returning');
			return null;
		}

		const reviewId = message.reviewId;
		const replay: Replay = parseHsReplayString(replayString);
		const statsFromGame: readonly Stat[] = await extractStats(message, replay, replayString);
		console.log('stats', reviewId, statsFromGame);

		const mysql = await getConnection();
		const stats = statsFromGame
			.filter(stat => stat)
			.map(stat => `('${reviewId}', '${stat.statName}', '${stat.statValue}')`)
			.join(',\n');
		if (stats.length > 0) {
			const query = `
				INSERT INTO match_stats
				(reviewId, statName, statValue)
				VALUES ${stats}
			`;
			console.log('executing query', query);
			await mysql.query(query);
		}
		return;
	}

	private async loadReplayString(replayKey: string): Promise<string> {
		if (!replayKey) {
			return null;
		}
		const data = replayKey.endsWith('.zip')
			? await s3.readZippedContent('xml.firestoneapp.com', replayKey)
			: await s3.readContentAsString('xml.firestoneapp.com', replayKey);
		// const data = await http(`http://xml.firestoneapp.com/${replayKey}`);
		return data;
	}
}

const extractStats = async (message: ReviewMessage, replay: Replay, replayString: string): Promise<readonly Stat[]> => {
	const extractors = [bgsHeroPickExtractor];
	const stats = (await Promise.all(extractors.map(extractor => extractor(message, replay, replayString))))
		.reduce((a, b) => a.concat(b), [])
		.filter(stat => stat);
	return stats;
};
