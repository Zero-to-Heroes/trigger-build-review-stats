import { Replay } from '@firestone-hs/hs-replay-xml-parser/dist/public-api';
import { CardType, GameTag, Zone } from '@firestone-hs/reference-data';
import { ReviewMessage } from '../review-message';
import { Stat } from '../stat';

export const bgsHeroPickExtractor = async (
	message: ReviewMessage,
	replay: Replay,
	replayString: string,
): Promise<readonly Stat[]> => {
	if (message.gameMode !== 'battlegrounds') {
		return null;
	}

	const pickOptions = replay.replay
		.findall(`.//FullEntity`)
		.filter(entity => entity.find(`.Tag[@tag='${GameTag.CARDTYPE}'][@value='${CardType.HERO}']`))
		.filter(entity => entity.find(`.Tag[@tag='${GameTag.CONTROLLER}'][@value='${replay.mainPlayerId}']`))
		.filter(entity => entity.find(`.Tag[@tag='${GameTag.ZONE}'][@value='${Zone.HAND}']`))
		.filter(entity => entity.find(`.Tag[@tag='${GameTag.BACON_HERO_CAN_BE_DRAFTED}'][@value='1']`));
	const pickOptionIds = pickOptions.map(option => option.get('id'));
	const pickedHero = replay.replay
		.findall(`.//ChosenEntities`)
		.filter(chosenEntities => {
			const choice = chosenEntities.find('.//Choice');
			return pickOptionIds.indexOf(choice.get('entity')) !== -1;
		})
		.map(entity => entity.find(`.//Choice`));
	const pickedHeroEntityId = pickedHero[0].get('entity');
	const pickedHeroFullEntity = pickOptions.find(option => option.get('id') === pickedHeroEntityId);
	return [
		...pickOptions
			.map(option => option.get('cardID'))
			.map(
				pick =>
					({
						statName: 'bgs-hero-pick-option',
						statValue: pick,
					} as Stat),
			),
		{
			statName: 'bgs-hero-pick-choice',
			statValue: pickedHeroFullEntity.get('cardID'),
		} as Stat,
	];
};
