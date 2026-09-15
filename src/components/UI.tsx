import React, { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowUpRight, ChevronRight, Sparkles, Star } from 'lucide-react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { C, F, elevation } from '../theme';
import { Tile, COLOR_NAMES } from '../game/engine';

export function Label({ children, color = C.muted, style }: { children: ReactNode; color?: string; style?: StyleProp<any> }) {
  return <Text style={[{ fontFamily: F.bold, fontSize: 10, letterSpacing: 1.8, color }, style]}>{children}</Text>;
}
export function Button({ children, onPress, secondary, icon, disabled, style, compact, testID }: { children: ReactNode; onPress: () => void; secondary?: boolean; icon?: ReactNode; disabled?: boolean; style?: StyleProp<ViewStyle>; compact?: boolean; testID?: string }) {
  return <Pressable testID={testID} accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [s.button, secondary ? s.secondary : s.primary, compact && { minHeight: 44, paddingHorizontal: 16 }, disabled && { opacity: 0.4 }, hovered && !disabled && { opacity: 0.9 }, pressed && { transform: [{ scale: 0.98 }] }, style]}>
    {icon}<Text style={{ fontFamily: F.extra, fontSize: compact ? 12 : 14, color: secondary ? C.text : C.ink }}>{children}</Text>
  </Pressable>;
}
export function IconButton({ icon, label, onPress, style }: { icon: ReactNode; label: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [s.iconButton, hovered && { backgroundColor: C.panelLight }, pressed && { opacity: 0.6 }, style]}>{icon}</Pressable>;
}
export function Avatar({ person = 0, size = 42, active = false }: { person?: number; size?: number; active?: boolean }) {
  const bg = ['#c6d7b2', '#dbc2aa', '#b6c7cc', '#bdc0db'][person % 4];
  const shirts = ['#3d6353', '#954f3c', '#384e69', '#746187'];
  return <View style={{ width: size, height: size, borderRadius: size / 2, padding: 3, borderWidth: active ? 2 : 1, borderColor: active ? C.gold : '#ffffff25', backgroundColor: C.sidebar }}>
    <Svg width="100%" height="100%" viewBox="0 0 64 64">
      <Circle cx="32" cy="32" r="32" fill={bg} />
      {person % 2 === 1 && <Path d="M15 38V24C15 3 50 4 50 26L50 48H15Z" fill="#49362d" />}
      <Path d="M7 64C7 47 18 44 27 44H38C48 44 58 50 59 64Z" fill={shirts[person % 4]} />
      <Path d="M25 37V47Q32 54 39 47V37" fill="#bc8c6c" />
      <Path d="M18 24C18 8 46 9 46 26L44 37Q32 53 21 37Z" fill="#e0b18c" />
      <Path d={person % 2 === 0 ? 'M17 27C10 5 49 5 48 25L40 22 37 16 29 23Z' : 'M17 30C12 4 48 5 48 28L43 23 39 14 31 20 20 23Z'} fill={person === 2 ? '#473d38' : '#4e3529'} />
      <Circle cx="26" cy="29" r="1.3" fill="#44332b" /><Circle cx="39" cy="29" r="1.3" fill="#44332b" />
      <Path d="M29 37Q33 40 37 36" fill="none" stroke="#a76651" strokeWidth="1.5" strokeLinecap="round" />
      {person === 0 && <Path d="M20 31L24 41Q33 49 43 37L44 30 39 36 34 38 26 35Z" fill="#614334" opacity="0.9" />}
    </Svg>
  </View>;
}
export function OkeyTile({ tile, size = 44, height, selected, onPress, back, joker, tiny }: {
  tile?: Partial<Tile>; size?: number; height?: number; selected?: boolean; onPress?: () => void; back?: boolean; joker?: boolean; tiny?: boolean;
}) {
  const color = tile?.color === 'red' ? '#c52e38' : tile?.color === 'blue' ? '#008fb8' : tile?.color === 'yellow' ? '#d4a618' : '#172532';
  const tileHeight = height ?? size * 1.34;
  const content = <LinearGradient colors={back ? ['#f8faf6', '#d5dcde'] : ['#fffef8', '#f0f0eb', '#d5d6d0']} locations={back ? undefined : [0, .58, 1]}
    style={[s.tile, { width: size, height: tileHeight, borderRadius: size * .065, borderWidth: Math.max(1, size * .018), borderColor: selected ? C.gold : '#aeb4b4', borderBottomWidth: Math.max(2, size * .055), overflow: 'hidden' }]}>
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '42%', backgroundColor: '#ffffff5c', borderTopWidth: 1, borderColor: '#fff' }} />
    {back ? <Text style={{ fontFamily: F.serif, fontSize: size * .33, color: '#bdc6c9' }}>k.</Text> :
      <Text style={{ position: 'absolute', top: tileHeight * .025, width: '100%', textAlign: 'center', fontFamily: F.extra, fontSize: size * .74, lineHeight: size * .94, color, textShadowColor: '#00000024', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 }}>{tile?.fake ? '✦' : tile?.value ?? 1}</Text>}
    <LinearGradient colors={['#bfc2c0', '#edf0ed']} style={{ position: 'absolute', bottom: tileHeight * .085, width: size * .28, height: size * .28, borderRadius: size, borderWidth: 1, borderColor: '#d5d8d3', alignItems: 'center', justifyContent: 'center' }}>
      {joker && <Star size={size * .19} color="#b32c33" />}
    </LinearGradient>
  </LinearGradient>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={tile?.fake ? 'Sahte okey' : `${COLOR_NAMES[tile?.color ?? 'black']} ${tile?.value}`} accessibilityState={{ selected }} onPress={onPress} style={{ paddingVertical: tiny ? 0 : 5 }}>{content}</Pressable> : content;
}
export function Coin({ size = 26 }: { size?: number }) {
  return <LinearGradient colors={['#ffe4a2', '#d3a047', '#b48030']} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: '#edcb7e', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, ...elevation(3) }}><View style={{ width: size * .68, height: size * .68, borderWidth: 1, borderColor: '#a67732', borderRadius: size }}><Text style={{ textAlign: 'center', fontFamily: F.serif, fontSize: size * .47, color: '#93682e', lineHeight: size * .6 }}>k</Text></View></LinearGradient>;
}
export function Logo({ small }: { small?: boolean }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ flexDirection: 'row', transform: [{ rotate: '-9deg' }] }}><OkeyTile size={small ? 22 : 28} tile={{ value: 1, color: 'red' }} /><View style={{ marginLeft: -7, marginTop: 4, transform: [{ rotate: '18deg' }] }}><OkeyTile size={small ? 22 : 28} tile={{ value: 1, color: 'black' }} /></View></View><View><Text style={{ fontFamily: F.serif, color: C.text, fontSize: small ? 28 : 34, letterSpacing: -1.4, lineHeight: small ? 30 : 38 }}>keyif<Text style={{ color: C.gold }}>.</Text></Text><Label style={{ fontSize: 8, letterSpacing: 3.2 }}>101 OKEY</Label></View></View>;
}
export function SectionTitle({ title, subtitle, action, onPress }: { title: string; subtitle?: string; action?: string; onPress?: () => void }) {
  return <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 10 }}><View style={{ flex: 1 }}><Text style={{ fontFamily: F.bold, color: C.text, fontSize: 21, letterSpacing: -.6 }}>{title}</Text>{subtitle && <Text style={{ fontFamily: F.regular, color: C.muted, fontSize: 12, marginTop: 6 }}>{subtitle}</Text>}</View>{action && <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 }}><Text style={{ color: C.green, fontFamily: F.bold, fontSize: 11 }}>{action}</Text><ChevronRight size={15} color={C.green} /></Pressable>}</View>;
}
const s = StyleSheet.create({
  button: { minHeight: 54, paddingHorizontal: 23, borderRadius: 12, flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  primary: { backgroundColor: C.green, borderColor: '#d9e7b9', borderBottomWidth: 3, borderBottomColor: '#8baa6d', ...elevation(6, .14) },
  secondary: { backgroundColor: '#ffffff05', borderColor: '#ffffff25' },
  iconButton: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ffffff16' },
  tile: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, gap: 5, ...elevation(3, .18) },
});
