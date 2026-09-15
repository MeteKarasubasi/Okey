import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { OkeyTile, Coin } from './UI';
import { F, elevation } from '../theme';

export function Grain({ color = '#e2dec1', wood = false }: { color?: string; wood?: boolean }) {
  return <View pointerEvents="none" style={{ position: 'absolute', inset: 0, overflow: 'hidden', opacity: wood ? .13 : .045 }}><Svg width="100%" height="100%" viewBox="0 0 500 300" preserveAspectRatio="none">{Array.from({ length: wood ? 30 : 70 }, (_, i) => <Path key={i} d={wood ? `M-10 ${i * 11} Q120 ${i * 11 - 18} 280 ${i * 11 + 4} T510 ${i * 11 - 6}` : `M${i * 12 - 300} 0L${i * 12 + 80} 300`} stroke={color} strokeWidth={wood ? .7 : .5} fill="none" />)}</Svg></View>;
}
export default function TableArt({ scale = 1, compact = false, tone = 'green' }: { scale?: number; compact?: boolean; tone?: 'green' | 'blue' | 'plum' }) {
  const colors: [string, string] = tone === 'blue' ? ['#456576', '#233f50'] : tone === 'plum' ? ['#75566e', '#493343'] : ['#4a7458', '#284e3b'];
  return <View pointerEvents="none" style={{ width: 440 * scale, height: 320 * scale, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: 440, height: 320, transform: [{ scale }], position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
      <LinearGradient colors={['#a77a52', '#553725', '#845936']} style={{ width: 380, height: 245, borderRadius: 56, padding: 15, transform: [{ perspective: 900 }, { rotateX: '33deg' }, { rotateZ: '-13deg' }], borderWidth: 1, borderColor: '#b28d62', borderBottomWidth: 10, borderBottomColor: '#442d20', ...elevation(20, .4) }}>
        <Grain wood />
        <LinearGradient colors={colors} style={{ flex: 1, borderRadius: 40, borderWidth: 3, borderColor: '#253d2c', alignItems: 'center', justifyContent: 'center' }}>
          <Grain />
          <View style={{ position: 'absolute', inset: 10, borderRadius: 29, borderWidth: 1, borderColor: '#c4d3aa2b' }} />
          <Text style={{ fontFamily: F.serif, color: '#dbe2bd30', fontSize: 36, transform: [{ translateY: -35 }] }}>keyif.</Text>
          <View style={{ position: 'absolute', right: 42, top: 36, transform: [{ rotate: '16deg' }] }}><OkeyTile size={30} back /><View style={{ position: 'absolute', top: -7, left: -4 }}><OkeyTile size={30} back /></View></View>
          <View style={{ position: 'absolute', left: 46, top: 42, transform: [{ rotate: '-9deg' }] }}><OkeyTile size={29} tile={{ value: 7, color: 'blue' }} /></View>
        </LinearGradient>
      </LinearGradient>
      <View style={{ position: 'absolute', top: 115, left: 89, transform: [{ rotate: '-10deg' }], flexDirection: 'row', gap: 6 }}>
        {[10, 11, 12].map((value, i) => <View key={value} style={{ transform: [{ rotate: `${(i - 1) * 5}deg` }], marginTop: i === 1 ? -10 : 0 }}><OkeyTile size={64} tile={{ value, color: 'red' }} /></View>)}
      </View>
      <LinearGradient colors={['#b68b5b', '#77502f', '#a07346']} style={{ position: 'absolute', width: 264, height: 23, top: 218, left: 87, borderRadius: 5, transform: [{ rotate: '-10deg' }], borderWidth: 1, borderColor: '#c3986c', borderBottomWidth: 5, borderBottomColor: '#543922', ...elevation(8, .3) }}><Grain wood /></LinearGradient>
      {!compact && <><View style={{ position: 'absolute', right: 17, top: 215, transform: [{ rotate: '-15deg' }] }}><Coin size={42} /><View style={{ position: 'absolute', top: -7, left: 1 }}><Coin size={42} /></View><View style={{ position: 'absolute', top: -14, left: -1 }}><Coin size={42} /></View></View><View style={{ position: 'absolute', top: 63, left: 20, transform: [{ rotate: '-23deg' }] }}><OkeyTile size={47} tile={{ value: 1, color: 'black', fake: true }} /></View></>}
    </View>
  </View>;
}
