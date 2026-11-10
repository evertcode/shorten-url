import './brand';
import type {
	CreateLinkError,
	CreateLinkErrorCode,
	CreateLinkRequest,
	CreateLinkResponse,
	CreateLinkResult,
	FieldError,
	FieldName,
	LinksResponse,
	ShortLink,
} from './types';

const COPY = {
	submit: 'Shorten URL',
	submitting: 'Shortening…',
	copy: 'Copy',
	copied: 'Copied!',
	linksLoading: 'Loading links…',
	linksEmpty: 'No links yet. Create your first one.',
	linksError: 'Could not load your links. Reload the page to try again.',
	invalidDestination: 'Enter a valid URL, including https://',
	invalidHash: 'Aliases can only contain letters, numbers, hyphens and underscores.',
	hashTaken: 'That alias is already taken. Try another one.',
	unauthorized: 'The access code is not valid.',
	network: 'Could not reach the server. Check your connection and try again.',
	unknown: 'Something went wrong. Please try again.',
} as const;

const HASH_PATTERN = /^[A-Za-z0-9_-]+$/;
const COPIED_FEEDBACK_MS = 2000;

const SERVER_ERRORS: Record<CreateLinkErrorCode, FieldError> = {
	hash_taken: { field: 'hash', message: COPY.hashTaken },
	invalid_hash: { field: 'hash', message: COPY.invalidHash },
	invalid_destination: { field: 'destination', message: COPY.invalidDestination },
	unauthorized: { field: 'accessCode', message: COPY.unauthorized },
};

const getElement = <T extends HTMLElement>(selector: string): T => {
	const element = document.querySelector<T>(selector);

	if (!element) {
		throw new Error(`Element not found: ${selector}`);
	}

	return element;
};

const $form = getElement<HTMLFormElement>('#create-form');
const $create = getElement<HTMLButtonElement>('#create');
const $formError = getElement<HTMLParagraphElement>('#form-error');
const $hashPrefix = getElement<HTMLSpanElement>('#hash-prefix');
const $resultCard = getElement<HTMLElement>('#result-card');
const $resultLink = getElement<HTMLAnchorElement>('#result-link');
const $resultDestination = getElement<HTMLParagraphElement>('#result-destination');
const $copy = getElement<HTMLButtonElement>('#copy');
const $links = getElement<HTMLUListElement>('#links');
const $linksStatus = getElement<HTMLParagraphElement>('#links-status');

const fields: Record<FieldName, { input: HTMLInputElement; error: HTMLParagraphElement }> = {
	destination: { input: getElement('#link'), error: getElement('#link-error') },
	hash: { input: getElement('#hash'), error: getElement('#hash-error') },
	accessCode: { input: getElement('#auth'), error: getElement('#auth-error') },
};

const fieldNames = Object.keys(fields) as FieldName[];

const isHttpUrl = (value: string): boolean => {
	try {
		return ['http:', 'https:'].includes(new URL(value).protocol);
	} catch {
		return false;
	}
};

const validate = ({ destination, hash, accessCode }: CreateLinkRequest): FieldError[] => {
	const errors: FieldError[] = [];

	if (!isHttpUrl(destination)) {
		errors.push({ field: 'destination', message: COPY.invalidDestination });
	}

	if (hash !== '' && !HASH_PATTERN.test(hash)) {
		errors.push({ field: 'hash', message: COPY.invalidHash });
	}

	if (accessCode === '') {
		errors.push({ field: 'accessCode', message: COPY.unauthorized });
	}

	return errors;
};

const clearFieldError = (field: FieldName): void => {
	const { input, error } = fields[field];

	input.removeAttribute('aria-invalid');
	error.hidden = true;
	error.textContent = '';
};

const showFieldErrors = (errors: FieldError[]): void => {
	errors.forEach(({ field, message }) => {
		const { input, error } = fields[field];

		input.setAttribute('aria-invalid', 'true');
		error.textContent = message;
		error.hidden = false;
	});

	const [first] = errors;

	if (first) {
		fields[first.field].input.focus();
	}
};

const showFormError = (message: string): void => {
	$formError.textContent = message;
	$formError.hidden = false;
};

const clearErrors = (): void => {
	fieldNames.forEach(clearFieldError);
	$formError.hidden = true;
	$formError.textContent = '';
};

const setSubmitting = (isSubmitting: boolean): void => {
	$create.disabled = isSubmitting;
	$create.textContent = isSubmitting ? COPY.submitting : COPY.submit;
	$form.setAttribute('aria-busy', String(isSubmitting));
};

const requestLink = async ({ destination, hash, accessCode }: CreateLinkRequest): Promise<CreateLinkResult> => {
	let response: Response;

	try {
		response = await fetch(`/${encodeURIComponent(hash)}`, {
			method: 'POST',
			headers: { Authorization: accessCode, 'X-Destination': destination },
		});
	} catch {
		return { ok: false, formError: COPY.network };
	}

	try {
		if (response.ok) {
			const link: CreateLinkResponse = await response.json();

			return { ok: true, link };
		}

		const { error }: CreateLinkError = await response.json();
		const fieldError = SERVER_ERRORS[error];

		return fieldError ? { ok: false, fieldError } : { ok: false, formError: COPY.unknown };
	} catch {
		return { ok: false, formError: COPY.unknown };
	}
};

