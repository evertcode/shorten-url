const API_PREFIX = 'api';
const ASSETS_PREFIX = 'assets';
const NOT_FOUND_PAGE = '404';
const HASH_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * @typedef {{ hash: string, shortUrl: string, destination: string }} ShortLink
 * @typedef {{ links: ShortLink[] }} LinksResponse
 * @typedef {ShortLink} CreateLinkResponse
 * @typedef {ShortLink} UpdateLinkResponse
 * @typedef {'hash_taken' | 'unauthorized' | 'invalid_destination' | 'invalid_hash' | 'not_found'} ApiErrorCode
 * @typedef {{ error: ApiErrorCode }} ApiError
 */

const isHttpUrl = (value) => {
	try {
		return ['http:', 'https:'].includes(new URL(value).protocol);
	} catch {
		return false;
	}
};

export default {
	async fetch(request, env, ctx) {
		const setCache = (hash, data) => env.URLS.put(hash, data, { metadata: { destination: data } });
		const getCache = (hash) => env.URLS.get(hash);
		const deleteCache = (hash) => env.URLS.delete(hash);
		const getAllCache = () => env.URLS.list();

		const responseWith = ({ body = null, contentType = 'text/html', location, status = 200 }) =>
			new Response(body, {
				status,
				headers: {
					'Content-Type': contentType,
					...(location ? { Location: location } : {}),
				},
			});

		/** @param {ApiErrorCode} error */
		const errorWith = (error, status) => {
			/** @type {ApiError} */
			const body = { error };

			return Response.json(body, { status });
		};

		const notFound = async ({ origin }) => {
			const page = await env.ASSETS.fetch(new Request(`${origin}/${NOT_FOUND_PAGE}`));

			return new Response(page.body, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
		};

		const handleGet = async ({ hash, origin }) => {
			const location = await getCache(hash);

			if (!location) {
				return notFound({ origin });
			}

			const validUrlLocation = location.startsWith('http') ? location : `https://${location}`;

			return responseWith({ status: 302, location: validUrlLocation });
		};

		const handlePost = async ({ hash, headers, origin }) => {
			hash = hash || Math.random().toString(36).substring(2, 10);

			if (!HASH_PATTERN.test(hash)) {
				return errorWith('invalid_hash', 400);
			}

			const destination = headers.get('x-destination');

			if (!destination || !isHttpUrl(destination)) {
				return errorWith('invalid_destination', 400);
			}

			const previousLocation = await getCache(hash);

			if (previousLocation) {
				return errorWith('hash_taken', 409);
			}

			await setCache(hash, destination);

			/** @type {CreateLinkResponse} */
			const body = { hash, shortUrl: `${origin}/${hash}`, destination };

			return Response.json(body, { status: 201 });
		};

		const handleUpdate = async ({ hash, headers, origin }) => {
			if (!HASH_PATTERN.test(hash)) {
				return errorWith('invalid_hash', 400);
			}

			const previousLocation = await getCache(hash);

			if (!previousLocation) {
				return errorWith('not_found', 404);
			}

			const destination = headers.get('x-destination');

			if (!destination || !isHttpUrl(destination)) {
				return errorWith('invalid_destination', 400);
			}

			await setCache(hash, destination);

			/** @type {UpdateLinkResponse} */
			const body = { hash, shortUrl: `${origin}/${hash}`, destination };

			return Response.json(body);
		};

		const handleDelete = async ({ hash }) => {
			await deleteCache(hash);

			return responseWith({ status: 204 });
		};

		const handleListLinks = async ({ origin }) => {
			const { keys } = await getAllCache();

			/** @type {ShortLink[]} */
			const links = await Promise.all(
				keys.map(async ({ name, metadata }) => ({
					hash: name,
					shortUrl: `${origin}/${name}`,
					destination: metadata?.destination ?? (await getCache(name)) ?? '',
				}))
			);

			/** @type {LinksResponse} */
			const body = { links };

			return Response.json(body);
		};

		const handleApi = ({ hash, method, origin }) =>
			hash === `${API_PREFIX}/links` && method === 'GET' ? handleListLinks({ origin }) : responseWith({ status: 404 });

		const checkAuth = ({ auth }, callback) => (auth === env.AUTH_SECRET ? callback() : errorWith('unauthorized', 401));

		const { headers, url, method } = request;
		const { pathname, origin } = new URL(url);
		const hash = pathname.slice(1);
		const auth = headers.get('Authorization');

		if (hash === API_PREFIX || hash.startsWith(`${API_PREFIX}/`)) {
			return handleApi({ hash, method, origin });
		}

		const isAssetRequest = hash === '' || hash.startsWith(`${ASSETS_PREFIX}/`);

		if (isAssetRequest && ['GET', 'HEAD'].includes(method)) {
			return env.ASSETS.fetch(request);
		}

		if (method === 'GET') {
			return handleGet({ hash, origin });
		}

		if (method === 'POST') {
			return checkAuth({ auth }, () => handlePost({ hash, headers, origin }));
		}

		if (method === 'DELETE') {
			return checkAuth({ auth }, () => handleDelete({ hash }));
		}

		if (['PUT', 'PATCH'].includes(method)) {
			return checkAuth({ auth }, () => handleUpdate({ hash, headers, origin }));
		}

		return responseWith({ status: 405 });
	},
};
