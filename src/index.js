const API_PREFIX = 'api';
const ASSETS_PREFIX = 'assets';
const HASH_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * @typedef {{ hash: string }} ShortLink
 * @typedef {{ links: ShortLink[] }} LinksResponse
 * @typedef {{ hash: string, shortUrl: string, destination: string }} CreateLinkResponse
 * @typedef {'hash_taken' | 'unauthorized' | 'invalid_destination' | 'invalid_hash'} CreateLinkErrorCode
 * @typedef {{ error: CreateLinkErrorCode }} CreateLinkError
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
		const setCache = (hash, data) => env.URLS.put(hash, data);
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

		/** @param {CreateLinkErrorCode} error */
		const errorWith = (error, status) => {
			/** @type {CreateLinkError} */
			const body = { error };

			return Response.json(body, { status });
		};

		const handleGet = async ({ hash }) => {
			const location = await getCache(hash);

			const validUrlLocation = location.startsWith('http') ? location : `https://${location}`;

			return location ? responseWith({ status: 302, location: `${validUrlLocation}` }) : responseWith({ status: 404 });
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

		const handleDelete = async ({ hash }) => {
			await deleteCache(hash);

			return responseWith({ status: 204 });
		};

		const handleListLinks = async () => {
			const { keys } = await getAllCache();

			/** @type {LinksResponse} */
			const body = { links: keys.map(({ name }) => ({ hash: name })) };

			return Response.json(body);
		};

		const handleApi = ({ hash, method }) =>
			hash === `${API_PREFIX}/links` && method === 'GET' ? handleListLinks() : responseWith({ status: 404 });

		const checkAuth = ({ auth }, callback) => (auth === env.AUTH_SECRET ? callback() : errorWith('unauthorized', 401));

		const { headers, url, method } = request;
		const { pathname, origin } = new URL(url);
		const hash = pathname.slice(1);
		const auth = headers.get('Authorization');

		if (hash === API_PREFIX || hash.startsWith(`${API_PREFIX}/`)) {
			return handleApi({ hash, method });
		}

		const isAssetRequest = hash === '' || hash.startsWith(`${ASSETS_PREFIX}/`);

		if (isAssetRequest && ['GET', 'HEAD'].includes(method)) {
			return env.ASSETS.fetch(request);
		}

		if (method === 'GET') {
			return handleGet({ hash });
		}

		if (method === 'POST') {
			return checkAuth({ auth }, () => handlePost({ hash, headers, origin }));
		}

		if (method === 'DELETE') {
			return checkAuth({ auth }, () => handleDelete({ hash }));
		}

		if (['PUT', 'PATCH'].includes(method)) {
			return checkAuth({ auth }, () => handleUpdate({ hash }));
		}

		return responseWith({ status: 405 });
	},
};
