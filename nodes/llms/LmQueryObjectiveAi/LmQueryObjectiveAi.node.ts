import {
	NodeConnectionTypes,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
} from 'n8n-workflow';
import { QueryObjectiveAI } from '@objectiveai/langchain';
import { Chat } from 'objectiveai';
import { makeN8nLlmFailedAttemptHandler } from '@n8n/n8n-nodes-langchain/dist/nodes/llms/n8nLlmFailedAttemptHandler.js';
import { getConnectionHintNoticeField } from '@n8n/n8n-nodes-langchain/dist/utils/sharedFields.js';
import { N8nLlmTracing } from '@n8n/n8n-nodes-langchain/dist/nodes/llms/N8nLlmTracing.js';
import { getProxyAgent } from '@n8n/n8n-nodes-langchain/dist/utils/httpProxyAgent.js';

export class LmQueryObjectiveAi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Objective AI Query Model',
		name: 'lmQueryObjectiveAi',
		icon: { light: 'file:../../objectiveai.svg', dark: 'file:../../objectiveai.dark.svg' },
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
						url: 'https://objective-ai.io/docs',
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
					'The query model which will generate the completion. <a href="https://objective-ai.io/docs">Learn more</a>.',
				name: 'model',
				type: 'options',
				required: true,
				default: null,
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
				typeOptions: { minValue: 0, numberPrecision: 0 },
				required: true,
				default: 2,
			},
			{
				displayName: 'Number of Completions per LLM',
				description: 'How many choices each LLM within the Query Model should generate',
				name: 'n',
				type: 'number',
				typeOptions: { minValue: 1, numberPrecision: 0 },
				required: true,
				default: 1,
			},
			{
				displayName: 'Response Format',
				name: 'responseFormat',
				type: 'options',
				required: true,
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
				default: '', // empty string instead of null to satisfy the linter
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
				default: `{
	"type": "object",
	"properties": {
			"response": {
					"type": "string"
			}
	},
	"required": ["response"],
	"additionalProperties": false
}`,
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
				default: null,
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
		// get credentials
		const credentials = await this.getCredentials('objectiveAiApi');

		// get user-defined parameters
		const modelParam = this.getNodeParameter('model', itemIndex) as string;
		const maxRetriesParam = this.getNodeParameter('maxRetries', itemIndex) as number;
		const nParam = this.getNodeParameter('n', itemIndex) as number;
		const responseFormatParam = this.getNodeParameter('responseFormat', itemIndex) as string;
		const seedParam = this.getNodeParameter('seed', itemIndex) as number | null;
		const timeoutParam = this.getNodeParameter('timeout', itemIndex) as number;

		// build response format
		const responseFormat: Chat.Completions.Request.ResponseFormat = (() => {
			if (responseFormatParam === 'json_object') {
				return { type: 'json_object' };
			} else if (responseFormatParam === 'json_schema') {
				const responseFormatJsonSchemaNameParam = this.getNodeParameter(
					'responseFormatJsonSchemaName',
					itemIndex,
				) as string;
				const responseFormatJsonSchemaDescriptionParam = this.getNodeParameter(
					'responseFormatJsonSchemaDescription',
					itemIndex,
				) as string | null;
				const responseFormatJsonSchemaParam = this.getNodeParameter(
					'responseFormatJsonSchema',
					itemIndex,
				) as string;
				return {
					type: 'json_schema',
					json_schema: {
						name: responseFormatJsonSchemaNameParam,
						description:
							responseFormatJsonSchemaDescriptionParam === ''
								? undefined
								: responseFormatJsonSchemaDescriptionParam,
						strict: true,
						schema: JSON.parse(responseFormatJsonSchemaParam),
					},
				};
			} else {
				return { type: 'text' };
			}
		})();

		// build model
		const model = new QueryObjectiveAI({
			maxRetries: maxRetriesParam,
			callbacks: [new N8nLlmTracing(this)],
			onFailedAttempt: makeN8nLlmFailedAttemptHandler(this),
			chat_completion_create_params: {
				model: modelParam,
				n: nParam,
				seed: seedParam,
				response_format: responseFormat,
			},
			openai: {
				apiKey: credentials.apiKey as string,
				baseURL: credentials.url as string,
				fetchOptions: {
					dispatcher: getProxyAgent(credentials.url as string),
				},
				timeout: timeoutParam,
			},
		});

		// return model
		return {
			response: model,
		};
	}
}
