import type { LinksResponse, ShortLink } from './types';

const getElement = <T extends HTMLElement>(selector: string): T => {
	const element = document.querySelector<T>(selector);

	if (!element) {
		throw new Error(`Element not found: ${selector}`);
	}

	return element;
};

const $link = getElement<HTMLInputElement>('#link');
const $hash = getElement<HTMLInputElement>('#hash');
const $auth = getElement<HTMLInputElement>('#auth');
const $create = getElement<HTMLButtonElement>('#create');
const $result = getElement<HTMLDivElement>('#result');
const $links = getElement<HTMLDivElement>('#links');

const fetchLinks = async (): Promise<ShortLink[]> => {
	const response = await fetch('/api/links');

	if (!response.ok) {
		throw new Error(`Unexpected status ${response.status} while loading links`);
	}

	const { links }: LinksResponse = await response.json();

	return links;
};

const renderLinks = (links: ShortLink[]): void => {
	const rows = links.map(({ hash }) => {
		const row = document.createElement('div');
		const anchor = document.createElement('a');

		row.className = 'link-row';
		anchor.href = `/${encodeURIComponent(hash)}`;
		anchor.textContent = hash;
		row.append(anchor);

		return row;
	});

	$links.replaceChildren(...rows);
};

const createLink = async (): Promise<void> => {
	const response = await fetch('/'.concat($hash.value), {
		method: 'POST',
		headers: {
			Authorization: $auth.value,
			'X-Destination': $link.value,
		},
	});

	$result.textContent = response.ok ? '✅ Created shorten URL!' : '❌ Something went BAD!';
};

$create.addEventListener('click', (event) => {
	event.preventDefault();
	void createLink();
});

fetchLinks().then(renderLinks).catch(console.error);
