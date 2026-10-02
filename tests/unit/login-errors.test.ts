import { describe, expect, it } from 'vitest';
import { loginErrorMessage } from '$lib/auth/login-errors';

describe('loginErrorMessage', () => {
	it('maps invalid_credentials to the wrong-credentials message', () => {
		expect(loginErrorMessage({ code: 'invalid_credentials', status: 400 })).toBe('Грешен имейл или парола.');
	});

	it('does not call a bare 400 a wrong password', () => {
		expect(loginErrorMessage({ status: 400 })).toBe('Услугата за вход не отговаря. Опитай пак след малко.');
	});

	it('explains an unconfirmed profile', () => {
		expect(loginErrorMessage({ code: 'email_not_confirmed', status: 400 })).toBe(
			'Профилът не е потвърден. Потвърди потребителя в Supabase (Auto Confirm).'
		);
	});

	it('explains a disabled email provider', () => {
		expect(loginErrorMessage({ code: 'email_provider_disabled', status: 422 })).toBe('Входът с имейл е изключен в Supabase.');
	});

	it('keeps the rate-limit message for 429', () => {
		expect(loginErrorMessage({ code: 'over_request_rate_limit', status: 429 })).toBe('Твърде много опити. Изчакай малко и опитай пак.');
	});

	it('falls back to the service message for anything else', () => {
		expect(loginErrorMessage({ status: 500 })).toBe('Услугата за вход не отговаря. Опитай пак след малко.');
		expect(loginErrorMessage({})).toBe('Услугата за вход не отговаря. Опитай пак след малко.');
	});

	it('returns an empty string when there is no error', () => {
		expect(loginErrorMessage(null)).toBe('');
	});
});
