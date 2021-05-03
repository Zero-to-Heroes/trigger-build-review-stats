/* eslint-disable @typescript-eslint/no-use-before-define */
import { parseHsReplayString, Replay } from '@firestone-hs/hs-replay-xml-parser/dist/public-api';
import SqlString from 'sqlstring';
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
	public async buildStats(messages: readonly ReviewMessage[], dryRun = false) {
		return await Promise.all(messages.map(msg => this.buildStat(msg, dryRun)));
	}

	private async buildStat(message: ReviewMessage, dryRun: boolean) {
		const replayString = await this.loadReplayString(message.replayKey);
		// console.log('hophop', message.replayKey, replayString?.length, message);
		if (!replayString || replayString.length === 0) {
			return null;
		}

		const reviewId = message.reviewId;
		const replay: Replay = parseHsReplayString(replayString);
		const statsFromGame: readonly Stat[] = await extractStats(message, replay, replayString);
		// console.log('statsFromGame', statsFromGame);
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

		const validStats = statsFromGame.filter(stat => stat);
		// console.log('validStats', validStats);
		const mysql = await getConnection();
		if (validStats.length > 0) {
			const escape = SqlString.escape;
			// const additionalQuery = `
			// 	INSERT IGNORE INTO replay_summary_secondary_data
			// 	(
			// 		reviewId,
			// 		bgsAvailableTribes,
			// 		bgsBannedTribes,
			// 		bgsHeroPickChoice,
			// 		bgsHeroPïckOption,
			// 		duelsRunId,
			// 		normalizedXpGain,
			// 		totalDurationSeconds,
			// 		totalDurationTurns
			// 	)
			// 	VALUES (
			// 		'${reviewId}',
			// 		${escape(emptyAsNull(bgsAvailableTribes))},
			// 		${escape(emptyAsNull(bgsBannedTribes))},
			// 		${escape(emptyAsNull(bgsHeroPickChoice))},
			// 		${escape(emptyAsNull(bgsHeroPickOptions))},
			// 		${escape(emptyAsNull(duelsRunId))},
			// 		${escape(xpGained)},
			// 		${escape(totalDurationSeconds)},
			// 		${escape(totalDurationTurns)}
			// 	)
			// `;
			// // console.log('running query', additionalQuery);
			// await mysql.query(additionalQuery);

			// And now insert it in the new table
			const additionalQuery2 = `
				UPDATE replay_summary
				SET
					bgsAvailableTribes = ${escape(emptyAsNull(bgsAvailableTribes))},
					bgsBannedTribes = ${escape(emptyAsNull(bgsBannedTribes))},
					bgsHeroPickChoice = ${escape(emptyAsNull(bgsHeroPickChoice))},
					bgsHeroPïckOption = ${escape(emptyAsNull(bgsHeroPickOptions))},
					runId = ${escape(emptyAsNull(duelsRunId))},
					normalizedXpGain = ${escape(xpGained)},
					totalDurationSeconds = ${escape(totalDurationSeconds)},
					totalDurationTurns = ${escape(totalDurationTurns)}
				WHERE
					reviewId = ${escape(emptyAsNull(reviewId))}
			`;
			// console.log('running second query', additionalQuery2);
			await mysql.query(additionalQuery2);
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
		return data;
	}
}

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

function emptyAsNull(value: string): string {
	if (value?.length === 0) {
		return null;
	}
	return value;
}
