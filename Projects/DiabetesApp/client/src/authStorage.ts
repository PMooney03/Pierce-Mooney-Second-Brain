/** Separate keys so prod Tailscale sessions do not collide with the local dev database */
export const AUTH_TOKEN_KEY = import.meta.env.DEV ? 'auth_token_dev' : 'auth_token';
