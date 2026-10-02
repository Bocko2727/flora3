export class UserFacingError extends Error {
	/** Diagnostic payload for server logs. Non-enumerable so it is ignored by error equality and serialization. */
	declare readonly detail?: unknown;

	constructor(message: string, detail?: unknown) {
		super(message);
		this.name = 'UserFacingError';
		Object.defineProperty(this, 'detail', { value: detail, enumerable: false });
	}
}

export function describeDbError(
	error: { code?: string } | null | undefined,
	fallback: string
): string {
	switch (error?.code) {
		case '42501':
			return 'Нямаш права за това действие.';
		case '23505':
			return 'Такъв запис вече съществува.';
		case '23503':
			return 'Записът е свързан с други данни и не може да бъде изтрит.';
		case '23514':
			return 'Някое поле има невалидна стойност.';
		default:
			return fallback;
	}
}
