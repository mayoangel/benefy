import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { toQR } from 'toqr';

export function DisplayQr({ value, label, maxSize = 220 }: { value: string; label: string; maxSize?: number }) {
  const matrix = useMemo(() => toQR(Uint8Array.from(value, character => character.charCodeAt(0))), [value]);
  const width = Math.sqrt(matrix.length);
  const moduleSize = Math.max(1, Math.floor(maxSize / (width + 8)));
  const cell = { width: moduleSize, height: moduleSize };
  return <View accessible accessibilityLabel={label} style={[styles.code, { padding: moduleSize * 4 }]}>
    {Array.from({ length: width }, (_, row) => <View key={row} style={styles.row}>
      {Array.from(matrix.subarray(row * width, (row + 1) * width), (dark, column) =>
        <View key={column} style={[cell, dark === 1 && styles.dark]} />)}
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  code: { alignSelf: 'center', backgroundColor: '#FFFFFF' },
  row: { flexDirection: 'row' },
  dark: { backgroundColor: '#000000' },
});
