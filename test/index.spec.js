import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

const ORIGIN = 'http://example.com';
const ACCESS_CODE = env.AUTH_SECRET;

const clearLinks = async () => {
	const { keys } = await env.URLS.list();

	await Promise.all(keys.map(({ name }) => env.URLS.delete(name)));
};

describe('URL shortener worker', () => {
	beforeEach(clearLinks);

	describe('GET /', () => {
		it('serves the page from the static assets', async () => {
			const response = await SELF.fetch(`${ORIGIN}/`);

			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toContain('text/html');
			expect(await response.text()).toContain('id="create-form"');
		});
	});

	describe('GET /api/links', () => {
		it('includes hash, shortUrl and destination for each link', async () => {
			await env.URLS.put('docs', 'https://example.org/docs');
			await env.URLS.put('blog', 'https://example.org/blog');

			const response = await SELF.fetch(`${ORIGIN}/api/links`);

			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toContain('application/json');
			expect(await response.json()).toEqual({
				links: [
					{ hash: 'blog', shortUrl: `${ORIGIN}/blog`, destination: 'https://example.org/blog' },
					{ hash: 'docs', shortUrl: `${ORIGIN}/docs`, destination: 'https://example.org/docs' },
				],
			});
		});

		it('returns an empty list when there are no links', async () => {
			const response = await SELF.fetch(`${ORIGIN}/api/links`);

			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({ links: [] });
		});
	});

	describe('GET /{hash}', () => {
		it('redirects with 302 to the stored destination', async () => {
			await env.URLS.put('docs', 'https://example.org/docs');

			const response = await SELF.fetch(`${ORIGIN}/docs`, { redirect: 'manual' });

			expect(response.status).toBe(302);
			expect(response.headers.get('Location')).toBe('https://example.org/docs');
		});

		it('redirects to the https version of a destination stored without a scheme', async () => {
			await env.URLS.put('docs', 'example.org/docs');

			const response = await SELF.fetch(`${ORIGIN}/docs`, { redirect: 'manual' });

			expect(response.status).toBe(302);
			expect(response.headers.get('Location')).toBe('https://example.org/docs');
		});

		it('returns 404 with an HTML page for an unknown hash', async () => {
			const response = await SELF.fetch(`${ORIGIN}/missing`);

			expect(response.status).toBe(404);
			expect(response.headers.get('Content-Type')).toContain('text/html');
			expect(await response.text()).toContain('<h1>Link not found</h1>');
		});
	});

	describe('POST /{hash}', () => {
		const post = (path, headers) => SELF.fetch(`${ORIGIN}${path}`, { method: 'POST', headers });
		const validHeaders = { Authorization: ACCESS_CODE, 'X-Destination': 'https://example.org/docs' };

		it('returns 201 with hash, shortUrl and destination in the JSON body', async () => {
			const response = await post('/docs', validHeaders);

			expect(response.status).toBe(201);
			expect(response.headers.get('Content-Type')).toContain('application/json');
			expect(await response.json()).toEqual({
				hash: 'docs',
				shortUrl: `${ORIGIN}/docs`,
				destination: 'https://example.org/docs',
			});
			expect(await env.URLS.get('docs')).toBe('https://example.org/docs');
		});

		it('generates a hash when none is given and returns it in the JSON body', async () => {
			const response = await post('/', validHeaders);
			const { hash, shortUrl } = await response.json();

			expect(response.status).toBe(201);
			expect(hash).toMatch(/^[a-z0-9]+$/);
			expect(shortUrl).toBe(`${ORIGIN}/${hash}`);
			expect(await env.URLS.get(hash)).toBe('https://example.org/docs');
		});

		it('returns 409 with hash_taken when the hash already exists', async () => {
			await env.URLS.put('docs', 'https://example.org/original');

			const response = await post('/docs', validHeaders);

			expect(response.status).toBe(409);
			expect(await response.json()).toEqual({ error: 'hash_taken' });
			expect(await env.URLS.get('docs')).toBe('https://example.org/original');
		});

		it('returns 401 with unauthorized without a valid access code', async () => {
			const response = await post('/docs', { ...validHeaders, Authorization: 'wrong-code' });

			expect(response.status).toBe(401);
			expect(await response.json()).toEqual({ error: 'unauthorized' });
			expect(await env.URLS.get('docs')).toBeNull();
		});

		it('returns 400 with invalid_destination without X-Destination', async () => {
			const response = await post('/docs', { Authorization: ACCESS_CODE });

			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({ error: 'invalid_destination' });
			expect(await env.URLS.get('docs')).toBeNull();
		});

		it('returns 400 with invalid_destination for a non http(s) destination', async () => {
			const response = await post('/docs', { ...validHeaders, 'X-Destination': 'javascript:alert(1)' });

			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({ error: 'invalid_destination' });
			expect(await env.URLS.get('docs')).toBeNull();
		});

		it('returns 400 with invalid_hash for a hash with unsupported characters', async () => {
			const response = await post('/my%20docs', validHeaders);
			const { keys } = await env.URLS.list();

			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({ error: 'invalid_hash' });
			expect(keys).toHaveLength(0);
		});

		it('does not include a Location header in non redirect responses', async () => {
			const response = await post('/docs', validHeaders);

			expect(response.headers.has('Location')).toBe(false);
		});

		it('rejects the reserved api prefix', async () => {
			const response = await post('/api', validHeaders);

			expect(response.status).toBe(404);
			expect(await env.URLS.get('api')).toBeNull();
		});
	});

	describe('DELETE /{hash}', () => {
		it('returns 204 and removes the link with a valid access code', async () => {
			await env.URLS.put('docs', 'https://example.org/docs');

			const response = await SELF.fetch(`${ORIGIN}/docs`, {
				method: 'DELETE',
				headers: { Authorization: ACCESS_CODE },
			});

			expect(response.status).toBe(204);
			expect(await env.URLS.get('docs')).toBeNull();
		});
	});
});
