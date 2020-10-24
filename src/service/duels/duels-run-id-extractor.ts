/* eslint-disable @typescript-eslint/no-use-before-define */
import { Replay } from '@firestone-hs/hs-replay-xml-parser/dist/public-api';
import { ReviewMessage } from '../../review-message';
import { Stat } from '../../stat';

export const duelsRunIdExtractor = async (
	message: ReviewMessage,
	replay: Replay,
	replayString: string,
): Promise<readonly Stat[]> => {
	if (!message.currentDuelsRunId) {
		return [];
	}
	return [
		{
			statName: 'duels-run-id',
			statValue: message.currentDuelsRunId,
		} as Stat,
	];
};
