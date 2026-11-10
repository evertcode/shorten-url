import './brand';
import type {
	ApiError,
	CreateLinkErrorCode,
	CreateLinkRequest,
	CreateLinkResponse,
	CreateLinkResult,
	FieldError,
	FieldName,
	LinksResponse,
	ManageLinkFailure,
	ManageLinkResult,
	ShortLink,
	UpdateLinkResponse,
} from './types';

const COPY = {
	submit: 'Shorten URL',
	submitting: 'Shortening…',
	copy: 'Copy',
	copied: 'Copied!',
	edit: 'Edit',
	save: 'Save',
	saving: 'Saving…',
	cancel: 'Cancel',
	delete: 'Delete',
	deleting: 'Deleting…',
	confirmDelete: 'Delete this link?',
	accessCodeRequired: 'Enter your access code to edit or delete links.',
	linkGone: 'That link no longer exists.',
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
const $linksNotice = getElement<HTMLParagraphElement>('#links-notice');
const $linksTitle = getElement<HTMLHeadingElement>('#links-title');

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

		const { error }: ApiError = await response.json();
		const fieldError = error === 'not_found' ? undefined : SERVER_ERRORS[error];

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

const createButton = (label: string, modifier = 'button-plate'): HTMLButtonElement => {
	const $button = document.createElement('button');

	$button.className = `button ${modifier}`;
	$button.type = 'button';
	$button.textContent = label;

	return $button;
};

const MANAGE_FAILURES: Record<number, ManageLinkFailure> = {
	400: 'invalid_destination',
	401: 'unauthorized',
	404: 'not_found',
};

const manageLink = async <T>(hash: string, init: RequestInit, read: (response: Response) => Promise<T>): Promise<ManageLinkResult<T>> => {
	let response: Response;

	try {
		response = await fetch(`/${encodeURIComponent(hash)}`, init);
	} catch {
		return { ok: false, reason: 'network' };
	}

	if (!response.ok) {
		return { ok: false, reason: MANAGE_FAILURES[response.status] ?? 'unknown' };
	}

	try {
		return { ok: true, value: await read(response) };
	} catch {
		return { ok: false, reason: 'unknown' };
	}
};

const updateLink = (hash: string, destination: string, accessCode: string): Promise<ManageLinkResult<UpdateLinkResponse>> =>
	manageLink(hash, { method: 'PATCH', headers: { Authorization: accessCode, 'X-Destination': destination } }, (response) => response.json());

const deleteLink = (hash: string, accessCode: string): Promise<ManageLinkResult<null>> =>
	manageLink(hash, { method: 'DELETE', headers: { Authorization: accessCode } }, async () => null);

const readAccessCode = (): string | null => {
	const accessCode = fields.accessCode.input.value;

	if (accessCode === '') {
		showFieldErrors([{ field: 'accessCode', message: COPY.accessCodeRequired }]);
		return null;
	}

	clearFieldError('accessCode');

	return accessCode;
};

const ROW_FAILURE_COPY: Record<Exclude<ManageLinkFailure, 'unauthorized' | 'not_found'>, string> = {
	invalid_destination: COPY.invalidDestination,
	network: COPY.network,
	unknown: COPY.unknown,
};

const showLinksNotice = (message: string): void => {
	$linksNotice.textContent = message;
	$linksNotice.hidden = false;
};

const clearLinksNotice = (): void => {
	$linksNotice.hidden = true;
	$linksNotice.textContent = '';
};

const focusRowAction = (hash: string, action: string): void => {
	const $row = [...$links.children].find(($child) => $child instanceof HTMLElement && $child.dataset.hash === hash);

	$row?.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)?.focus();
};

