import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useAuth } from '../auth/AuthContext';
import { queryKeys as keys } from '../lib/queryKeys';
import {
  actualizarPerfil,
  adquirirCupon,
  canjearCupon,
  getBilletera,
  getCatalogo,
  getDirectorio,
  getHistorial,
  getMisCupones,
  getNotificaciones,
  marcarNotificacionLeida,
  type CanjeResultado,
  type Notificacion,
  type Perfil,
  type PerfilActualizable,
} from '../lib/api';
import { cargarPerfil } from '../lib/profile';

function useToken() {
  const { session } = useAuth();
  return {
    token: session?.access_token,
    userId: session?.user.id,
    user: session?.user,
  };
}

export function usePerfilQuery() {
  const { token, userId, user } = useToken();
  return useQuery({
    queryKey: keys.perfil(userId),
    queryFn: () => cargarPerfil(
      token as string,
      user?.user_metadata as Record<string, unknown> | undefined,
      user?.email ?? '',
    ),
    enabled: !!token && !!user,
  });
}

export function useBilleteraQuery() {
  const { token, userId } = useToken();
  return useQuery({
    queryKey: keys.billetera(userId),
    queryFn: () => getBilletera(token as string),
    enabled: !!token,
  });
}

export function useHistorialQuery() {
  const { token, userId } = useToken();
  return useQuery({
    queryKey: keys.historial(userId),
    queryFn: () => getHistorial(token as string),
    enabled: !!token,
  });
}

export function useCuponesQuery() {
  const { token, userId } = useToken();
  return useQuery({
    queryKey: keys.cupones(userId),
    queryFn: () => getMisCupones(token as string),
    enabled: !!token,
  });
}

export function useNotificacionesQuery() {
  const { token, userId } = useToken();
  return useQuery({
    queryKey: keys.notificaciones(userId),
    queryFn: () => getNotificaciones(token as string),
    enabled: !!token,
  });
}

export function useCatalogoQuery(negocioId?: number) {
  const { token } = useToken();
  return useQuery({
    queryKey: keys.catalogo(negocioId ?? 0),
    queryFn: () => getCatalogo(negocioId as number, token as string),
    enabled: !!token && !!negocioId,
  });
}

export function useDirectorioQuery(q: string, categoria?: number) {
  const { token, userId } = useToken();
  const query = useInfiniteQuery({
    queryKey: [...keys.directorio(q, categoria), userId],
    queryFn: ({ pageParam }) => getDirectorio(token as string, {
      q,
      categoria,
      page: pageParam,
      pageSize: 12,
    }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => lastPage.next ? pages.length + 1 : undefined,
    enabled: !!token,
    placeholderData: keepPreviousData,
  });
  return {
    ...query,
    negocios: query.data?.pages.flatMap(page => page.results) ?? [],
    total: query.data?.pages[0]?.count ?? 0,
    cargarMas: query.hasNextPage ? query.fetchNextPage : undefined,
  };
}

export function useActualizarPerfilMutation() {
  const { token, userId } = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PerfilActualizable) => actualizarPerfil(payload, token as string),
    onSuccess: (perfil: Perfil) => {
      queryClient.setQueryData(keys.perfil(userId), perfil);
    },
  });
}

export function useAdquirirCuponMutation() {
  const { token, userId } = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recompensa, clave }: { recompensa: number; clave: string }) =>
      adquirirCupon(recompensa, clave, token as string),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.billetera(userId) });
      void queryClient.invalidateQueries({ queryKey: keys.cupones(userId) });
      void queryClient.invalidateQueries({ queryKey: ['catalogo'] });
    },
  });
}

export function useCanjearCuponMutation() {
  const { token, userId } = useToken();
  const queryClient = useQueryClient();
  return useMutation<CanjeResultado, Error, string>({
    mutationFn: (uuid) => canjearCupon(uuid, token as string),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.billetera(userId) });
      void queryClient.invalidateQueries({ queryKey: keys.cupones(userId) });
      void queryClient.invalidateQueries({ queryKey: keys.historial(userId) });
      void queryClient.invalidateQueries({ queryKey: keys.notificaciones(userId) });
    },
  });
}

export function useMarcarNotificacionMutation() {
  const { token, userId } = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => marcarNotificacionLeida(id, token as string),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: keys.notificaciones(userId) });
      const previous = queryClient.getQueryData<Notificacion[]>(keys.notificaciones(userId));
      queryClient.setQueryData<Notificacion[]>(
        keys.notificaciones(userId),
        (items) => items?.map(item => item.id === id ? { ...item, leida: true } : item),
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(keys.notificaciones(userId), context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: keys.notificaciones(userId) });
    },
  });
}

export function useMarcarTodasNotificacionesMutation() {
  const { token, userId } = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => Promise.all(
      ids.map(id => marcarNotificacionLeida(id, token as string)),
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.notificaciones(userId) });
    },
  });
}

export function useRefrescarTrasVisita() {
  const { userId } = useToken();
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: keys.billetera(userId) });
    void queryClient.invalidateQueries({ queryKey: keys.cupones(userId) });
    void queryClient.invalidateQueries({ queryKey: keys.historial(userId) });
    void queryClient.invalidateQueries({ queryKey: keys.notificaciones(userId) });
  };
}
