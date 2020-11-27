/* eslint-disable @typescript-eslint/no-use-before-define */
import { parseHsReplayString, Replay } from '@firestone-hs/hs-replay-xml-parser/dist/public-api';
import { getConnection } from './db/rds';
import { S3 } from './db/s3';
// import { fetch } from 'node-fetch';
// import { Rds } from './db/rds';
import { ReviewMessage } from './review-message';
import { bgTribesExtractor } from './service/bg-tribes-extractor';
import { duelsRunIdExtractor } from './service/duels/duels-run-id-extractor';
import { gameDurationExtractor } from './service/game-duration-extractor';
import { bgsHeroPickExtractor } from './service/hero-pick-extractor';
import { normalizedXpGainedExtractor } from './service/xp-gained-extractor';
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
		const duelsRunId = statsFromGame.find(stat => stat.statName === 'duels-run-id')?.statValue;
		const bgsBannedTribes = statsFromGame
			.filter(stat => stat.statName === 'bgs-banned-tribes')
			.map(stat => stat.statValue)
			.join(',');
		const bgsAvailableTribes = statsFromGame
			.filter(stat => stat.statName === 'bgs-available-tribes')
			.map(stat => stat.statValue)
			.join(',');
		const totalDurationSeconds = intValue(
			statsFromGame.find(stat => stat.statName === 'total-duration-seconds')?.statValue,
		);
		const totalDurationTurns = intValue(
			statsFromGame.find(stat => stat.statName === 'total-duration-turns')?.statValue,
		);
		const bgsHeroPickOptions = statsFromGame
			.filter(stat => stat.statName === 'bgs-hero-pick-option')
			.map(stat => stat.statValue)
			.join(',');
		const bgsHeroPickChoice = statsFromGame.find(stat => stat.statName === 'bgs-hero-pick-choice')?.statValue;
		const xpGained = intValue(statsFromGame.find(stat => stat.statName === 'normalized-xp-gained')?.statValue);

		console.log('stats', reviewId, statsFromGame);

		const mysql = await getConnection();
		const validStats = statsFromGame.filter(stat => stat);
		if (validStats.length > 0) {
			// const legacyStats = statsFromGame
			// 	.map(stat => `('${reviewId}', '${stat.statName}', '${stat.statValue}')`)
			// 	.join(',\n');
			// const query = `
			// 	INSERT INTO match_stats
			// 	(
			// 		reviewId,
			// 		statName,
			// 		statValue
			// 	)
			// 	VALUES ${legacyStats}
			// `;
			// console.log('executing query', query);
			// await mysql.query(query);

			const additionalQuery = `
				INSERT INTO replay_summary_secondary_data
				(
					reviewId,
					bgsAvailableTribes,
					bgsBannedTribes,
					bgsHeroPickChoice,
					bgsHeroPïckOption,
					duelsRunId,
					normalizedXpGain,
					totalDurationSeconds,
					totalDurationTurns
				)
				VALUES (
					'${reviewId}', 
					${valueHandlingNullString(bgsAvailableTribes)},
					${valueHandlingNullString(bgsBannedTribes)},
					${valueHandlingNullString(bgsHeroPickChoice)},
					${valueHandlingNullString(bgsHeroPickOptions)},
					${valueHandlingNullString(duelsRunId)},
					${valueHandlingNullNumber(xpGained)},
					${valueHandlingNullNumber(totalDurationSeconds)},
					${valueHandlingNullNumber(totalDurationTurns)}
				)
			`;
			console.log('executing query', additionalQuery);
			await mysql.query(additionalQuery);
		}
		await mysql.end();
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

const valueHandlingNullString = (value: string): string => {
	if (!value) {
		return 'NULL';
	}
	return `'${value}'`;
};

const valueHandlingNullNumber = (value: number): string => {
	if (!value) {
		return 'NULL';
	}
	return `${value}`;
};

const intValue = (value: string): number => {
	return value ? parseInt(value) : null;
};

const extractStats = async (message: ReviewMessage, replay: Replay, replayString: string): Promise<readonly Stat[]> => {
	const extractors = [
		bgsHeroPickExtractor,
		gameDurationExtractor,
		bgTribesExtractor,
		duelsRunIdExtractor,
		normalizedXpGainedExtractor,
	];
	const stats = (await Promise.all(extractors.map(extractor => extractor(message, replay, replayString))))
		.reduce((a, b) => a.concat(b), [])
		.filter(stat => stat);
	return stats;
};
