export type ShortLink = {
	hash: string;
	shortUrl: string;
	destination: string;
};

export type LinksResponse = {
	links: ShortLink[];
};

export type CreateLinkRequest = {
	destination: string;
	hash: string;
	accessCode: string;
};

export type CreateLinkResponse = ShortLink;

export type UpdateLinkResponse = ShortLink;

export type ApiErrorCode = 'hash_taken' | 'unauthorized' | 'invalid_destination' | 'invalid_hash' | 'not_found';

export type ApiError = {
	error: ApiErrorCode;
};

export type CreateLinkErrorCode = Exclude<ApiErrorCode, 'not_found'>;

export type ManageLinkFailure = 'unauthorized' | 'not_found' | 'invalid_destination' | 'network' | 'unknown';

export type ManageLinkResult<T> = { ok: true; value: T } | { ok: false; reason: ManageLinkFailure };

export type FieldName = 'destination' | 'hash' | 'accessCode';

export type FieldError = {
	field: FieldName;
	message: string;
};

export type CreateLinkResult = { ok: true; link: CreateLinkResponse } | { ok: false; fieldError: FieldError } | { ok: false; formError: string };
