import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Tile, COLOR_NAMES, isJoker } from '../game/engine';
import { DISCARD, inside, Point, RACK, rackTarget, RackSlots, slotPosition } from '../game/rackLayout';
import { OkeyTile } from './UI';
import { F } from '../theme';

type Drop = { position: Point; discard?: boolean; slot?: number };
type PieceProps = {
  tile: Tile; slot: number; scale: number; selected: boolean; indicator: Tile; disabled: boolean; reducedMotion: boolean;
  onSelect: () => void; onStart: () => void; onMove: (point: Point) => void;
  onDrop: (point: Point) => Drop; onFinish: (drop?: Drop) => void;
};
function RackPiece(props: PieceProps) {
  const latest = useRef(props); latest.current = props;
  const initial = slotPosition(props.slot);
  const position = useRef(new Animated.ValueXY(initial)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const shrink = useRef(new Animated.Value(1)).current;
  const [held, setHeld] = useState(false);
  const active = useRef(false), settling = useRef(false), origin = useRef(initial);
  const animateTo = (point: Point, done?: () => void, destinationScale = 1) => {
    if (latest.current.reducedMotion) { position.setValue(point); lift.setValue(0); shrink.setValue(destinationScale); done?.(); return; }
    Animated.parallel([
      Animated.spring(position, { toValue: point, stiffness: 320, damping: 30, mass: .7, useNativeDriver: true }),
      Animated.timing(lift, { toValue: 0, duration: latest.current.reducedMotion ? 0 : 150, useNativeDriver: true }),
      Animated.timing(shrink, { toValue: destinationScale, duration: 190, useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) done?.(); });
  };
  useEffect(() => {
    if (active.current || settling.current) return;
    const point = slotPosition(props.slot);
    if (props.reducedMotion) position.setValue(point); else animateTo(point);
  }, [props.slot, props.reducedMotion]);
  useEffect(() => () => { position.stopAnimation(); lift.stopAnimation(); shrink.stopAnimation(); }, []);
  // Keep a single responder for the whole gesture, even when the game or hover state changes.
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !latest.current.disabled && !settling.current,
    onPanResponderGrant: () => {
      position.stopAnimation(); lift.stopAnimation(); shrink.setValue(1);
      origin.current = slotPosition(latest.current.slot);
      position.setValue(origin.current); active.current = true; setHeld(true);
      if (latest.current.reducedMotion) lift.setValue(1);
      else Animated.spring(lift, { toValue: 1, stiffness: 400, damping: 25, useNativeDriver: true }).start();
      latest.current.onStart();
    },
    onPanResponderMove: (_, gesture) => {
      const point = { x: origin.current.x + gesture.dx / latest.current.scale, y: origin.current.y + gesture.dy / latest.current.scale };
      position.setValue(point);
      latest.current.onMove({ x: point.x + RACK.tileWidth / 2, y: point.y + RACK.tileHeight / 2 });
    },
    onPanResponderRelease: (_, gesture) => {
      active.current = false; settling.current = true;
      const moved = Math.hypot(gesture.dx, gesture.dy) > 4;
      const point = { x: origin.current.x + gesture.dx / latest.current.scale + RACK.tileWidth / 2, y: origin.current.y + gesture.dy / latest.current.scale + RACK.tileHeight / 2 };
      const drop = moved ? latest.current.onDrop(point) : { position: origin.current };
      if (!moved) latest.current.onSelect();
      animateTo(drop.position, () => { settling.current = false; setHeld(false); latest.current.onFinish(moved ? drop : undefined); }, drop.discard ? 65 / RACK.tileWidth : 1);
    },
    onPanResponderTerminate: () => {
      active.current = false; settling.current = true;
      animateTo(origin.current, () => { settling.current = false; setHeld(false); latest.current.onFinish(); });
    },
    onPanResponderTerminationRequest: () => false,
  }), []);
  return <Animated.View {...responder.panHandlers} testID={`rack-tile-${props.tile.id}`} accessibilityRole="button"
    accessibilityLabel={`${COLOR_NAMES[props.tile.color]} ${props.tile.fake ? 'sahte okey' : props.tile.value}`} accessibilityState={{ selected: props.selected }}
    onAccessibilityTap={props.onSelect}
    style={[styles.piece, { zIndex: held ? 100 : 2, elevation: held ? 30 : 3, transform: [...position.getTranslateTransform(),
      { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [props.selected ? -7 : 0, -24] }) },
      { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
      { scale: shrink },
      { rotate: lift.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-3deg'] }) }] },
      Platform.OS === 'web' && { cursor: held ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none' } as any,
      held && styles.floating]}>
    <View pointerEvents="none"><OkeyTile tile={props.tile} size={RACK.tileWidth} height={RACK.tileHeight} joker={isJoker(props.tile, props.indicator)} /></View>
  </Animated.View>;
}

export function TileRack({ hand, slots, scale, selected, indicator, disabled, reducedMotion, canDiscard, onSelect, onStart, onHoverDiscard, onMoveSlot, onDiscard }: {
  hand: Tile[]; slots: RackSlots; scale: number; selected: string | null; indicator: Tile; disabled: boolean; reducedMotion: boolean; canDiscard: boolean;
  onSelect: (id: string) => void; onStart: () => void; onHoverDiscard: (hover: boolean) => void;
  onMoveSlot: (id: string, slot: number) => void; onDiscard: (id: string) => void;
}) {
  const [active, setActive] = useState<string | null>(null), [hover, setHover] = useState<number | null>(null);
  const discardHit = (point: Point) => canDiscard && inside({ x: point.x + RACK.x, y: point.y + RACK.y }, DISCARD);
  return <View testID="tile-rack" style={styles.rack}>
    <LinearGradient colors={['#f5b62b', '#b96e09', '#d99416', '#91500a']} locations={[0, .47, .53, 1]} style={styles.wood} />
    <Svg pointerEvents="none" width={RACK.width} height={RACK.height} style={StyleSheet.absoluteFill} opacity={.17}>
      {Array.from({ length: 26 }, (_, i) => <Path key={i} d={`M0 ${i * 9} Q340 ${i * 9 - 11} 680 ${i * 9 + 2} T1344 ${i * 9}`} fill="none" stroke={i % 2 ? '#ffd977' : '#743f04'} strokeWidth={1.2} />)}
    </Svg>
    <View pointerEvents="none" style={styles.brand}><Text style={styles.brandTitle}>KEYİF</Text><Text style={styles.brandSub}>101 OKEY</Text></View>
    {[0, 1].map(row => <View key={row} testID={`rack-row-${row}`} pointerEvents="none" style={[styles.rail, { top: RACK.top + row * RACK.rowHeight + RACK.tileHeight }]}><LinearGradient colors={['#fff0ad', '#d9a53b', '#72410d']} style={StyleSheet.absoluteFill} /></View>)}
    {[0, 1].map(side => <LinearGradient key={side} colors={['#e2e2d5', '#9b9989', '#e5dfbe', '#929183']} style={[styles.cap, side ? { right: 0 } : { left: 0 }]}><Text style={styles.screw}>●</Text><Text style={styles.screw}>●</Text></LinearGradient>)}
    {active && <View pointerEvents="none" style={[styles.placeholder, { ...{ left: slotPosition(slots.indexOf(active)).x, top: slotPosition(slots.indexOf(active)).y } }]} />}
    {hover !== null && <View pointerEvents="none" testID="rack-drop-preview" style={[styles.preview, { left: slotPosition(hover).x, top: slotPosition(hover).y }]} />}
    {hand.map(tile => {
      const slot = slots.indexOf(tile.id); if (slot < 0) return null;
      return <RackPiece key={tile.id} tile={tile} slot={slot} scale={scale} indicator={indicator} selected={selected === tile.id} disabled={disabled || (active !== null && active !== tile.id)} reducedMotion={reducedMotion}
        onSelect={() => onSelect(tile.id)} onStart={() => { setActive(tile.id); onStart(); }}
        onMove={point => { setHover(rackTarget(point)); onHoverDiscard(discardHit(point)); }}
        onDrop={point => {
          if (discardHit(point)) return { position: { x: DISCARD.x - RACK.x + (DISCARD.width - RACK.tileWidth) / 2, y: DISCARD.y - RACK.y }, discard: true };
          const target = rackTarget(point);
          if (target !== null) { onMoveSlot(tile.id, target); return { position: slotPosition(target), slot: target }; }
          return { position: slotPosition(slot) };
        }} onFinish={drop => { setActive(null); setHover(null); onHoverDiscard(false); if (drop?.discard) onDiscard(tile.id); }} />;
    })}
  </View>;
}
const styles = StyleSheet.create({
  rack: { position: 'absolute', left: RACK.x, top: RACK.y, width: RACK.width, height: RACK.height, zIndex: 20, overflow: 'visible' },
  wood: { ...StyleSheet.absoluteFill, borderRadius: 8, borderWidth: 3, borderColor: '#ffcd60', borderBottomWidth: 6, borderBottomColor: '#653608' },
  cap: { position: 'absolute', top: -2, bottom: 2, width: 24, borderRadius: 5, borderWidth: 2, borderColor: '#ece6c9', justifyContent: 'space-around', alignItems: 'center' },
  screw: { color: '#5e6259', fontSize: 12, textShadowColor: '#fffae2', textShadowRadius: 1, textShadowOffset: { width: 1, height: 1 } },
  rail: { position: 'absolute', left: 22, right: 22, height: 7, borderRadius: 2, overflow: 'hidden', zIndex: 1 },
  brand: { position: 'absolute', left: 550, top: 40, alignItems: 'center', opacity: .25, transform: [{ rotate: '-4deg' }] },
  brandTitle: { fontFamily: F.extra, fontSize: 47, color: '#663800', letterSpacing: 7 }, brandSub: { fontFamily: F.bold, fontSize: 13, color: '#663800', letterSpacing: 8 },
  piece: { position: 'absolute', left: 0, top: 0, width: RACK.tileWidth, height: RACK.tileHeight },
  floating: { ...Platform.select({ web: { boxShadow: '10px 24px 24px rgba(13,20,25,.48)', borderRadius: 6 }, default: { shadowColor: '#000', shadowOffset: { width: 8, height: 22 }, shadowOpacity: .45, shadowRadius: 15 } }) },
  placeholder: { position: 'absolute', width: RACK.tileWidth, height: RACK.tileHeight, backgroundColor: '#69380038', borderRadius: 5, borderWidth: 1, borderColor: '#6f42033b' },
  preview: { position: 'absolute', width: RACK.tileWidth, height: RACK.tileHeight, backgroundColor: '#fff7c94a', borderRadius: 6, borderWidth: 2, borderColor: '#fff1a0', zIndex: 3 },
});
