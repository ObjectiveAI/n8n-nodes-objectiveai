import {
	NodeConnectionTypes,
	NodeOperationError,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
} from 'n8n-workflow';
import {
	QueryObjectiveAITextOutputParser,
	QueryObjectiveAICustomOutputParser,
	QueryObjectiveAI,
} from '@objectiveai/langchain';
import { JSONSchema7 } from 'json-schema';
import { z } from 'zod';
import { N8nStructuredOutputParser } from '@n8n/n8n-nodes-langchain/dist/utils/output_parsers/N8nStructuredOutputParser.js';
import { getConnectionHintNoticeField } from '@n8n/n8n-nodes-langchain/dist/utils/sharedFields.js';
import { convertJsonSchemaToZod } from '@n8n/n8n-nodes-langchain/dist/utils/schemaParsing.js';

export class OutputParserQueryObjectiveAi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Objective AI Query Output Parser',
		name: 'outputParserQueryObjectiveAi',
		icon: { light: 'file:../../objectiveai.svg', dark: 'file:../../objectiveai.dark.svg' },
		group: ['transform'],
		version: [1],
		description: 'Parse the output of an Objective AI Query model',
		defaults: {
			name: 'Objective AI Query Output Parser',
		},

		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Output Parsers'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://objective-ai.io/docs',
					},
				],
			},
		},

		inputs: [NodeConnectionTypes.AiLanguageModel],
		inputNames: ['Model'],

		outputs: [NodeConnectionTypes.AiOutputParser],
		outputNames: ['Output Parser'],
		properties: [
			getConnectionHintNoticeField([NodeConnectionTypes.AiChain, NodeConnectionTypes.AiAgent]),
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const model = await this.getInputConnectionData(NodeConnectionTypes.AiLanguageModel, itemIndex);
		if (typeof model !== 'object' || model === null || !(model instanceof QueryObjectiveAI)) {
			throw new NodeOperationError(
				this.getNode(),
				'The input model must be an ObjectiveAI Query model.',
			);
		}
		const responseFormat = model.chat_completion_create_params?.response_format;
		if (responseFormat?.type === 'json_schema' && responseFormat.json_schema.schema) {
			const jsonSchema = responseFormat.json_schema.schema as JSONSchema7;
			const zodSchema = convertJsonSchemaToZod(jsonSchema);
			const nodeVersion = this.getNode().typeVersion;
			const n8nParser = await N8nStructuredOutputParser.fromZodJsonSchema(
				zodSchema,
				nodeVersion,
				this,
			);
			const outputParser = new QueryObjectiveAICustomOutputParser(
				(text: string) => n8nParser.parse(text),
				zodSchema,
			);
			return { response: outputParser };
		} else if (responseFormat?.type === 'json_object') {
			const zodSchema = z.record(z.unknown());
			const nodeVersion = this.getNode().typeVersion;
			const n8nParser = await N8nStructuredOutputParser.fromZodJsonSchema(
				zodSchema,
				nodeVersion,
				this,
			);
			const outputParser = new QueryObjectiveAICustomOutputParser(
				(text: string) => n8nParser.parse(text),
				zodSchema,
			);
			return { response: outputParser };
		} else {
			const outputParser = new QueryObjectiveAITextOutputParser();
			return { response: outputParser };
		}
	}
}
