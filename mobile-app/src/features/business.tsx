import { createThemedStyles, useBenefyTheme } from '../theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useDeferredValue, useState } from 'react';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';

import { BusinessMark } from '../components/BusinessMark';
import HomeDashboard, { type HomeBusiness } from '../components/HomeDashboard';
import { useAuth } from '../auth/AuthContext';
import {
  useAdquirirCuponMutation,
  useBilleteraQuery,
  useCatalogoQuery,
  useDirectorioQuery,
  useNotificacionesQuery,
  usePerfilQuery,
} from './queries';
import type { NegocioDirectorio } from '../lib/api';
import { ApiError } from '../lib/api';
import { estadoRecompensa } from '../lib/loyalty';
import { Button, Card, Copy, Heading, Notice, Screen, Skeleton, useUiStyles } from './ui';

export function HomeScreen() {
  const { colors } = useBenefyTheme();
  const homeStyles = useHomeStyles();
  const styles = useUiStyles();
  const { user } = useAuth();
  const perfil = usePerfilQuery();
  const billetera = useBilleteraQuery();
  const notificaciones = useNotificacionesQuery();
  const unread = notificaciones.data?.filter(item => !item.leida).length ?? 0;

  const businesses: HomeBusiness[] = [];
  const porNegocio = new Map<number, HomeBusiness>();
  for (const saldo of billetera.data?.saldos ?? []) {
    porNegocio.set(saldo.negocio, {
      id: saldo.negocio,
      nombre: saldo.negocio_nombre || `Negocio #${saldo.negocio}`,
      categoria: 'Programa de lealtad',
      logo_url: saldo.negocio_logo_url,
      puntos: saldo.saldo_actual,
      meta: null,
      sellos: 0,
      listo: false,
    });
  }
  for (const tarjeta of billetera.data?.tarjetas ?? []) {
    const actual = porNegocio.get(tarjeta.negocio);
    if (actual) {
      actual.meta = tarjeta.meta;
      actual.sellos = tarjeta.sellos_actuales;
      actual.listo = tarjeta.sellos_actuales >= tarjeta.meta;
    } else {
      porNegocio.set(tarjeta.negocio, {
        id: tarjeta.negocio,
        nombre: tarjeta.negocio_nombre || `Negocio #${tarjeta.negocio}`,
        categoria: 'Programa de lealtad',
        logo_url: tarjeta.negocio_logo_url,
        puntos: 0,
        meta: tarjeta.meta,
        sellos: tarjeta.sellos_actuales,
        listo: tarjeta.sellos_actuales >= tarjeta.meta,
      });
    }
  }
  businesses.push(...porNegocio.values());
  const totalPuntos = businesses.reduce((total, item) => total + item.puntos, 0);
  const readyRewards = businesses.filter(item => item.listo).length;

  if (perfil.isLoading || billetera.isLoading) {
    return <Screen title="Benefy" tabs><Skeleton /></Screen>;
  }

  if (perfil.isError || billetera.isError) {
    return <Screen title="Benefy" tabs>
      <Notice title="No se pudo cargar tu cuenta" message="Revisa tu conexión e intenta de nuevo."
        retry={() => { void perfil.refetch(); void billetera.refetch(); }} />
    </Screen>;
  }

  return <Screen title="Benefy" tabs headerActions={<>
    <Pressable accessibilityRole="button" accessibilityLabel={`Notificaciones, ${unread} sin leer`}
      onPress={() => router.navigate('/notifications')} style={({ pressed }) => [homeStyles.headerButton, pressed && styles.dim]}>
      <MaterialIcons name="notifications-none" size={22} color={colors.navy} />
      {unread > 0 && <View style={homeStyles.unreadDot} />}
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Historial de movimientos"
      onPress={() => router.navigate('/history')} style={({ pressed }) => [homeStyles.headerButton, pressed && styles.dim]}>
      <MaterialIcons name="history" size={22} color={colors.navy} />
    </Pressable>
  </>} scroll={{
    refreshControl: <RefreshControl refreshing={billetera.isFetching || perfil.isFetching}
      onRefresh={() => { void perfil.refetch(); void billetera.refetch(); void notificaciones.refetch(); }}
      tintColor={colors.green} colors={[colors.green]} progressBackgroundColor={colors.panel} />,
  }}>
    <HomeDashboard
      name={perfil.data?.nombre || user?.email?.split('@')[0] || 'Benefy'}
      points={totalPuntos}
      businesses={businesses}
      readyRewards={readyRewards}
      onBusiness={id => router.push({ pathname: '/business/[id]', params: { id: String(id) } })}
      onDynamics={() => router.push('/dynamics')}
      onCoupons={() => router.push('/coupons')}
      onScan={() => router.navigate('/register')}
      onExplore={() => router.push('/explore')}
    />
  </Screen>;
}

