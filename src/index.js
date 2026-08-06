import component from './component.html';

export default {
	async fetch(request, env, ctx) {
		const setCache = (hash, data) => env.URLS.put(hash, data, { metadata: { destination: data } });
		const getCache = (hash) => env.URLS.get(hash);
		const deleteCache = (hash) => env.URLS.delete(hash);
		const getAllCache = () => env.URLS.list();

		const responseWith = ({ body = null, contentType = 'text/plain', headers = {}, status = 200 }) =>
			new Response(body, {
				status,
				headers: { 'Content-Type': contentType, ...headers },
			});

		const isValidDestination = (destination) => {
			if (!destination) return false;
			try {
				new URL(destination.startsWith('http') ? destination : `https://${destination}`);
				return true;
			} catch {
				return false;
			}
		};

		const handleGet = async ({ hash }) => {
			const location = await getCache(hash);

			if (!location) {
				return responseWith({ status: 404 });
			}

			const validUrlLocation = location.startsWith('http') ? location : `https://${location}`;

			return responseWith({ status: 302, headers: { Location: validUrlLocation } });
		};

		const handlePost = async ({ hash, headers }) => {
			hash = hash || Math.random().toString(36).substring(2, 10);

			const previousLocation = await getCache(hash);

			if (previousLocation) {
				return responseWith({ status: 409 });
			}

			const destination = headers.get('x-destination');

			if (!isValidDestination(destination)) {
				return responseWith({ status: 400 });
			}

			await setCache(hash, destination);

			return responseWith({
				status: 201,
				contentType: 'application/json',
				body: JSON.stringify({ hash, destination }),
			});
		};

		const handleUpdate = async ({ hash, headers }) => {
			if (!hash) {
				return responseWith({ status: 400 });
			}

			const previousLocation = await getCache(hash);

			if (!previousLocation) {
				return responseWith({ status: 404 });
			}

			const destination = headers.get('x-destination');

			if (!isValidDestination(destination)) {
				return responseWith({ status: 400 });
			}

			await setCache(hash, destination);

			return responseWith({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ hash, destination }),
			});
		};

		const handleDelete = async ({ hash }) => {
			await deleteCache(hash);

			return responseWith({ status: 204 });
		};

		const checkAuth = ({ auth }, callback) => (auth === env.AUTH_SECRET ? callback() : responseWith({ status: 401 }));

		const renderUI = async () => {
			const { keys } = await getAllCache();

			const links = await Promise.all(
				keys.map(async ({ name, metadata }) => ({
					hash: name,
					destination: metadata?.destination ?? (await getCache(name)) ?? '',
				}))
			);

			const dataForScriptTag = JSON.stringify(links).replace(/</g, '\\u003c');
			const body = component.replace('$DATA', dataForScriptTag);

			return responseWith({ body, contentType: 'text/html' });
		};

		const { headers, url, method } = request;
		const { pathname } = new URL(url);
		const hash = pathname.slice(1);
		const auth = headers.get('Authorization');

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
			return checkAuth({ auth }, () => handleUpdate({ hash, headers }));
		}

		return responseWith({ status: 405 });
	},
};
