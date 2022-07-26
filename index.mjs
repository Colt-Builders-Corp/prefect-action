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

const handleFlows = async(action, flows, branch, token) => {
	// Stop/start the flow schedules
	const [errE] = await to(mapSeries(flows, async (flow) => {
		const [errF, payload] = await to(toggleFlowSchedule(flow.id, action, token, flow.name));
		if (errF) {
			throw new Error(errF);
		}

	}));

	if (errE) {
		throw new Error(errE);
	}

	if(action === 'stop') {
		// Grab the flows again
		const [errA, flowsToggled] = await to(findFlows(branch, token));
		if (errA) {
			throw new Error(errA);
		}

		// Stop the flow runs
		const [errQ] = await to(mapSeries(flowsToggled, async (flow) => {
			const [errT] = await to(mapSeries(flow.flow_runs, async (flowRun) => {
				const [errH, payload] = await to(stopFlowRun(flowRun.id, token));
				if (errH) {
					throw new Error(errH);
				}

			}));
			if (errT) {
				throw new Error(errT);
			}
		}));

		if (errQ) {
			throw new Error(errQ);
		}
	}
}

const runQuery = async(query, token, variables={}) => {
	const config = {
		headers: {
			'content-type': 'application/json',
			"authorization": `Bearer ${token}`,
			'x-prefect-interactive-api': false,
		},
	};

	const data = {
		query,
		variables
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

const findFlows = async(branch, token) => {
	console.log(`findFlows: ${branch}`);

	const query = `{
		flow(where: { 
			name: { 
				_ilike: "%${branch}" 
			} 
			archived: {
				_eq: false 
			}
		}) {
			id
			name
			flow_runs(where: {
				state: {
					_in: [
						"Running", "Scheduled", "Pending", "Retrying"
					]
				}
			}) {
				id
				name
				state
			}
		}
	}`;

	const [errA, data] = await to(runQuery(query, token));
	if (errA) {
		throw new Error(errA);
	}

	const flows = _.get(data, 'flow', '');
	console.log(`findFlows: ${branch} found ${flows.length}`);

	return flows
}

const toggleFlowSchedule = async(id, action, token, name) => {
	console.log(`toggleFlowSchedule: [${name}] ${id} ${action}`);

	let direction = 'set_schedule_inactive'
	if(action === 'start'){
		direction = 'set_schedule_active'
	}

	const query = `mutation {
		${direction}(input: {
			flow_id: "${id}"
		}) {
			success
		}
	}`;

	const [errA, data] = await to(runQuery(query, token));
	if (errA) {
		throw new Error(errA);
	}

	console.log(`toggleFlowSchedule: [${name}] ${id} ${action} SUCCESS`);
	return data;
}

const stopFlowRun = async(id, token) => {
	console.log(`stopFlowRun: ${id}`);
	const query = `mutation($input: cancel_flow_run_input!) {
		cancel_flow_run(input:$input) {
			state
		}
	}`;

	const vars = {
		"input": {
			"flow_run_id": id
		}
	};

	const [errA, data] = await to(runQuery(query, token, vars));
	if (errA) {
		throw new Error(errA);
	}
	console.log(`stopFlowRun: ${id} SUCCESS`);
	return _.get(data, 'flow', '');
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

	if(action !== 'start' && action !== 'stop') {
		throw new Error('action must be either `start` or `stop`');

	}

	const branch = core.getInput('branch');
	if(!branch) {
		throw new Error('branch is not set');
	}

	if(!branches.includes(branch)) {
		throw new Error(`${branch} is not a valid branch`);
	}

	const [errA, flows] = await to(findFlows(branch, prefect_account_key));
	if (errA) {
		throw new Error(errA);
	}

	const [errB] = await to(handleFlows(action, flows, branch, prefect_account_key));
	if (errB) {
		throw new Error(errB);
	}
};

try {
	run();
} catch (error) {
	core.setFailed(error.message);
}
