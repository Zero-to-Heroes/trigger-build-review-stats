export const isMercenaries = (gameMode: string): boolean => {
	return [
		'mercenaries-pve',
		'mercenaries-pvp',
		'mercenaries-pve-coop',
		'mercenaries-ai-vs-ai',
		'mercenaries-friendly',
	].includes(gameMode);
};