const withoutScheme = (url: string): string => url.replace(/^https?:\/\//, '');

const showResult = ({ shortUrl, destination }: CreateLinkResponse): void => {
	$resultLink.href = shortUrl;
	const [host, ...path] = withoutScheme(shortUrl).split('/');

	$resultLink.replaceChildren(`${host}/`, document.createElement('wbr'), path.join('/'));
	$resultDestination.textContent = withoutScheme(destination);
	$resultDestination.title = destination;
	$copy.textContent = COPY.copy;
	$resultCard.hidden = false;
	$resultLink.focus();
};

const readForm = (): CreateLinkRequest => ({
	destination: fields.destination.input.value.trim(),
	hash: fields.hash.input.value.trim(),
	accessCode: fields.accessCode.input.value,
});

const submit = async (): Promise<void> => {
	const request = readForm();
	const errors = validate(request);

	clearErrors();
	$resultCard.hidden = true;

	if (errors.length > 0) {
		showFieldErrors(errors);
		return;
	}

	setSubmitting(true);
	const result = await requestLink(request);
	setSubmitting(false);

	if (result.ok) {
		fields.destination.input.value = '';
		fields.hash.input.value = '';
		showResult(result.link);
		addLink(result.link);
		return;
	}

	if ('fieldError' in result) {
		showFieldErrors([result.fieldError]);
		return;
	}

	showFormError(result.formError);
	$create.focus();
};

const selectContents = (element: HTMLElement): void => {
	const range = document.createRange();

	range.selectNodeContents(element);
	getSelection()?.removeAllRanges();
	getSelection()?.addRange(range);
};

const copiedTimeouts = new WeakMap<HTMLButtonElement, number>();

const copyLink = async ($button: HTMLButtonElement, $anchor: HTMLAnchorElement): Promise<void> => {
	try {
		await navigator.clipboard.writeText($anchor.href);
	} catch {
		selectContents($anchor);
		return;
	}

	$button.textContent = COPY.copied;
	window.clearTimeout(copiedTimeouts.get($button));
	copiedTimeouts.set(
		$button,
		window.setTimeout(() => {
			$button.textContent = COPY.copy;
		}, COPIED_FEEDBACK_MS)
	);
};

const fetchLinks = async (): Promise<ShortLink[]> => {
	const response = await fetch('/api/links');

	if (!response.ok) {
		throw new Error(`Unexpected status ${response.status} while loading links`);
	}

	const { links }: LinksResponse = await response.json();

	return links;
};

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const createArrow = (): SVGSVGElement => {
	const $arrow = document.createElementNS(SVG_NAMESPACE, 'svg');
	const $use = document.createElementNS(SVG_NAMESPACE, 'use');

	$arrow.setAttribute('class', 'arrow');
	$arrow.setAttribute('aria-hidden', 'true');
	$use.setAttribute('href', '#arrow');
	$arrow.append($use);

	return $arrow;
};

const createLinkRow = ({ hash, shortUrl, destination }: ShortLink): HTMLLIElement => {
	const $row = document.createElement('li');
	const $shield = document.createElement('a');
	const $destination = document.createElement('span');
	const $button = document.createElement('button');

	$row.className = 'link-row';

	$shield.className = 'shield';
	$shield.href = shortUrl;
	$shield.target = '_blank';
	$shield.rel = 'noopener';
	$shield.title = withoutScheme(shortUrl);
	$shield.textContent = hash;

	$destination.className = 'link-destination';
	$destination.textContent = withoutScheme(destination);
	$destination.title = destination;

	$button.className = 'button button-plate';
	$button.type = 'button';
	$button.textContent = COPY.copy;
	$button.setAttribute('aria-live', 'polite');
	$button.addEventListener('click', () => void copyLink($button, $shield));

	$row.append($shield, createArrow(), $destination, $button);

	return $row;
};

const showLinksStatus = (message: string): void => {
	$linksStatus.textContent = message;
	$linksStatus.hidden = false;
	$links.hidden = true;
};

let links: ShortLink[] = [];

const renderLinks = (): void => {
	if (links.length === 0) {
		showLinksStatus(COPY.linksEmpty);
		return;
	}

	$links.replaceChildren(...links.map(createLinkRow));
	$links.hidden = false;
	$linksStatus.hidden = true;
};

const addLink = (link: ShortLink): void => {
	links = [link, ...links.filter(({ hash }) => hash !== link.hash)];
	renderLinks();
};

const loadLinks = async (): Promise<void> => {
	showLinksStatus(COPY.linksLoading);

	try {
		links = await fetchLinks();
	} catch {
		showLinksStatus(COPY.linksError);
		return;
	}

	renderLinks();
};

$hashPrefix.textContent = `${location.host}/`;

$form.addEventListener('submit', (event) => {
	event.preventDefault();

	if (!$create.disabled) {
		void submit();
	}
});

fieldNames.forEach((field) => {
	fields[field].input.addEventListener('input', () => clearFieldError(field));
});

$copy.addEventListener('click', () => void copyLink($copy, $resultLink));

void loadLinks();
