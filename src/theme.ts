import { Platform } from 'react-native';
export const C = {
  bg: '#102e29', sidebar: '#0d2723', panel: '#193932', panelLight: '#204138',
  border: '#335149', text: '#f8f3e7', muted: '#a4b9ab', gold: '#e8bd73',
  green: '#c1d9a0', ink: '#18332a', red: '#b74637', blue: '#366e95', yellow: '#c19331',
};
export const F = { regular: 'Manrope_400Regular', medium: 'Manrope_500Medium', bold: 'Manrope_700Bold', extra: 'Manrope_800ExtraBold', serif: 'Fraunces_600SemiBold', italic: 'Fraunces_500Medium_Italic' };
export const elevation = (height = 8, opacity = 0.2) => Platform.select({
  web: { boxShadow: `0 ${height}px ${height * 3}px rgba(0,0,0,${opacity})` },
  default: { shadowColor: '#000', shadowOffset: { width: 0, height }, shadowOpacity: opacity, shadowRadius: height * 2, elevation: height },
})!;