const useHomeStyles = createThemedStyles(colors => StyleSheet.create({
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  unreadDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.mint },
}));

export function ExploreScreen() {
  const { colors } = useBenefyTheme();
  const styles = useUiStyles();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [category, setCategory] = useState<number>();
  const directorio = useDirectorioQuery(deferredQuery.trim(), category);
  const categories = Array.from(new Map(
    directorio.negocios.map(item => [item.categoria.id, item.categoria]),
  ).values());

  return <Screen title="Explorar negocios" subtitle="Descubre comercios activos de Benefy" scroll={{
    refreshControl: <RefreshControl refreshing={directorio.isRefetching}
      onRefresh={() => void directorio.refetch()} tintColor={colors.green} colors={[colors.green]}
      progressBackgroundColor={colors.panel} />,
  }}>
    <TextInput accessibilityLabel="Buscar negocios" placeholder="Buscar por nombre, dirección o sucursal"
      placeholderTextColor={colors.muted} value={query} onChangeText={setQuery}
      style={styles.field} autoCapitalize="none" />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: category === undefined }}
        onPress={() => setCategory(undefined)}
        style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 22,
          backgroundColor: category === undefined ? colors.mint : colors.subtle }}>
        <Text style={{ color: category === undefined ? colors.onMint : colors.navy, fontWeight: '700' }}>Todas</Text>
      </Pressable>
      {categories.map(item => <Pressable key={item.id} accessibilityRole="button"
        accessibilityState={{ selected: category === item.id }} onPress={() => setCategory(item.id)}
        style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 22,
          backgroundColor: category === item.id ? colors.mint : colors.subtle }}>
        <Text style={{ color: category === item.id ? colors.onMint : colors.navy, fontWeight: '700' }}>{item.nombre}</Text>
      </Pressable>)}
    </View>

    {directorio.isLoading && <Skeleton />}
    {directorio.isError && <Notice title="No se pudo cargar el directorio"
      retry={() => void directorio.refetch()} />}
    {!directorio.isLoading && !directorio.isError && directorio.negocios.length === 0 &&
      <Notice title="No encontramos negocios" message="Prueba con otro término o categoría." />}

    {directorio.negocios.map(negocio => <BusinessCard key={negocio.id} negocio={negocio} />)}

    {directorio.cargarMas && <Button label={directorio.isFetchingNextPage ? 'Cargando…' : 'Cargar más negocios'}
      disabled={directorio.isFetchingNextPage} onPress={() => void directorio.cargarMas?.()} />}
    {!directorio.cargarMas && directorio.negocios.length > 0 &&
      <Copy>{directorio.total} negocio{directorio.total === 1 ? '' : 's'} encontrado{directorio.total === 1 ? '' : 's'}</Copy>}
  </Screen>;
}

function BusinessCard({ negocio }: { negocio: NegocioDirectorio }) {
  const styles = useUiStyles();
  return <Pressable accessibilityRole="button" accessibilityHint="Abre el detalle del negocio"
    accessibilityLabel={`${negocio.nombre}, ${negocio.categoria.nombre}`}
    onPress={() => router.push({ pathname: '/business/[id]', params: { id: String(negocio.id) } })}
    style={({ pressed }) => [styles.card, pressed && styles.dim]}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <BusinessMark nombre={negocio.nombre} logoUrl={negocio.logo_url} size={52} />
      <View style={styles.flex}>
        <Heading>{negocio.nombre}</Heading>
        <Copy>{negocio.categoria.nombre}</Copy>
        <Copy>{negocio.direccion}</Copy>
        <Copy>{negocio.sucursales.length} sucursal{negocio.sucursales.length === 1 ? '' : 'es'} activa{negocio.sucursales.length === 1 ? '' : 's'}</Copy>
      </View>
      <MaterialIcons name="chevron-right" size={22} color="#626A71" />
    </View>
    {negocio.descripcion ? <Copy>{negocio.descripcion}</Copy> : null}
  </Pressable>;
}

