import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class ObjectiveAiApi implements ICredentialType {
	name = 'objectiveAiApi';

	displayName = 'Objective AI API';

	documentationUrl = 'https://objective-ai.io/docs';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
		},
		{
			displayName: 'Base URL',
			name: 'url',
			type: 'hidden',
			default: 'https://api.objective-ai.io',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{ $credentials.url }}',
			url: '/auth/credits',
			method: 'GET',
		},
	};
}
