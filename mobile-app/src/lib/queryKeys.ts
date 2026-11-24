export const queryKeys = {
  perfil: (userId?: string) => ['perfil', userId] as const,
  billetera: (userId?: string) => ['billetera', userId] as const,
  historial: (userId?: string) => ['historial', userId] as const,
  cupones: (userId?: string) => ['cupones', userId] as const,
  notificaciones: (userId?: string) => ['notificaciones', userId] as const,
  catalogo: (negocioId: number) => ['catalogo', negocioId] as const,
  directorio: (q: string, categoria?: number) => ['directorio', q, categoria] as const,
};
