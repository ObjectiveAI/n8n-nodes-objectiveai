declare module '@n8n/n8n-nodes-langchain/dist/utils/httpProxyAgent.js' {
	import { ProxyAgent } from 'undici';
	export function getProxyAgent(targetUrl?: string): ProxyAgent | undefined;
}

declare module '@n8n/n8n-nodes-langchain/dist/utils/sharedFields.js' {
	import { NodeConnectionTypes } from 'n8n-workflow';
	import type { INodeProperties } from 'n8n-workflow';
	export function getConnectionHintNoticeField(
		connectionTypes: (
			| typeof NodeConnectionTypes.AiAgent
			| typeof NodeConnectionTypes.AiChain
			| typeof NodeConnectionTypes.AiDocument
			| typeof NodeConnectionTypes.AiVectorStore
			| typeof NodeConnectionTypes.AiRetriever
		)[],
	): INodeProperties;
}

declare module '@n8n/n8n-nodes-langchain/dist/nodes/llms/n8nLlmFailedAttemptHandler.js' {
	import type { ISupplyDataFunctions } from 'n8n-workflow';
	import type { FailedAttemptHandler } from '@langchain/core/dist/utils/async_caller';
	export const makeN8nLlmFailedAttemptHandler: (
		ctx: ISupplyDataFunctions,
		handler?: FailedAttemptHandler,
	) => FailedAttemptHandler;
}

declare module '@n8n/n8n-nodes-langchain/dist/nodes/llms/N8nLlmTracing.js' {
	import { BaseCallbackHandler } from '@langchain/core/dist/callbacks/base';
	import { NodeError } from 'n8n-workflow';
	import type { LLMResult } from '@langchain/core/dist/outputs';
	import type { ISupplyDataFunctions } from 'n8n-workflow';
	export type TokensUsageParser = (result: LLMResult) => {
		completionTokens: number;
		promptTokens: number;
		totalTokens: number;
	};
	export class N8nLlmTracing extends BaseCallbackHandler {
		constructor(
			executionFunctions: ISupplyDataFunctions,
			options?: {
				tokensUsageParser?: TokensUsageParser;
				errorDescriptionMapper?: (error: NodeError) => string;
			},
		);
	}
}
