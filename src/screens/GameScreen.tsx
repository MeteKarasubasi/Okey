import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, AccessibilityInfo } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, Clock3, Gift, MessageCircle, RotateCcw, ShoppingBag, Trophy, ArrowDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Defs, Pattern, Path, Rect, Line } from 'react-native-svg';
import { C, F, elevation } from '../theme';
import { Avatar, Button, Coin, OkeyTile } from '../components/UI';
import { Game, NAMES, botTurn, draw, discard, extendMeld, openMelds, bestMelds, rackMelds, sortTiles, Tile } from '../game/engine';
import { DISCARD, RACK, RackSlots, reconcileRack, moveRackSlot, arrangeRack, rackTarget, slotPosition } from '../game/rackLayout';
import { Profile } from '../storage';
import { Room } from './Lobby';
import { MeldBoard } from '../components/MeldBoard';
import { TileRack } from '../components/TileRack';
import { DrawTile, DrawDrop } from '../components/DrawTile';

type Props = { game: Game; setGame: React.Dispatch<React.SetStateAction<Game | null>>; profile: Profile; room: Room; onExit: () => void; onHelp: () => void; onReplay: () => void; paused: boolean };
const W = 1600, H = 900;
function TablePattern() {
  return <Svg pointerEvents="none" width={W} height={H} style={StyleSheet.absoluteFill}>
    <Defs><Pattern id="damask" width="170" height="180" patternUnits="userSpaceOnUse">
      <Path d="M85 0C20 30 12 99 61 109C99 117 113 68 84 57C63 49 50 69 62 83C75 93 89 80 78 72M85 0C150 30 158 99 109 109M85 21C42 51 25 126 85 161C145 126 128 51 85 21M0 150C48 115 43 171 85 180C127 171 122 115 170 150M0 12C28 9 38 35 20 47C5 55-8 40 5 31" fill="none" stroke="#06354b" strokeWidth="3" opacity=".36" />
      <Path d="M86 6C24 36 21 96 63 103M87 28C48 61 35 124 85 153M4 151C47 124 45 176 84 176" fill="none" stroke="#6cafbf" strokeWidth="1.4" opacity=".18" />
    </Pattern></Defs><Rect width={W} height={H} fill="url(#damask)" />
  </Svg>;
}
function BevelButton({ label, children, onPress, disabled, tone = 'blue', style, testID, iconOnly = false }: {
  label: string; children?: React.ReactNode; onPress?: () => void; disabled?: boolean; tone?: 'blue' | 'ivory' | 'green'; style?: any; testID?: string; iconOnly?: boolean;
}) {
  const colors: [string, string, string] = tone === 'ivory' ? ['#fffefa', '#e4e7e4', '#b6c0c5'] : tone === 'green' ? ['#b1da35', '#478b13', '#286809'] : ['#547cbd', '#263e74', '#142546'];
  return <Pressable accessibilityRole="button" accessibilityLabel={label} testID={testID} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [s.bevel, style, disabled && { opacity: .42 }, pressed && { transform: [{ translateY: 2 }], opacity: .9 }]}>
    <LinearGradient colors={colors} locations={[0, .45, 1]} style={[StyleSheet.absoluteFill, { borderRadius: 11 }]} />
    <View pointerEvents="none" style={s.buttonGlint} /><View pointerEvents="none" style={{ zIndex: 1, flexShrink: 0 }}>{children}</View>
    {!iconOnly && <Text style={[s.buttonText, tone === 'ivory' && { color: '#182532', textShadowColor: '#fff', fontSize: 15 }]}>{label}</Text>}
  </Pressable>;
}
function SortArt({ pair = false, small = false }: { pair?: boolean; small?: boolean }) {
  return <View style={{ flexDirection: 'row', height: small ? 29 : 46, marginBottom: small ? 0 : 10, transform: [{ rotate: '-7deg' }] }}>
    {(pair ? [5, 5] : [1, 2, 3]).map((value, i) => <View key={i} style={{ marginLeft: i ? -7 : 0, transform: [{ rotate: `${i * 10}deg` }] }}><OkeyTile size={small ? 20 : 28} height={small ? 28 : 37} tile={{ color: 'red', value }} /></View>)}
  </View>;
}
function Player({ person, name, active, vertical = false }: { person: number; name: string; active: boolean; vertical?: boolean }) {
  return <View style={[s.player, vertical && s.verticalPlayer, active && s.activePlayer]}>
    <LinearGradient colors={active ? ['#566820', '#283b20', '#101a19'] : ['#303b4c', '#151e2a', '#0b141f']} style={[StyleSheet.absoluteFill, { borderRadius: 9 }]} />
    <Avatar person={person} size={48} active={active} />
    <View style={vertical ? { position: 'absolute', width: 200, height: 36, left: -70, top: 135, transform: [{ rotate: '90deg' }] } : { flex: 1 }}><Text numberOfLines={1} style={s.playerName}>{name}</Text></View>
    <View style={vertical ? { position: 'absolute', bottom: 10 } : { zIndex: 1 }}><Gift size={32} color="#e0b74d" fill="#a52d26" /></View>
  </View>;
}
function DiscardSlot({ tile, x, y, onPress, label, highlighted, testID }: { tile?: Tile; x: number; y: number; onPress?: () => void; label: string; highlighted?: boolean; testID?: string }) {
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[s.discardSlot, { left: x, top: y }, highlighted && s.discardHighlighted]}>
    {tile ? <OkeyTile tile={tile} size={65} height={87} /> : <><ArrowDown size={28} color={highlighted ? '#edfb9d' : '#71a1b5'} /><Text style={s.slotLabel}>{label}</Text></>}
  </Pressable>;
}
export default function GameScreen({ game, setGame, profile, room, onExit, onHelp, onReplay, paused }: Props) {
  const [viewport, setViewport] = useState({ width: W, height: H });
  const scale = Math.min(viewport.width / W, viewport.height / H);
  const [selected, setSelected] = useState<string | null>(null), [hoverDiscard, setHoverDiscard] = useState(false);
  const [storedSlots, setSlots] = useState<RackSlots>(() => {
    const groups = bestMelds(game.hands[0], game.indicator, game.mode, true).map(m => m.tiles.map(t => t.id));
    const grouped = new Set(groups.flat());
    return arrangeRack(groups, game.hands[0].filter(t => !grouped.has(t.id)).map(t => t.id));
  });
  const [reducedMotion, setReducedMotion] = useState(false);
  const hand = game.hands[0], myTurn = game.turn === 0 && !game.ended;
  const slots = useMemo(() => reconcileRack(storedSlots, hand.map(t => t.id)), [storedSlots, hand]);
  useEffect(() => { if (slots.some((id, i) => id !== storedSlots[i])) setSlots(slots); }, [slots, storedSlots]);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion); const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion); return () => sub.remove(); }, []);
  useEffect(() => {
    if (game.turn === 0 || game.ended || paused) return;
    const timer = setTimeout(() => setGame(g => g ? botTurn(g) : null), profile.quick ? 650 : 1400);
    return () => clearTimeout(timer);
  }, [game.turn, game.turnCount, game.ended, paused, profile.quick]);
  const melds = useMemo(() => rackMelds(hand, game.indicator, slots, game.mode), [hand, game.indicator, slots, game.mode]);
  const points = melds.reduce((sum, meld) => sum + meld.score, 0);
  const canDraw = myTurn && game.phase === 'draw' && !paused && game.stock.length > 0;
  const dropDrawnTile = (point: { x: number; y: number }, tapped: boolean): DrawDrop => {
    const local = { x: point.x - RACK.x, y: point.y - RACK.y };
    const target = rackTarget(local) ?? (tapped ? slots.indexOf(null) : -1);
    if (target >= 0) return { slot: target, position: { x: RACK.x + slotPosition(target).x, y: RACK.y + slotPosition(target).y } };
    return { position: { x: 1074, y: 433 } };
  };
  const finishDraw = (drop?: DrawDrop) => {
    if (drop?.slot === undefined || !canDraw) return;
    const drawn = game.stock.at(-1);
    if (!drawn) return;
    setSlots(previous => moveRackSlot(reconcileRack(previous, [...hand.map(tile => tile.id), drawn.id]), drawn.id, drop.slot!));
    run(g => draw(g));
  };
  const touch = () => { if (profile.vibration && Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); };
  const run = (fn: (g: Game) => Game) => {
    if (paused) return;
    touch(); setGame(g => g && g.turn === 0 && !g.ended ? fn(g) : g);
  };
  function arrange(by: 'number' | 'color' | 'melds') {
    const grouped = by === 'melds' || by === 'color' ? melds.flatMap(m => m.tiles) : [];
    const ids = new Set(grouped.map(t => t.id));
    const tiles = [...grouped, ...sortTiles(hand.filter(t => !ids.has(t.id)), game.indicator, by === 'number' ? 'number' : 'color')];
    setSlots(arrangeRack(grouped.length ? melds.map(m => m.tiles.map(t => t.id)) : [], tiles.filter(t => !ids.has(t.id)).map(t => t.id))); touch();
  }
  return <View testID="game-viewport" style={s.viewport} onLayout={e => setViewport({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
    <View testID="game-stage" style={[s.stage, { left: (viewport.width - W) / 2, top: (viewport.height - H) / 2, transform: [{ scale }] }]}>
      <LinearGradient colors={['#185a72', '#1d7391', '#0c4058']} locations={[0, .65, 1]} style={StyleSheet.absoluteFill} /><TablePattern />
      <View pointerEvents="none" style={s.frame} />
      <View style={s.wallet}><Coin size={49} /><Text style={s.walletText}>{profile.coins.toLocaleString('tr-TR')}</Text></View>
      <View style={s.timer}><Clock3 size={31} color="#cde4dd" /><View style={{ flex: 1, gap: 7 }}><View style={s.timerTrack}><View style={[s.timerFill, { width: myTurn ? '85%' : '48%' }]} /></View><Text style={s.timerText}>{myTurn ? 'SIRA SENDE' : `${NAMES[game.turn].toLocaleUpperCase('tr-TR')} OYNUYOR`}</Text></View></View>
      <View style={{ position: 'absolute', left: 632, top: 10, width: 350 }}><Player person={3} name={NAMES[3]} active={game.turn === 3 && !game.ended} /></View>
      <BevelButton label="SATIN AL" tone="green" onPress={onHelp} style={{ left: 1210, top: 12, width: 172, height: 52, flexDirection: 'row' }}><ShoppingBag size={25} color="#fff4ae" /></BevelButton>
      <BevelButton label="Sohbet" iconOnly onPress={onHelp} style={{ left: 1398, top: 12, width: 82, height: 52 }}><MessageCircle size={27} color="#f6f3e4" /></BevelButton>
      <BevelButton label="Menü" iconOnly onPress={onExit} style={{ left: 1493, top: 12, width: 82, height: 52 }}><ChevronDown size={28} color="#f6f3e4" /></BevelButton>
      <View style={s.mainBoard}><MeldBoard melds={game.melds} indicator={game.indicator} onMeldPress={i => selected ? run(g => extendMeld(g, selected, i)) : setGame(g => g ? { ...g, message: 'İşlemek istediğin taşı seç, ardından pere dokun.' } : g)} /></View>
      <View style={s.badges}>{['Tek', 'Yardımlı', 'Katlamasız', '1 El'].map((label, i) => <LinearGradient key={label} colors={i === 1 ? ['#15a877', '#087657'] : ['#0a3c52', '#145c71']} style={s.badge}><Text style={s.badgeText}>{label}</Text></LinearGradient>)}</View>
      <View style={s.indicator}><OkeyTile tile={game.indicator} size={72} height={96} /></View>
      <View testID="draw-stock" accessibilityRole="button" accessibilityLabel={`Ortadan taş çek, ${game.stock.length} taş kaldı`} style={s.stock}>
        <OkeyTile size={72} height={96} back /><View style={s.stockCount}><Text style={s.stockText}>{game.stock.length}</Text></View>
      </View>
      <DrawTile tile={canDraw ? game.stock.at(-1) : undefined} indicator={game.indicator} source={{ x: 1074, y: 433, width: 72, height: 96 }} scale={scale} disabled={!canDraw} reducedMotion={reducedMotion} onStart={touch} onMove={() => {}} onDrop={dropDrawnTile} onFinish={finishDraw} />
      <View style={s.score}><Text style={s.scoreText}>{game.opened[0] ? '101+' : points}</Text></View>
      <View style={s.sideBoard}><Svg width="100%" height="100%"><Rect width="100%" height="100%" fill="#0b2b3e" />{Array.from({ length: 7 }, (_, i) => <Line key={`v${i}`} x1={i * 32} x2={i * 32} y1={0} y2={520} stroke={i === 3 ? '#91a6a8' : '#285065'} strokeWidth={i === 3 ? 1.3 : 1} />)}{Array.from({ length: 14 }, (_, i) => <Line key={`h${i}`} y1={i * 40} y2={i * 40} x1={0} x2={192} stroke="#285065" />)}</Svg></View>
      <View style={{ position: 'absolute', left: 9, top: 250 }}><Player person={1} name={NAMES[1]} active={game.turn === 1 && !game.ended} vertical /></View>
      <View style={{ position: 'absolute', right: 9, top: 250 }}><Player person={2} name={NAMES[2]} active={game.turn === 2 && !game.ended} vertical /></View>
      <DiscardSlot x={28} y={86} tile={game.discards[1].at(-1)} label="Atılan taş" />
      <DiscardSlot x={1486} y={86} tile={game.discards[2].at(-1)} label="Atılan taş" />
      <DiscardSlot x={28} y={548} tile={game.discards[3].at(-1)} label="Yandan al" testID="draw-discard" onPress={() => run(g => draw(g, 'discard'))} />
      <DiscardSlot x={DISCARD.x} y={DISCARD.y} tile={game.discards[0].at(-1)} label="Buraya at" highlighted={hoverDiscard} testID="discard-target" />
      <View style={s.actions}>
        <BevelButton label="SERİ AÇ" tone="ivory" testID="open-melds" onPress={() => run(g => openMelds(g, melds))} disabled={!myTurn || game.phase !== 'discard'} style={s.meldAction}><SortArt small /></BevelButton>
        <BevelButton label="ÇİFT AÇ" tone="ivory" onPress={() => run(g => openMelds(g))} disabled={!myTurn || game.phase !== 'discard'} style={s.meldAction}><SortArt small pair /></BevelButton>
        <BevelButton label="GERİ TOPLA" tone="ivory" onPress={() => arrange('melds')} style={s.smallAction} />
        <BevelButton label="TAŞLARI İŞLE" tone="ivory" onPress={() => setGame(g => g ? { ...g, message: 'Istakandan taşı seç, masadaki uygun pere dokun.' } : g)} style={s.smallAction} />
      </View>
      <View style={{ position: 'absolute', left: 632, top: 599, width: 350 }}><Player person={0} name={profile.name} active={myTurn} /></View>
      <Text accessibilityLiveRegion="polite" style={s.message}>{game.message}</Text>
      <BevelButton label={'ÇİFT\nDİZ'} onPress={() => arrange('number')} style={s.sortLeft}><SortArt pair /></BevelButton>
      <BevelButton label={'SERİ\nDİZ'} onPress={() => arrange('color')} style={s.sortRight}><SortArt /></BevelButton>
      <TileRack hand={hand} slots={slots} scale={scale} selected={selected} indicator={game.indicator} disabled={paused || game.ended} reducedMotion={reducedMotion}
        canDiscard={myTurn && game.phase === 'discard' && !paused} onSelect={id => { setSelected(id === selected ? null : id); touch(); }} onStart={touch} onHoverDiscard={setHoverDiscard}
        onMoveSlot={(id, slot) => setSlots(previous => moveRackSlot(reconcileRack(previous, hand.map(t => t.id)), id, slot))}
        onDiscard={id => { setSelected(null); run(g => discard(g, id)); }} />
      {game.ended && <View style={s.resultOverlay}><View style={s.result}><Trophy size={45} color={C.gold} /><Text style={s.resultTitle}>{game.winner === 0 ? 'Güzel oynadın!' : game.winner === null ? 'Taşlar bitti.' : `${NAMES[game.winner]} kazandı.`}</Text><Text style={s.resultCopy}>{game.winner === 0 ? `+${room.reward} çip kazandın.` : 'Yeni bir el, yeni bir şans.'}</Text><Button onPress={onReplay} icon={<RotateCcw size={18} />}>Bir el daha</Button><Button onPress={onExit} secondary>Lobiye dön</Button></View></View>}
    </View>
  </View>;
}
const s = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden', backgroundColor: '#061d2a' }, stage: { position: 'absolute', width: W, height: H, overflow: 'hidden' }, frame: { ...StyleSheet.absoluteFill, borderWidth: 5, borderColor: '#082a3ac0' },
  wallet: { position: 'absolute', left: 24, top: 12, width: 177, height: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 9, borderWidth: 1, borderColor: '#57899a', backgroundColor: '#062737cc', paddingHorizontal: 9 }, walletText: { color: '#fff9e8', fontFamily: F.extra, fontSize: 28 },
  timer: { position: 'absolute', left: 220, top: 12, width: 230, height: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: '#529587', backgroundColor: '#082e3fd9' }, timerTrack: { height: 5, borderRadius: 4, backgroundColor: '#405e68' }, timerFill: { height: 5, borderRadius: 4, backgroundColor: '#d0e66a' }, timerText: { color: '#e0efcf', fontFamily: F.bold, fontSize: 10, letterSpacing: 1.4 },
  bevel: { position: 'absolute', borderRadius: 13, borderWidth: 2, borderColor: '#91accb', borderBottomWidth: 5, borderBottomColor: '#071d35', alignItems: 'center', justifyContent: 'center', gap: 5, ...elevation(5, .3) }, buttonGlint: { position: 'absolute', left: 3, right: 3, top: 2, height: '42%', borderRadius: 8, backgroundColor: '#ffffff0b', borderTopWidth: 1, borderColor: '#ffffff55' }, buttonText: { fontFamily: F.extra, fontSize: 19, color: '#fffdf3', textAlign: 'center', lineHeight: 28, textShadowColor: '#071729', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  player: { height: 59, borderRadius: 11, borderWidth: 2, borderColor: '#425364', padding: 4, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', gap: 12, ...elevation(3, .3) }, activePlayer: { borderColor: '#e5cb5e', ...elevation(5, .35) }, verticalPlayer: { width: 61, height: 260, flexDirection: 'column', paddingHorizontal: 3, paddingTop: 5 }, playerName: { fontFamily: F.bold, fontSize: 24, color: '#f6f2e7' },
  mainBoard: { position: 'absolute', left: 200, top: 80, width: 840, height: 520 }, badges: { position: 'absolute', left: 1054, top: 80, width: 108, gap: 7 }, badge: { height: 45, borderRadius: 8, borderWidth: 1, borderColor: '#082f43', justifyContent: 'center', alignItems: 'center' }, badgeText: { fontFamily: F.bold, fontSize: 19, color: '#f2f4e6' },
  indicator: { position: 'absolute', left: 1067, top: 296, padding: 7, borderWidth: 2, borderColor: '#4e91a5', borderRadius: 9, backgroundColor: '#082d40' }, stock: { position: 'absolute', left: 1067, top: 426, padding: 7, borderWidth: 2, borderColor: '#4e91a5', borderRadius: 9, backgroundColor: '#082d40' }, stockCount: { position: 'absolute', bottom: 12, alignSelf: 'center', borderWidth: 2, borderColor: '#fff', backgroundColor: '#d3d8d5', borderRadius: 20, minWidth: 38, height: 38, alignItems: 'center', justifyContent: 'center' }, stockText: { fontFamily: F.bold, color: '#182a33', fontSize: 25 },
  score: { position: 'absolute', left: 1061, top: 612, width: 94, height: 42, borderRadius: 14, borderWidth: 2, borderColor: '#aacbeb', borderBottomWidth: 4, backgroundColor: '#254983', alignItems: 'center', justifyContent: 'center' }, scoreText: { fontFamily: F.extra, color: '#fff', fontSize: 28 }, sideBoard: { position: 'absolute', left: 1176, top: 80, width: 192, height: 520, borderRadius: 7, overflow: 'hidden', borderWidth: 1, borderColor: '#2b5d6d' },
  discardSlot: { position: 'absolute', width: 92, height: 104, borderRadius: 10, borderWidth: 2, borderColor: '#31748a', backgroundColor: '#073044b5', alignItems: 'center', justifyContent: 'center', gap: 6 }, discardHighlighted: { borderColor: '#eeef8b', backgroundColor: '#617c39', ...elevation(9, .3) }, slotLabel: { fontFamily: F.bold, fontSize: 11, color: '#a2c9cf' },
  actions: { position: 'absolute', left: 1384, top: 202, width: 132, gap: 12 }, meldAction: { position: 'relative', width: 132, height: 83 }, smallAction: { position: 'relative', width: 132, height: 53 }, message: { position: 'absolute', left: 200, top: 613, width: 418, height: 40, fontFamily: F.medium, color: '#d0e9e7', fontSize: 12, textAlign: 'center', textAlignVertical: 'center' }, sortLeft: { left: 23, top: 665, width: 90, height: 217 }, sortRight: { right: 23, top: 665, width: 90, height: 217 },
  resultOverlay: { ...StyleSheet.absoluteFill, zIndex: 100, backgroundColor: '#051d2bdf', alignItems: 'center', justifyContent: 'center' }, result: { width: 450, padding: 35, gap: 16, borderRadius: 20, borderWidth: 1, borderColor: '#6e91a5', backgroundColor: '#12374c' }, resultTitle: { color: '#fff7df', fontFamily: F.extra, fontSize: 32 }, resultCopy: { color: '#b8d1d8', fontSize: 17 },
});
