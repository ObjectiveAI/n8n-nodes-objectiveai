declare module '@n8n/n8n-nodes-langchain/dist/utils/httpProxyAgent.js' {
	import { ProxyAgent } from 'undici';
	export function getProxyAgent(targetUrl?: string): ProxyAgent | undefined;
}

declare module '@n8n/n8n-nodes-langchain/dist/utils/sharedFields.js' {
	import type { INodeProperties } from 'n8n-workflow';
	import { NodeConnectionTypes } from 'n8n-workflow';
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
	import type { LLMResult } from '@langchain/core/dist/outputs';
	import type { ISupplyDataFunctions } from 'n8n-workflow';
	import { BaseCallbackHandler } from '@langchain/core/dist/callbacks/base';
	import { NodeError } from 'n8n-workflow';
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

declare module '@n8n/n8n-nodes-langchain/dist/utils/output_parsers/N8nStructuredOutputParser.js' {
	import type { ISupplyDataFunctions } from 'n8n-workflow';
	import type { Callbacks } from '@langchain/core/callbacks/manager';
	import { z } from 'zod';
	export class N8nStructuredOutputParser extends StructuredOutputParser<
		z.ZodType<object, z.ZodTypeDef, object>
	> {
		constructor(context: ISupplyDataFunctions, zodSchema: z.ZodSchema<object>);
		parse(
			text: string,
			_callbacks?: Callbacks,
			errorMapper?: (error: Error) => Error,
		): Promise<object>;
		static fromZodJsonSchema(
			zodSchema: z.ZodSchema<object, z.ZodTypeDef, object>,
			nodeVersion: number,
			context: ISupplyDataFunctions,
		): Promise<N8nStructuredOutputParser>;
	}
}

declare module '@n8n/n8n-nodes-langchain/dist/utils/schemaParsing.js' {
	import type { JSONSchema7 } from 'json-schema';
	import { z } from 'zod';
	export function convertJsonSchemaToZod<T extends z.ZodTypeAny = z.ZodTypeAny>(
		schema: JSONSchema7,
	): T;
}
