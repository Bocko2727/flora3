import { z } from 'zod';

const publicEnvSchema = z.object({
	PUBLIC_SUPABASE_URL: z.url(),
	PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20)
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
	const result = publicEnvSchema.safeParse(source);
	if (!result.success) {
		const names = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
		throw new Error(
			`Липсваща или невалидна конфигурация: ${names.join(', ')}. Провери .env (виж .env.example).`
		);
	}
	return result.data;
}
