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
			expect(await response.text()).toContain('<h1>URL Shortener</h1>');
		});
	});

	describe('GET /api/links', () => {
		it('returns the stored hashes', async () => {
			await env.URLS.put('docs', 'https://example.org/docs');
			await env.URLS.put('blog', 'https://example.org/blog');

			const response = await SELF.fetch(`${ORIGIN}/api/links`);

			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toContain('application/json');
			expect(await response.json()).toEqual({ links: [{ hash: 'blog' }, { hash: 'docs' }] });
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
	});

	describe('POST /{hash}', () => {
		it('returns 401 without a valid access code', async () => {
			const response = await SELF.fetch(`${ORIGIN}/docs`, {
				method: 'POST',
				headers: { Authorization: 'wrong-code', 'X-Destination': 'https://example.org/docs' },
			});

			expect(response.status).toBe(401);
			expect(await env.URLS.get('docs')).toBeNull();
		});

		it('returns 201 and stores the destination with a valid access code', async () => {
			const response = await SELF.fetch(`${ORIGIN}/docs`, {
				method: 'POST',
				headers: { Authorization: ACCESS_CODE, 'X-Destination': 'https://example.org/docs' },
			});

			expect(response.status).toBe(201);
			expect(await env.URLS.get('docs')).toBe('https://example.org/docs');
		});

		it('generates a hash when none is given', async () => {
			const response = await SELF.fetch(`${ORIGIN}/`, {
				method: 'POST',
				headers: { Authorization: ACCESS_CODE, 'X-Destination': 'https://example.org/docs' },
			});
			const { keys } = await env.URLS.list();

			expect(response.status).toBe(201);
			expect(keys).toHaveLength(1);
			expect(await env.URLS.get(keys[0].name)).toBe('https://example.org/docs');
		});

		it('rejects the reserved api prefix', async () => {
			const response = await SELF.fetch(`${ORIGIN}/api`, {
				method: 'POST',
				headers: { Authorization: ACCESS_CODE, 'X-Destination': 'https://example.org/docs' },
			});

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
