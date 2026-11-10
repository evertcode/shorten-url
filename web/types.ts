export type ShortLink = {
	hash: string;
};

export type LinksResponse = {
	links: ShortLink[];
};

export type CreateLinkRequest = {
	destination: string;
	hash: string;
	accessCode: string;
};

export type CreateLinkResponse = {
	hash: string;
	shortUrl: string;
	destination: string;
};

export type CreateLinkErrorCode = 'hash_taken' | 'unauthorized' | 'invalid_destination' | 'invalid_hash';

export type CreateLinkError = {
	error: CreateLinkErrorCode;
};

export type FieldName = 'destination' | 'hash' | 'accessCode';

export type FieldError = {
	field: FieldName;
	message: string;
};

export type CreateLinkResult = { ok: true; link: CreateLinkResponse } | { ok: false; fieldError: FieldError } | { ok: false; formError: string };