export function BusinessScreen() {
  const { colors } = useBenefyTheme();
  const styles = useUiStyles();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const negocioId = Number(id);
  const catalogo = useCatalogoQuery(Number.isFinite(negocioId) ? negocioId : undefined);
  const { data } = catalogo;

  if (catalogo.isLoading) return <Screen title="Detalle del negocio"><Skeleton /></Screen>;
  if (catalogo.isError || !data) {
    return <Screen title="Detalle del negocio">
      <Notice title="No se pudo cargar el negocio" retry={() => void catalogo.refetch()} />
    </Screen>;
  }
  const negocio = data.negocio;
  return <Screen title="Detalle del negocio" subtitle={negocio.nombre}>
    <View style={{ backgroundColor: colors.brand, borderRadius: 20, padding: 18, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <BusinessMark nombre={negocio.nombre} logoUrl={negocio.logo_url} size={64} />
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={{ color: colors.onBrand, fontSize: 24, fontWeight: '800' }}>{negocio.nombre}</Text>
          <Text style={{ color: colors.mint }}>{negocio.categoria.nombre}</Text>
        </View>
      </View>
      <Text style={{ color: colors.onBrand }}>{negocio.descripcion}</Text>
      <Text style={{ color: colors.mint }}>{negocio.direccion}</Text>
      {negocio.telefono && <Text style={{ color: colors.mint }}>{negocio.telefono}</Text>}
    </View>
    <Card>
      <Heading>Sucursales activas</Heading>
      {data.sucursales.length === 0 && <Copy>No hay sucursales publicadas.</Copy>}
      {data.sucursales.map(sucursal => <Copy key={sucursal.id}>{sucursal.nombre} · {sucursal.direccion}, {sucursal.ciudad}</Copy>)}
    </Card>
    <Card>
      <Heading>Recompensas disponibles</Heading>
      {data.recompensas.length === 0 && <Copy>Este negocio no tiene recompensas disponibles por ahora.</Copy>}
      {data.recompensas.slice(0, 4).map(recompensa => <Copy key={recompensa.id}>
        {recompensa.titulo} · {recompensa.costo_desbloqueo} pts
      </Copy>)}
      <Button label="Ver tienda de cupones" icon="redeem"
        onPress={() => router.push({ pathname: '/shop/[id]', params: { id: String(negocio.id) } })} />
      <Button label="Beneficios con aliados" kind="quiet" icon="handshake"
        onPress={() => router.push({ pathname: '/business-allies/[id]', params: { id: String(negocio.id) } })} />
      <Button label="Mis cupones de este negocio" kind="quiet" icon="confirmation-number"
        onPress={() => router.push({ pathname: '/business-coupons/[id]', params: { id: String(negocio.id) } })} />
    </Card>
  </Screen>;
}

export function ShopScreen() {
  return <RewardCatalog />;
}

export function BusinessAlliesScreen() {
  return <RewardCatalog alliesOnly />;
}

function RewardCatalog({ alliesOnly = false }: { alliesOnly?: boolean }) {
  const { colors } = useBenefyTheme();
  const styles = useUiStyles();
  const params = useLocalSearchParams<{ id?: string }>();
  const negocioId = Number(params.id);
  const catalogo = useCatalogoQuery(Number.isFinite(negocioId) ? negocioId : undefined);
  const billetera = useBilleteraQuery();
  const puntos = billetera.data?.saldos.find(item => item.negocio === negocioId)?.saldo_actual ?? 0;
  const items = (catalogo.data?.recompensas ?? []).filter(item => !alliesOnly || item.es_alianza);

  if (catalogo.isLoading || billetera.isLoading) return <Screen title="Tienda de cupones"><Skeleton /></Screen>;
  if (catalogo.isError) return <Screen title="Tienda de cupones">
    <Notice title="No se pudo cargar la tienda" retry={() => void catalogo.refetch()} />
  </Screen>;
  const negocio = catalogo.data?.negocio;
  return <Screen title={alliesOnly ? 'Beneficios con aliados' : 'Tienda de cupones'} subtitle={negocio?.nombre}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.brand,
      padding: 16, borderRadius: 18 }}>
      <MaterialIcons name="account-balance-wallet" size={24} color={colors.mint} />
      <View style={styles.flex}>
        <Copy>Saldo disponible</Copy>
        <Text style={{ color: colors.onBrand, fontSize: 26, fontWeight: '800' }}>{puntos} pts</Text>
      </View>
    </View>
    {items.length === 0 && <Notice title={alliesOnly ? 'No hay beneficios de alianza activos' : 'No hay recompensas disponibles'} />}
    {items.map(item => {
      const status = estadoRecompensa(item, puntos);
      const disponible = status === 'Disponible';
      return <Pressable key={item.id} accessibilityRole="button"
        accessibilityLabel={`${item.titulo}, ${item.costo_desbloqueo} puntos, ${status}`}
        onPress={() => router.push({ pathname: '/reward/[id]', params: { id: String(item.id), negocio: String(negocioId) } })}
        style={({ pressed }) => [styles.card, pressed && styles.dim]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <BusinessMark nombre={item.negocio_nombre || negocio?.nombre || 'Benefy'} logoUrl={item.negocio_logo_url} size={44} />
          <View style={styles.flex}>
            <Heading>{item.titulo}</Heading>
            <Copy>{item.descripcion}</Copy>
            {item.es_alianza && <Copy>Beneficio de alianza</Copy>}
          </View>
          <MaterialIcons name="chevron-right" size={22} color={colors.muted} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.navy, fontWeight: '800', fontSize: 17 }}>{item.costo_desbloqueo} pts</Text>
          <Text style={{ color: disponible ? colors.green : colors.muted, backgroundColor: disponible ? colors.positiveSurface : colors.subtle,
            borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, fontWeight: '700', fontSize: 12 }}>{status}</Text>
        </View>
      </Pressable>;
    })}
  </Screen>;
}

