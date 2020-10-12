/* eslint-disable @typescript-eslint/no-use-before-define */
import { extractTotalDuration, Replay } from '@firestone-hs/hs-replay-xml-parser/dist/public-api';
import { GameTag } from '@firestone-hs/reference-data';
import { ReviewMessage } from '../review-message';
import { Stat } from '../stat';

export const gameDurationExtractor = async (
	message: ReviewMessage,
	replay: Replay,
	replayString: string,
): Promise<readonly Stat[]> => {
	const totalDuration = extractTotalDuration(replay);
	const numberOfTurns = extractNumberOfTurns(replay);

	return [
		{
			statName: 'total-duration-seconds',
			statValue: '' + totalDuration,
		} as Stat,
		{
			statName: 'total-duration-turns',
			statValue: '' + numberOfTurns,
		} as Stat,
	];
};

const extractNumberOfTurns = (replay: Replay): number => {
	const allTurnChanges = replay.replay.findall(`.//TagChange[@tag='${GameTag.TURN}']`);
	const lastTurn = allTurnChanges.length > 0 ? allTurnChanges[allTurnChanges.length - 1] : null;
	const totalTurns = lastTurn ? parseInt(lastTurn.get('value')) : 0;
	return Math.ceil(totalTurns / 2);
};
