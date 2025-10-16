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
		inputs: [
			{
				displayName: 'Model',
				maxConnections: 1,
				type: NodeConnectionTypes.AiLanguageModel,
				required: true,
			},
		],
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
			const n8nParser = await N8nStructuredOutputParser.fromZodJsonSchema(zodSchema, 1.3, this);
			const outputParser = new QueryObjectiveAICustomOutputParser(
				(text: string) => n8nParserParse(n8nParser, text),
				zodSchema,
			);
			return { response: outputParser };
		} else if (responseFormat?.type === 'json_object') {
			const zodSchema = z.record(z.unknown());
			const n8nParser = await N8nStructuredOutputParser.fromZodJsonSchema(zodSchema, 1.3, this);
			const outputParser = new QueryObjectiveAICustomOutputParser(
				(text: string) => n8nParserParse(n8nParser, text),
				zodSchema,
			);
			return { response: outputParser };
		} else {
			const outputParser = new QueryObjectiveAITextOutputParser();
			return { response: outputParser };
		}
	}
}

async function n8nParserParse(
	n8nParser: N8nStructuredOutputParser,
	text: string,
): Promise<unknown> {
	let input: string;
	try {
		input = JSON.stringify({ output: JSON.parse(text) });
	} catch {
		input = text;
	}
	const parsed = await n8nParser.parse(input);
	if (typeof parsed === 'object' && parsed !== null && 'output' in parsed) {
		return parsed.output;
	} else {
		return parsed;
	}
}
