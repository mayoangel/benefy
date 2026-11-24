import { Image, Text, View } from 'react-native';

export function BusinessMark({
  nombre,
  logoUrl,
  size = 48,
}: {
  nombre: string;
  logoUrl?: string | null;
  size?: number;
}) {
  const style = { width: size, height: size, borderRadius: 12, overflow: 'hidden' as const };
  return <View style={[style, { backgroundColor: '#E8F4EE', alignItems: 'center', justifyContent: 'center' }]}>
    <Text style={{ color: '#006C4B', fontSize: size * 0.4, fontWeight: '800' }}>
      {nombre.trim().slice(0, 1).toUpperCase() || 'B'}
    </Text>
    {logoUrl && <Image source={{ uri: logoUrl }} style={{ position: 'absolute', width: size, height: size }} />}
  </View>;
}
