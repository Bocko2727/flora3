export type LoginError = { code?: string; status?: number };

/** Maps a Supabase sign-in error to a user-facing message. Only a genuine credentials error says "wrong password". */
export function loginErrorMessage(error: LoginError | null): string {
	if (!error) return '';
	switch (error.code) {
		case 'invalid_credentials':
			return 'Грешен имейл или парола.';
		case 'email_not_confirmed':
			return 'Профилът не е потвърден. Потвърди потребителя в Supabase (Auto Confirm).';
		case 'email_provider_disabled':
			return 'Входът с имейл е изключен в Supabase.';
	}
	if (error.status === 429) return 'Твърде много опити. Изчакай малко и опитай пак.';
	return 'Услугата за вход не отговаря. Опитай пак след малко.';
}
