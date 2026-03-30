/**
 * Sanitizes error messages to prevent leaking internal system details to users.
 * Logs the full error to console for debugging.
 */
export function getSafeErrorMessage(error: any): string {
  const raw = error?.message || error?.error_description || String(error || '');
  
  // Log full error for debugging (dev only)
  console.error('[Debug] Full error:', error);

  const msg = raw.toLowerCase();

  if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials'))
    return 'E-mail ou senha incorretos.';
  if (msg.includes('email not confirmed'))
    return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.';
  if (msg.includes('duplicate key') || msg.includes('unique constraint'))
    return 'Este registro já existe.';
  if (msg.includes('foreign key') || msg.includes('violates'))
    return 'Não é possível executar devido a vínculos com outros dados.';
  if (msg.includes('permission denied') || msg.includes('row-level security') || msg.includes('rls') || msg.includes('policy'))
    return 'Você não tem permissão para esta ação.';
  if (msg.includes('not found') || msg.includes('no rows'))
    return 'Registro não encontrado.';
  if (msg.includes('jwt') || msg.includes('token') || msg.includes('refresh_token'))
    return 'Sessão expirada. Faça login novamente.';
  if (msg.includes('network') || msg.includes('fetch'))
    return 'Erro de conexão. Verifique sua internet.';
  if (msg.includes('timeout'))
    return 'A operação demorou demais. Tente novamente.';

  return 'Ocorreu um erro. Tente novamente.';
}
