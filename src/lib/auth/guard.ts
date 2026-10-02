const PUBLIC_PATHS = ['/login'];

export function isPublicPath(pathname: string): boolean {
	return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function safeNext(next: string | null): string {
	if (!next || !next.startsWith('/') || /[\\\u0000-\u001f\u007f]/.test(next)) return '/';
	try {
		const url = new URL(next, 'http://flora.invalid');
		if (url.origin !== 'http://flora.invalid') return '/';
		if (url.pathname.startsWith('//')) return '/';
		if (url.pathname.replace(/\/+$/, '').toLowerCase() === '/logout') return '/';
		return url.pathname + url.search + url.hash;
	} catch {
		return '/';
	}
}
