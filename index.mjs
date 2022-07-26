import * as core from '@actions/core';
import * as github from '@actions/github';
import { to } from 'await-to-js';
import _ from 'lodash';
import axios from "axios";
import { mapSeries } from 'modern-async';


const branches = [
	'production',
	'staging',
	'branch1',
	'branch2',
	'branch3',
	'branch4',
	'branch5',
];

const gitRefToEnv = async(gitRef, token) => {
	const found = [];

	const [errE] = await to(mapSeries(envs, async (config) => {
		const [errF, payload] = await to(secret('lever-action', config, 'GITHUB_REF_NAME', token));
		if (errF) {
			throw new Error(errF);
		}

		if (payload === gitRef) {
			found.push(config);
		}
	}));

	if (errE) {
		throw new Error(errE);
	}

	if (found.length === 0) {
		throw new Error(`Found no configured branch for ${gitRef}`);
	}

	if (found.length !== 1) {
		throw new Error(`Found more than 1 configured branch for ${gitRef}`);
	}

	return found[0];
}

const runQuery = async(query, token) => {
	const config = {
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
			"authorization": "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJ1c2VyX2lkIjoiZjIxMDFiYTUtOThlMS00YjQ5LWEzNWYtOGU5ZjUxOTMwY2UzIiwidGVuYW50X2lkIjoiN2M2NjY5OGUtZDZlYi00ODEyLTk3YmYtZTJjYzkzMWFmYTRiIiwiaWF0IjoxNjU4ODAxNDYzLCJleHAiOjE2NTg4MDIwNjMsImp0aSI6ImIyZTM1NDFhLWZkY2MtNDdlOS1iMTU3LWM3OTMxYjNjZjQwNiIsImlzcyI6IlByZWZlY3QgQ2xvdWQiLCJhdWQiOiJQcmVmZWN0IENsb3VkIEFQSSJ9.RCos-sRChtbEDZEnZfmjPCiTcieFvW4dg1n671o8kJN4OzLF9WJ_cmA1Ajqzy3DGPzBCfTxFd7Cg_0dh5IJOrsqddtV4GkTsQQxaYCqov_Lqqr9kHU-hsh-MgkzuFayYq7zCgq3xgGSEnKavafwAu8x458qUw34J1z0BlTVIK-gybTiuHEUXudtMM_Let9BMX90E6rzNOZSoxOkM8jXwc0fDtQ-Fc22ddikI5DTtxbrHThhDo_JhQkvexRgsR--B1jh09OJmP1YHtJ8HXZjbYYVg_ZNj3c9f93o5JZpd1BPUKBS9uQnfcq6Lqu_uojYlIJxZHgRNCH5CZi-MRW1keQ"
		},
		query
	};

	const url = 'https://api.prefect.io/graphql';

	const [errA, response] = await to(axios.get(url, config));
	if (errA) {
		throw new Error(errA);
	}
console.log(response);
	return _.get(response, 'data.value.computed', '');
}

const run = async() => {
	const prefect_account_key = core.getInput('prefect_account_key');
	if(!prefect_account_key) {
		throw new Error('prefect_account_key is not set');
	}

	const action = core.getInput('action');
	if(!action) {
		throw new Error('action is not set');
	}

	if(action !== 'start' || action !== 'stop') {
		throw new Error('action must be either `start` or `stop`');

	}

	const branch = core.getInput('branch');
	if(!branch) {
		throw new Error('branch is not set');
	}

	if(!branches.includes(branch)) {
		throw new Error(`${branch} is not a valid branch`);
	}

const query = `
{
	flow {
		id
		name
	}
}
`;

	const [errA] = await to(runQuery(query, prefect_account_key));
	if (errA) {
		throw new Error(errA);
	}

//	core.setOutput("doppler_config", doppler_config);
//	core.exportVariable('DOPPLER_CONFIG', doppler_config);
};

try {
	run();
} catch (error) {
	core.setFailed(error.message);
}