const createLinkRow = ({ hash, shortUrl, destination }: ShortLink): HTMLLIElement => {
	const $row = document.createElement('li');
	const $shield = document.createElement('a');
	const $destination = document.createElement('span');
	const $editor = document.createElement('input');
	const $confirm = document.createElement('span');
	const $actions = document.createElement('div');
	const $error = document.createElement('p');
	const $copyButton = createButton(COPY.copy);
	const $editButton = createButton(COPY.edit);
	const $deleteButton = createButton(COPY.delete);
	const $saveButton = createButton(COPY.save, 'button-plate button-solid');
	const $confirmButton = createButton(COPY.delete, 'button-plate button-danger');
	const $cancelButton = createButton(COPY.cancel);

	$row.className = 'link-row';
	$row.dataset.hash = hash;

	$shield.className = 'shield';
	$shield.href = shortUrl;
	$shield.target = '_blank';
	$shield.rel = 'noopener';
	$shield.title = withoutScheme(shortUrl);
	$shield.textContent = hash;

	$destination.className = 'link-destination';
	$destination.textContent = withoutScheme(destination);
	$destination.title = destination;

	$editor.className = 'input link-editor';
	$editor.type = 'url';
	$editor.inputMode = 'url';
	$editor.autocomplete = 'off';
	$editor.setAttribute('aria-label', `Destination URL for ${hash}`);

	$confirm.className = 'link-confirm';
	$confirm.textContent = COPY.confirmDelete;

	$actions.className = 'link-actions';

	$error.className = 'row-error';
	$error.setAttribute('role', 'alert');
	$error.hidden = true;

	$copyButton.setAttribute('aria-live', 'polite');
	$editButton.dataset.action = 'edit';
	$editButton.setAttribute('aria-label', `${COPY.edit} ${hash}`);
	$deleteButton.dataset.action = 'delete';
	$deleteButton.setAttribute('aria-label', `${COPY.delete} ${hash}`);

	const showError = (message: string): void => {
		$error.textContent = message;
		$error.hidden = false;
	};

	const setMode = (mode: 'view' | 'edit' | 'delete'): void => {
		$row.dataset.mode = mode;
		$error.hidden = true;
		$destination.hidden = mode !== 'view';
		$editor.hidden = mode !== 'edit';
		$confirm.hidden = mode !== 'delete';

		const buttons = {
			view: [$copyButton, $editButton, $deleteButton],
			edit: [$saveButton, $cancelButton],
			delete: [$confirmButton, $cancelButton],
		};

		$actions.replaceChildren(...buttons[mode]);
	};

	const setBusy = ($button: HTMLButtonElement, label: string, isBusy: boolean): void => {
		$button.disabled = isBusy;
		$cancelButton.disabled = isBusy;
		$button.textContent = label;
	};

	const handleFailure = (reason: ManageLinkFailure): void => {
		if (reason === 'unauthorized') {
			showFieldErrors([{ field: 'accessCode', message: COPY.unauthorized }]);
			return;
		}

		if (reason === 'not_found') {
			removeLink(hash);
			showLinksNotice(COPY.linkGone);
			$linksTitle.focus();
			return;
		}

		showError(ROW_FAILURE_COPY[reason]);
	};

	const save = async (): Promise<void> => {
		const nextDestination = $editor.value.trim();

		if (!isHttpUrl(nextDestination)) {
			showError(COPY.invalidDestination);
			$editor.focus();
			return;
		}

		const accessCode = readAccessCode();

		if (accessCode === null) {
			return;
		}

		setBusy($saveButton, COPY.saving, true);
		const result = await updateLink(hash, nextDestination, accessCode);
		setBusy($saveButton, COPY.save, false);

		if (!result.ok) {
			handleFailure(result.reason);
			return;
		}

		replaceLink(result.value);
		focusRowAction(hash, 'edit');
	};

	const confirmDelete = async (): Promise<void> => {
		const accessCode = readAccessCode();

		if (accessCode === null) {
			return;
		}

		setBusy($confirmButton, COPY.deleting, true);
		const result = await deleteLink(hash, accessCode);
		setBusy($confirmButton, COPY.delete, false);

		if (!result.ok) {
			handleFailure(result.reason);
			return;
		}

		removeLink(hash);
		$linksTitle.focus();
	};

	$copyButton.addEventListener('click', () => void copyLink($copyButton, $shield));

	$editButton.addEventListener('click', () => {
		clearLinksNotice();
		$editor.value = destination;
		setMode('edit');
		$editor.focus();
		$editor.select();
	});

	$deleteButton.addEventListener('click', () => {
		clearLinksNotice();
		setMode('delete');
		$confirmButton.focus();
	});

	$cancelButton.addEventListener('click', () => {
		const action = $row.dataset.mode === 'edit' ? $editButton : $deleteButton;

		setMode('view');
		action.focus();
	});

	$saveButton.addEventListener('click', () => void save());
	$confirmButton.addEventListener('click', () => void confirmDelete());

	$editor.addEventListener('keydown', (event) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			void save();
		}

		if (event.key === 'Escape') {
			$cancelButton.click();
		}
	});

	$row.append($shield, createArrow(), $destination, $editor, $confirm, $actions, $error);
	setMode('view');

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
	clearLinksNotice();
	links = [link, ...links.filter(({ hash }) => hash !== link.hash)];
	renderLinks();
};

const replaceLink = (link: ShortLink): void => {
	links = links.map((current) => (current.hash === link.hash ? link : current));
	renderLinks();
};

const removeLink = (hash: string): void => {
	links = links.filter((link) => link.hash !== hash);
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
