import { ReviewMessage } from './review-message';
import { StatsBuilder } from './stats-builder';

// This example demonstrates a NodeJS 8.10 async handler[1], however of course you could use
// the more traditional callback-style handler.
// [1]: https://aws.amazon.com/blogs/compute/node-js-8-10-runtime-now-available-in-aws-lambda/
export default async (event): Promise<any> => {
	// console.log('event', JSON.stringify(event));
	const messages: readonly ReviewMessage[] = (event.Records as any[])
		.map(event => JSON.parse(event.body))
		.reduce((a, b) => a.concat(b), [])
		.filter(event => event);
	// console.log('input', JSON.stringify(messages));
	await new StatsBuilder().buildStats(messages);
	// console.log('built stats', JSON.stringify(stats));
	return { statusCode: 200, body: null };
};
