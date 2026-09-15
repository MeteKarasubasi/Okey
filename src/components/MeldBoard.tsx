import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View, Text, StyleSheet, PanResponder } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { Meld, Tile, face, isJoker } from '../game/engine';
import { BOARD_ROWS, BOARD_COLUMNS, SECTION_COLUMNS, layoutMelds } from '../game/boardLayout';
import { OkeyTile } from './UI';
import { F } from '../theme';

type MeldDrop = { row: number; column: number };
type PieceProps = { meld: Meld; index: number; indicator: Tile; cellWidth: number; cellHeight: number; slot: { row: number; column: number; length: number }; offset: Animated.ValueXY; enter: Animated.Value; editable: boolean; onMeldPress: (index: number) => void; onMeldDrop?: (index: number, drop: MeldDrop) => void };
function MeldPiece({ meld, index, indicator, cellWidth, cellHeight, slot, offset, enter, editable, onMeldPress, onMeldDrop }: PieceProps) {
  const drag = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const active = useRef(false);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => editable,
    onPanResponderGrant: () => { active.current = true; offset.stopAnimation(); drag.setValue({ x: 0, y: 0 }); },
    onPanResponderMove: (_, gesture) => drag.setValue({ x: gesture.dx, y: gesture.dy }),
    onPanResponderRelease: (_, gesture) => {
      active.current = false;
      const moved = Math.hypot(gesture.dx, gesture.dy) > 6;
      if (!moved) onMeldPress(index);
      else if (onMeldDrop) {
        const centerX = slot.column * cellWidth + slot.length * cellWidth / 2 + gesture.dx;
        const centerY = slot.row * cellHeight + cellHeight / 2 + gesture.dy;
        onMeldDrop(index, { row: Math.max(0, Math.min(12, Math.floor(centerY / cellHeight))), column: Math.max(0, Math.min(25, Math.floor(centerX / cellWidth))) });
      }
      Animated.spring(drag, { toValue: { x: 0, y: 0 }, stiffness: 300, damping: 25, mass: .7, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => { active.current = false; Animated.spring(drag, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start(); },
    onPanResponderTerminationRequest: () => false,
  }), [cellWidth, cellHeight, editable, index, meld, onMeldDrop, onMeldPress, offset, slot]);
  return <Animated.View {...responder.panHandlers} testID={`board-meld-${index}`} accessibilityRole="button" accessibilityLabel={`${meld.tiles.length} taşlı per${editable ? ', sürükleyerek yeniden düzenle' : ''}`} style={{ position: 'absolute', width: slot.length * cellWidth, height: cellHeight, opacity: enter, zIndex: active.current ? 8 : 1, transform: [...offset.getTranslateTransform(), ...drag.getTranslateTransform(), { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-22, 0] }) }, { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [.96, 1] }) }] }}>
    <View style={{ width: slot.length * cellWidth, height: cellHeight }}>
      {meld.tiles.map((tile, tileIndex) => <View key={tile.id} testID={`board-tile-${tile.id}`} style={{ position: 'absolute', left: tileIndex * cellWidth, top: 0, width: cellWidth, height: cellHeight }}><OkeyTile tile={tile} size={cellWidth} height={cellHeight} joker={isJoker(tile, indicator)} /></View>)}
    </View>
  </Animated.View>;
}

export function MeldBoard({ melds, indicator, onMeldPress, editable = false, onMeldDrop }: {
  melds: Meld[]; indicator: Tile; onMeldPress: (index: number) => void; editable?: boolean; onMeldDrop?: (index: number, drop: MeldDrop) => void;
}) {
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const positions = useMemo(() => layoutMelds(melds.map(m => ({ length: m.tiles.length, start: face(m.tiles[0], indicator).value, kind: m.kind }))), [melds, indicator]);
  const cellWidth = bounds.width / BOARD_COLUMNS;
  const cellHeight = bounds.height / BOARD_ROWS;
  const offsets = useRef(new Map<string, Animated.ValueXY>());
  const enters = useRef(new Map<string, Animated.Value>());
  const previousKeys = useRef(new Set<string>());
  useEffect(() => {
    if (!cellWidth || !cellHeight) return;
    const entering: Animated.Value[] = [];
    melds.forEach((meld, index) => {
      const key = meld.tiles.map(tile => tile.id).join('|');
      const target = { x: positions[index].column * cellWidth, y: positions[index].row * cellHeight };
      const offset = offsets.current.get(key);
      if (!offset) offsets.current.set(key, new Animated.ValueXY(target));
      else Animated.spring(offset, { toValue: target, stiffness: 280, damping: 27, mass: .8, useNativeDriver: true }).start();
      const enter = enters.current.get(key);
      if (enter && !previousKeys.current.has(key)) entering.push(enter);
    });
    previousKeys.current = new Set(melds.map(meld => meld.tiles.map(tile => tile.id).join('|')));
    entering.forEach(enter => Animated.spring(enter, { toValue: 1, stiffness: 260, damping: 24, mass: .75, useNativeDriver: true }).start());
  }, [melds, positions, cellWidth, cellHeight]);
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
          const key = meld.tiles.map(t => t.id).join('|');
          const offset = offsets.current.get(key) ?? new Animated.ValueXY({ x: slot.column * cellWidth, y: slot.row * cellHeight });
          offsets.current.set(key, offset);
          let enter = enters.current.get(key);
          if (!enter) { enter = new Animated.Value(0); enters.current.set(key, enter); }
          return <MeldPiece key={key} meld={meld} index={index} indicator={indicator} cellWidth={cellWidth} cellHeight={cellHeight} slot={slot} offset={offset} enter={enter} editable={editable} onMeldPress={onMeldPress} onMeldDrop={onMeldDrop} />;
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
