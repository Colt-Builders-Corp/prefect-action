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
			'content-type': 'application/json',
			"authorization": `Bearer ${token}`,
			'x-prefect-interactive-api': false,
		},
	};

	const data =  {
		query
	};

	const url = 'https://api.prefect.io/graphql';

	const [errA, response] = await to(axios.post(url, data, config));
	if (errA) {
		throw new Error(errA);
	}
	const errors = _.get(response, 'data.errors');
	if(errors !== undefined) {
		throw new Error(errors[0].message);
	}

	return _.get(response, 'data.data', '');
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

	if(action !== 'start' &&  action !== 'stop') {
		throw new Error('action must be either `start` or `stop`');

	}

	const branch = core.getInput('branch');
	if(!branch) {
		throw new Error('branch is not set');
	}

	if(!branches.includes(branch)) {
		throw new Error(`${branch} is not a valid branch`);
	}

const query = `{
	flow {
		id
		name
	}
}`;

	const [errA, data] = await to(runQuery(query, prefect_account_key));
	if (errA) {
		throw new Error(errA);
	}
console.log(data);

//	core.setOutput("doppler_config", doppler_config);
//	core.exportVariable('DOPPLER_CONFIG', doppler_config);
};

try {
	run();
} catch (error) {
	core.setFailed(error.message);
}
