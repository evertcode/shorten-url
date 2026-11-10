const API_PREFIX = 'api';
const ASSETS_PREFIX = 'assets';

/**
 * @typedef {{ hash: string }} ShortLink
 * @typedef {{ links: ShortLink[] }} LinksResponse
 */

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
					Location: location,
				},
			});

		const handleGet = async ({ hash }) => {
			const location = await getCache(hash);

			const validUrlLocation = location.startsWith('http') ? location : `https://${location}`;

			return location ? responseWith({ status: 302, location: `${validUrlLocation}` }) : responseWith({ status: 404 });
		};

		const handlePost = async ({ hash, headers }) => {
			hash = hash || Math.random().toString(36).substring(2, 10);

			const previousLocation = await getCache(hash);

			if (previousLocation) {
				return responseWith({ status: 409 });
			}

			const destination = headers.get('x-destination');
			await setCache(hash, destination);

			return responseWith({ status: 201 });
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

		const checkAuth = ({ auth }, callback) => (auth === env.AUTH_SECRET ? callback() : responseWith({ status: 401 }));

		const { headers, url, method } = request;
		const { pathname } = new URL(url);
		const hash = pathname.slice(1);
		const auth = headers.get('Authorization');

		console.log({ hash, auth, method, pathname });

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
			return checkAuth({ auth }, () => handlePost({ hash, headers }));
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