export function RewardScreen() {
  const { colors } = useBenefyTheme();
  const params = useLocalSearchParams<{ id?: string; negocio?: string }>();
  const negocioId = Number(params.negocio);
  const rewardId = Number(params.id);
  const catalogo = useCatalogoQuery(Number.isFinite(negocioId) ? negocioId : undefined);
  const billetera = useBilleteraQuery();
  const adquirir = useAdquirirCuponMutation();
  const [error, setError] = useState('');
  const puntos = billetera.data?.saldos.find(item => item.negocio === negocioId)?.saldo_actual ?? 0;
  const reward = catalogo.data?.recompensas.find(item => item.id === rewardId);

  if (catalogo.isLoading) return <Screen title="Detalle de recompensa"><Skeleton /></Screen>;
  if (catalogo.isError || !reward) {
    return <Screen title="Detalle de recompensa">
      <Notice title="Recompensa no disponible" retry={() => void catalogo.refetch()} />
    </Screen>;
  }
  const status = estadoRecompensa(reward, puntos);
  const disponible = status === 'Disponible';

  const confirmar = () => {
    if (!disponible || adquirir.isPending) return;
    Alert.alert(
      'Obtener cupón',
      `Gastarás ${reward.costo_desbloqueo} puntos. Tu saldo quedará en ${Math.max(0, puntos - reward.costo_desbloqueo)}.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => {
          setError('');
          adquirir.mutate(
            { recompensa: reward.id, clave: Crypto.randomUUID() },
            {
              onSuccess: resultado => {
                router.replace({ pathname: '/coupon/[id]', params: { id: resultado.cupon.uuid } });
              },
              onError: err => {
                if (err instanceof ApiError) setError(err.message);
                else setError('No se pudo adquirir el cupón. Intenta de nuevo.');
              },
            },
          );
        } },
      ],
    );
  };

  return <Screen title="Detalle de recompensa" footer={disponible && <View style={{ paddingHorizontal: 16,
    paddingVertical: 10, backgroundColor: colors.panel, borderTopWidth: 1, borderTopColor: colors.line }}>
    <Button label={adquirir.isPending ? 'Adquiriendo…' : `Obtener cupón por ${reward.costo_desbloqueo} pts`}
      icon="redeem" disabled={adquirir.isPending} onPress={confirmar} />
  </View>}>
    <Card>
      <Heading>{reward.titulo}</Heading>
      <Copy>{reward.descripcion}</Copy>
      <Copy>{reward.costo_desbloqueo} puntos · {status}</Copy>
      <Copy>{reward.terminos_condiciones}</Copy>
      {reward.fecha_expiracion && <Copy>Vigente hasta {new Date(reward.fecha_expiracion).toLocaleDateString('es-MX')}</Copy>}
      {reward.negocio_nombre && <Copy>Negocio: {reward.negocio_nombre}</Copy>}
      {reward.es_alianza && <Copy>Beneficio de alianza</Copy>}
      {!disponible && <Copy>Este cupón no está disponible para adquirir en este momento.</Copy>}
      {error !== '' && <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>{error}</Text>}
    </Card>
    <Button label="Volver a la tienda" kind="quiet" onPress={() => router.back()} />
  </Screen>;
}
