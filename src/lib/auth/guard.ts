const PUBLIC_PATHS = ['/login'];

export function isPublicPath(pathname: string): boolean {
	return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function safeNext(next: string | null): string {
	if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
		return '/';
	}
	return next;
}
