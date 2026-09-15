import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { Meld, Tile, NAMES, isJoker } from '../game/engine';
import { BOARD_ROWS, BOARD_COLUMNS, SECTION_COLUMNS, layoutMelds } from '../game/boardLayout';
import { OkeyTile } from './UI';
import { F } from '../theme';

export function MeldBoard({ melds, indicator, onMeldPress }: {
  melds: Meld[]; indicator: Tile; onMeldPress: (index: number) => void;
}) {
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const positions = useMemo(() => layoutMelds(melds.map(m => m.tiles.length)), [melds]);
  const cellWidth = bounds.width / BOARD_COLUMNS;
  const cellHeight = bounds.height / BOARD_ROWS;
  return <View style={styles.frame}>
    <View testID="meld-grid" style={styles.surface} onLayout={({ nativeEvent: { layout } }) => {
      setBounds(current => current.width === layout.width && current.height === layout.height
        ? current : { width: layout.width, height: layout.height });
    }}>
      <View pointerEvents="none" style={styles.watermarks}>
        {[0, 1].map(section => <View key={section} style={styles.watermark}><View style={styles.emblem}><Text style={styles.logo}>101</Text><Text style={styles.wordmark}>KEYİF</Text><Text style={styles.caption}>OKEY KULÜBÜ</Text></View></View>)}
      </View>
      {bounds.width > 0 && bounds.height > 0 && <>
        <Svg testID="meld-grid-lines" pointerEvents="none" width={bounds.width} height={bounds.height} style={StyleSheet.absoluteFill}>
          {Array.from({ length: BOARD_COLUMNS + 1 }, (_, col) => <Line key={`col-${col}`} x1={col * cellWidth} x2={col * cellWidth} y1={0} y2={bounds.height} stroke={col === SECTION_COLUMNS ? '#96aab0' : '#1d4861'} strokeWidth={col === SECTION_COLUMNS ? 1.5 : 1} />)}
          {Array.from({ length: BOARD_ROWS + 1 }, (_, row) => <Line key={`row-${row}`} x1={0} x2={bounds.width} y1={row * cellHeight} y2={row * cellHeight} stroke="#1d4861" strokeWidth={1} />)}
        </Svg>
        {melds.map((meld, index) => {
          const slot = positions[index];
          return <Pressable key={meld.tiles.map(t => t.id).join('|')} testID={`board-meld-${index}`} accessibilityRole="button" accessibilityLabel={`${NAMES[meld.owner]} perine taşı işle`} onPress={() => onMeldPress(index)} style={{ position: 'absolute', left: slot.column * cellWidth, top: slot.row * cellHeight, width: slot.length * cellWidth, height: cellHeight }}>
            {meld.tiles.map((tile, tileIndex) => <View key={tile.id} testID={`board-tile-${tile.id}`} style={{ position: 'absolute', left: tileIndex * cellWidth, top: 0, width: cellWidth, height: cellHeight }}>
              <OkeyTile tile={tile} size={cellWidth} height={cellHeight} joker={isJoker(tile, indicator)} />
            </View>)}
          </Pressable>;
        })}
      </>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  frame: { flex: 1, minWidth: 0, minHeight: 0, borderRadius: 7, borderWidth: 2, borderColor: '#123e52', overflow: 'hidden', backgroundColor: '#082d40' },
  surface: { flex: 1, position: 'relative', overflow: 'hidden' },
  watermarks: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row' },
  watermark: { flex: 1, alignItems: 'center', justifyContent: 'center', opacity: .10 },
  emblem: { width: 245, height: 211, borderWidth: 4, borderColor: '#93b5c7', borderRadius: 52, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] },
  logo: { color: '#93b5c7', fontFamily: F.extra, fontSize: 94, lineHeight: 104, letterSpacing: -7 },
  wordmark: { width: 276, textAlign: 'center', color: '#082d40', backgroundColor: '#93b5c7', fontFamily: F.extra, fontSize: 38, letterSpacing: 10 },
  caption: { color: '#93b5c7', fontFamily: F.bold, fontSize: 11, letterSpacing: 3, marginTop: 10 },
});
