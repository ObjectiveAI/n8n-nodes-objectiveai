import { QueryObjectiveAI } from '@objectiveai/langchain';
import {
	NodeConnectionTypes,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
} from 'n8n-workflow';

import { getProxyAgent } from '@n8n/n8n-nodes-langchain/dist/utils/httpProxyAgent.js';
import { getConnectionHintNoticeField } from '@n8n/n8n-nodes-langchain/dist/utils/sharedFields.js';

import { makeN8nLlmFailedAttemptHandler } from '@n8n/n8n-nodes-langchain/dist/nodes/llms/n8nLlmFailedAttemptHandler.js';
import { N8nLlmTracing } from '@n8n/n8n-nodes-langchain/dist/nodes/llms/N8nLlmTracing.js';
import { Chat, JsonValue } from 'objectiveai';

export class LmQueryObjectiveAi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Objective AI Query Model',
		name: 'lmQueryObjectiveAi',
		icon: { light: 'file:objectiveai.svg', dark: 'file:objectiveai.dark.svg' },
		group: ['transform'],
		version: [1],
		description: 'For advanced usage with an AI chain',
		defaults: {
			name: 'Objective AI Query Model',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models', 'Root Nodes'],
				'Language Models': ['Chat Models (Recommended)'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://objective-ai.io/docs/n8n/query',
					},
				],
			},
		},

		inputs: [],

		outputs: [NodeConnectionTypes.AiLanguageModel],
		outputNames: ['Model'],
		credentials: [
			{
				name: 'objectiveAiApi',
				required: true,
			},
		],
		requestDefaults: {
			ignoreHttpStatusErrors: true,
			baseURL: '={{ $credentials?.url }}',
		},
		properties: [
			getConnectionHintNoticeField([NodeConnectionTypes.AiChain, NodeConnectionTypes.AiAgent]),
			{
				displayName: 'Model',
				description:
					'The query model which will generate the completion. <a href="https://objective-ai.io/docs/query_models">Learn more</a>.',
				name: 'model',
				type: 'options',
				required: true,
				default: undefined,
				typeOptions: {
					loadOptions: {
						routing: {
							request: {
								method: 'GET',
								url: '/query_models',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data',
										},
									},
									{
										type: 'setKeyValue',
										properties: {
											name: '={{$responseItem}}',
											value: '={{$responseItem}}',
										},
									},
								],
							},
						},
					},
				},
				routing: {
					send: {
						type: 'body',
						property: 'model',
					},
				},
			},
			{
				displayName: 'Max Retries',
				description: 'Maximum number of retries to attempt',
				name: 'maxRetries',
				type: 'number',
				typeOptions: { minValue: 0, numberPrecision: 1 },
				required: true,
				default: 2,
			},
			{
				displayName: 'Number of Completions per LLM',
				description: 'How many choices each LLM within the Query Model should generate',
				name: 'n',
				type: 'number',
				typeOptions: { minValue: 1, numberPrecision: 1 },
				required: true,
				default: 1,
			},
			{
				displayName: 'Response Format',
				name: 'responseFormat',
				type: 'options',
				default: 'text',
				options: [
					{
						name: 'Text',
						description: 'Generate LLMs will output text',
						value: 'text',
					},
					{
						name: 'JSON',
						description: 'Generate LLMs will output JSON',
						value: 'json_object',
					},
					{
						name: 'JSON Schema',
						description: 'Generate LLMs will output JSON that adheres to a specific schema',
						value: 'json_schema',
					},
				],
			},
			{
				displayName: 'Schema Name',
				description: 'The name of the Response Format schema',
				name: 'responseFormatJsonSchemaName',
				type: 'string',
				required: true,
				default: 'Response',
				displayOptions: {
					show: {
						responseFormat: ['json_schema'],
					},
				},
			},
			{
				displayName: 'Schema Description',
				description: 'The description of the Response Format schema',
				name: 'responseFormatJsonSchemaDescription',
				type: 'string',
				default: undefined,
				displayOptions: {
					show: {
						responseFormat: ['json_schema'],
					},
				},
			},
			{
				displayName: 'Schema',
				description:
					'The Response Format schema. <a href="https://objective-ai.io/docs/query/response_format">Learn More</a>.',
				name: 'responseFormatJsonSchema',
				type: 'json',
				required: true,
				default: {
					type: 'object',
					properties: { response: { type: 'string' } },
					required: ['response'],
					additionalProperties: false,
				},
				displayOptions: {
					show: {
						responseFormat: ['json_schema'],
					},
				},
			},
			{
				displayName: 'Seed',
				description: 'A seed value to make the output of the model more deterministic',
				name: 'seed',
				type: 'number',
				typeOptions: { minValue: 0, numberPrecision: 1 },
				default: undefined,
			},
			{
				displayName: 'Timeout',
				description: 'Maximum amount of time a request is allowed to take in milliseconds',
				name: 'timeout',
				type: 'number',
				typeOptions: { minValue: 0, numberPrecision: 1 },
				required: true,
				default: 300_000, // 5 minutes
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const credentials = await this.getCredentials('objectiveAiApi');

		const modelName = this.getNodeParameter('model', itemIndex) as string;

		const options = this.getNodeParameter('options', itemIndex, {}) as {
			responseFormat?: 'text' | 'json_object' | 'json_schema';
			responseFormatJsonSchemaName?: string;
			responseFormatJsonSchemaDescription?: string;
			responseFormatJsonSchema?: Record<string, JsonValue>;
			n?: number;
			seed?: number;
			timeout?: number;
			maxRetries?: number;
		};

		const responseFormat: Chat.Completions.Request.ResponseFormat = (() => {
			if (options.responseFormat === 'json_object') {
				return { type: 'json_object' };
			} else if (options.responseFormat === 'json_schema') {
				return {
					type: 'json_schema',
					json_schema: {
						name: options.responseFormatJsonSchemaName ?? 'Response',
						description: options.responseFormatJsonSchemaDescription,
						strict: true,
						schema: options.responseFormatJsonSchema ?? {
							type: 'object',
							properties: { response: { type: 'string' } },
							required: ['response'],
							additionalProperties: false,
						},
					},
				};
			} else {
				return { type: 'text' };
			}
		})();

		const model = new QueryObjectiveAI({
			maxRetries: options.maxRetries ?? 2,
			callbacks: [new N8nLlmTracing(this)],
			onFailedAttempt: makeN8nLlmFailedAttemptHandler(this),
			chat_completion_create_params: {
				model: modelName,
				n: options.n ?? 1,
				seed: options.seed,
				response_format: responseFormat,
			},
			openai: {
				apiKey: credentials.apiKey as string,
				baseURL: credentials.url as string,
				fetchOptions: {
					dispatcher: getProxyAgent(credentials.url as string),
				},
				timeout: options.timeout ?? 300_000, // 5 minutes
			},
		});

		return {
			response: model,
		};
	}
}
