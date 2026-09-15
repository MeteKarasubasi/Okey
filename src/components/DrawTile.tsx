import React, { useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import { Tile, isJoker } from '../game/engine';
import { OkeyTile } from './UI';
import { Point } from '../game/rackLayout';

type Source = { x: number; y: number; width: number; height: number };
export type DrawDrop = { position: Point; slot?: number };

type Props = {
  tile?: Tile;
  indicator: Tile;
  source: Source;
  scale: number;
  disabled: boolean;
  reducedMotion: boolean;
  onStart: () => void;
  onMove: (point: Point) => void;
  onDrop: (point: Point, tapped: boolean) => DrawDrop;
  onFinish: (drop?: DrawDrop) => void;
};

/** The draw pile reveals the physical tile under the finger immediately. */
export function DrawTile({ tile, indicator, source, scale, disabled, reducedMotion, onStart, onMove, onDrop, onFinish }: Props) {
  const latest = useRef({ tile, scale, disabled, reducedMotion, onStart, onMove, onDrop, onFinish });
  latest.current = { tile, scale, disabled, reducedMotion, onStart, onMove, onDrop, onFinish };
  const position = useRef(new Animated.ValueXY({ x: source.x, y: source.y })).current;
  const lift = useRef(new Animated.Value(0)).current;
  const [held, setHeld] = useState(false);
  const active = useRef(false);
  const origin = useRef({ x: source.x, y: source.y });

  const animateTo = (point: Point, done: () => void) => {
    if (latest.current.reducedMotion) {
      position.setValue(point); lift.setValue(0); done(); return;
    }
    Animated.parallel([
      Animated.spring(position, { toValue: point, stiffness: 330, damping: 28, mass: .72, useNativeDriver: true }),
      Animated.timing(lift, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) done(); });
  };

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => Boolean(latest.current.tile) && !latest.current.disabled && !active.current,
    onPanResponderGrant: () => {
      const current = latest.current;
      if (!current.tile) return;
      position.stopAnimation(); lift.stopAnimation();
      origin.current = { x: source.x, y: source.y };
      position.setValue(origin.current); active.current = true; setHeld(true); current.onStart();
      if (current.reducedMotion) lift.setValue(1);
      else Animated.spring(lift, { toValue: 1, stiffness: 420, damping: 25, useNativeDriver: true }).start();
    },
    onPanResponderMove: (_, gesture) => {
      const point = { x: origin.current.x + gesture.dx / latest.current.scale, y: origin.current.y + gesture.dy / latest.current.scale };
      position.setValue(point);
      latest.current.onMove({ x: point.x + source.width / 2, y: point.y + source.height / 2 });
    },
    onPanResponderRelease: (_, gesture) => {
      active.current = false;
      const moved = Math.hypot(gesture.dx, gesture.dy) > 4;
      const point = { x: origin.current.x + gesture.dx / latest.current.scale + source.width / 2, y: origin.current.y + gesture.dy / latest.current.scale + source.height / 2 };
      const drop = latest.current.onDrop(point, !moved);
      animateTo(drop.position, () => { setHeld(false); latest.current.onFinish(drop); });
    },
    onPanResponderTerminate: () => {
      active.current = false;
      animateTo(origin.current, () => { setHeld(false); latest.current.onFinish(); });
    },
    onPanResponderTerminationRequest: () => false,
  }), []);

  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    <View {...responder.panHandlers} testID="draw-pile-hit" style={[styles.hit, { left: source.x - 10, top: source.y - 10, width: source.width + 20, height: source.height + 20 }, { cursor: held ? 'grabbing' : 'grab', touchAction: 'none' } as any]} />
    {held && tile && <Animated.View pointerEvents="none" style={[styles.floating, { width: source.width, height: source.height, transform: [...position.getTranslateTransform(), { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -24] }) }, { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) }, { rotate: lift.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-3deg'] }) }] }]}>
      <OkeyTile tile={tile} size={source.width} height={source.height} joker={isJoker(tile, indicator)} />
    </Animated.View>}
  </View>;
}

const styles = StyleSheet.create({
  hit: { position: 'absolute', zIndex: 41 },
  floating: { position: 'absolute', zIndex: 42, boxShadow: '10px 24px 24px rgba(8,18,25,.52)', borderRadius: 7 },
});
