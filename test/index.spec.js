import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../src';

const AUTH = env.AUTH_SECRET;

const request = (path, { method = 'GET', headers = {} } = {}) => {
	const ctx = createExecutionContext();
	const req = new Request(`http://example.com${path}`, { method, headers });
	return Promise.resolve(worker.fetch(req, env, ctx)).then(async (response) => {
		await waitOnExecutionContext(ctx);
		return response;
	});
};

beforeEach(async () => {
	const { keys } = await env.URLS.list();
	await Promise.all(keys.map(({ name }) => env.URLS.delete(name)));
});

describe('GET /:hash', () => {
	it('redirects to the stored destination', async () => {
		await env.URLS.put('demo', 'https://example.com', { metadata: { destination: 'https://example.com' } });

		const response = await request('/demo');

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('https://example.com');
	});

	it('returns 404 for a missing hash instead of throwing', async () => {
		const response = await request('/does-not-exist');

		expect(response.status).toBe(404);
	});
});

describe('POST /:hash', () => {
	it('creates a link with a generated hash and returns it as JSON', async () => {
		const response = await request('/', {
			method: 'POST',
			headers: { Authorization: AUTH, 'X-Destination': 'https://example.com' },
		});

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.hash).toBeTruthy();
		expect(body.destination).toBe('https://example.com');
	});

	it('creates a link with a custom hash', async () => {
		const response = await request('/custom', {
			method: 'POST',
			headers: { Authorization: AUTH, 'X-Destination': 'https://example.com' },
		});

		expect(response.status).toBe(201);
		expect(await env.URLS.get('custom')).toBe('https://example.com');
	});

	it('returns 409 when the hash already exists', async () => {
		await env.URLS.put('taken', 'https://example.com', { metadata: { destination: 'https://example.com' } });

		const response = await request('/taken', {
			method: 'POST',
			headers: { Authorization: AUTH, 'X-Destination': 'https://other.com' },
		});

		expect(response.status).toBe(409);
	});

	it('returns 400 for an invalid destination', async () => {
		const response = await request('/bad', {
			method: 'POST',
			headers: { Authorization: AUTH, 'X-Destination': '' },
		});

		expect(response.status).toBe(400);
	});

	it('returns 401 when the auth header does not match', async () => {
		const response = await request('/blocked', {
			method: 'POST',
			headers: { Authorization: 'wrong-secret', 'X-Destination': 'https://example.com' },
		});

		expect(response.status).toBe(401);
	});
});

describe('PUT/PATCH /:hash', () => {
	it('updates the destination of an existing hash', async () => {
		await env.URLS.put('demo', 'https://old.com', { metadata: { destination: 'https://old.com' } });

		const response = await request('/demo', {
			method: 'PATCH',
			headers: { Authorization: AUTH, 'X-Destination': 'https://new.com' },
		});

		expect(response.status).toBe(200);
		expect(await env.URLS.get('demo')).toBe('https://new.com');
	});

	it('returns 404 when updating a hash that does not exist', async () => {
		const response = await request('/missing', {
			method: 'PUT',
			headers: { Authorization: AUTH, 'X-Destination': 'https://new.com' },
		});

		expect(response.status).toBe(404);
	});

	it('returns 401 when the auth header does not match', async () => {
		await env.URLS.put('demo', 'https://old.com', { metadata: { destination: 'https://old.com' } });

		const response = await request('/demo', {
			method: 'PUT',
			headers: { Authorization: 'wrong-secret', 'X-Destination': 'https://new.com' },
		});

		expect(response.status).toBe(401);
	});
});

describe('DELETE /:hash', () => {
	it('removes an existing link', async () => {
		await env.URLS.put('demo', 'https://example.com', { metadata: { destination: 'https://example.com' } });

		const response = await request('/demo', { method: 'DELETE', headers: { Authorization: AUTH } });

		expect(response.status).toBe(204);
		expect(await env.URLS.get('demo')).toBeNull();
	});

	it('returns 401 when the auth header does not match', async () => {
		const response = await request('/demo', { method: 'DELETE', headers: { Authorization: 'wrong-secret' } });

		expect(response.status).toBe(401);
	});
});

describe('GET /', () => {
	it('renders the UI with the list of links embedded as JSON', async () => {
		await env.URLS.put('demo', 'https://example.com', { metadata: { destination: 'https://example.com' } });

		const response = await request('/');

		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain('"hash":"demo"');
		expect(html).toContain('"destination":"https://example.com"');
	});
});
