import { escapeHtml } from './escape.js';
import component from './component.html';

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

		const checkAuth = ({ auth }, callback) => (auth === env.AUTH_SECRET ? callback() : responseWith({ status: 401 }));

		const renderUI = async () => {
			const { keys } = await getAllCache();
			const allKeys = keys.map(({ name }) => name);
			const body = component.replace(
				'$DATA',
				`${allKeys
					.map(
						(key) =>
							`<div class="flex flex-col sm:flex-row items-center gap-2"><a href="/${key}" class="flex-1 text-blue-400">${key}</a></div>`
					)
					.join('')}`
			);

			console.log({ keys, allKeys });

			return new Response(body, {
				headers: { 'Content-Type': 'text/html' },
			});
		};

		const { headers, url, method } = request;
		const { pathname } = new URL(url);
		const hash = pathname.slice(1);
		const auth = headers.get('Authorization');

		console.log({ hash, auth, method, pathname });

		if (method === 'GET') {
			return hash !== '' ? handleGet({ hash }) : renderUI();
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
