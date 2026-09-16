import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, AccessibilityInfo } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, Clock3, Gift, MessageCircle, ShoppingBag, Trophy, ArrowDown, Users } from 'lucide-react-native';
import Svg, { Defs, Pattern, Path, Rect, Line } from 'react-native-svg';
import { C, F, elevation } from '../theme';
import { Avatar, Button, Coin, OkeyTile } from '../components/UI';
import { Game, NAMES, draw, discard, extendMeld, openMelds, bestMelds, rackMelds, collectMelds, sortTiles, rearrangeTable, face, Tile } from '../game/engine';
import { BOARD_COLUMNS, layoutMelds } from '../game/boardLayout';
import { DISCARD, RACK, RackSlots, reconcileRack, moveRackSlot, arrangeRack, rackTarget, slotPosition } from '../game/rackLayout';
import { Profile } from '../storage';
import { Room } from './Lobby';
import { MeldBoard } from '../components/MeldBoard';
import { TileRack } from '../components/TileRack';
import { DrawTile, DrawDrop } from '../components/DrawTile';
import { saveFriendRequest, saveGift } from '../social';
import { appendGameAction } from '../game/online';

type Props = { game: Game; setGame: React.Dispatch<React.SetStateAction<Game | null>>; profile: Profile; userId?: string; remoteGameId?: string; room: Room; round: number; roundCount: number; matchScores: number[]; roundScores?: number[]; onUpdateProfile: (patch: Partial<Profile>) => void; onExit: () => void; onHelp: () => void; onReplay: () => void; paused: boolean; playerSeat?: number; onRemoteAction?: (action: string, payload: Record<string, unknown>) => void; onCallBot?: () => void; onlineRoomId?: string; onlineStarted?: boolean; onlinePlayers?: { seat: number; isBot?: boolean; name?: string }[]; onlineHasBot?: boolean; onlineCountdownEndsAt?: number | null; onlineStartingUntil?: number | null; onlineResultUntil?: number | null };
const W = 1600, H = 900;
type OpponentId = 1 | 2 | 3;
type GiftHours = 2 | 3 | 5 | 24;
type GiftOffer = { id: string; hours: GiftHours; cost: number; emoji: string; title: string; tone: string };
type SentGift = Pick<GiftOffer, 'hours' | 'cost' | 'emoji' | 'title'> & { sentAt: number };
const GIFT_PRICES: Record<GiftHours, number> = { 2: 100, 3: 180, 5: 300, 24: 750 };
const makeGiftCatalog = (hours: GiftHours, tone: string, items: [string, string][]): GiftOffer[] => items.map(([emoji, title], index) => ({ id: `${hours}-${index}`, hours, cost: GIFT_PRICES[hours], emoji, title, tone }));
const GIFT_CATALOG: Record<GiftHours, GiftOffer[]> = {
  2: makeGiftCatalog(2, '#5da7bf', [['🍵', 'Çay'], ['☕', 'Kahve'], ['🧃', 'Meyve suyu'], ['🥤', 'Soğuk içecek'], ['🍪', 'Kurabiye'], ['🍰', 'Pasta'], ['🥪', 'Atıştırmalık'], ['🍦', 'Dondurma'], ['🍩', 'Donut'], ['🍋', 'Limonata']]),
  3: makeGiftCatalog(3, '#71b86d', [['👕', 'Tişört'], ['🧢', 'Şapka'], ['🧣', 'Atkı'], ['👟', 'Spor ayakkabı'], ['🕶️', 'Güneş gözlüğü'], ['🧥', 'Ceket'], ['🧦', 'Çorap'], ['👗', 'Elbise'], ['🎒', 'Sırt çantası'], ['⌚', 'Kol saati']]),
  5: makeGiftCatalog(5, '#d4a64b', [['🎧', 'Kulaklık'], ['🎮', 'Oyun kolu'], ['📷', 'Fotoğraf makinesi'], ['💡', 'Masa lambası'], ['📚', 'Kitap seti'], ['☂️', 'Şemsiye'], ['👜', 'Çanta'], ['🧸', 'Oyuncak'], ['🪴', 'Masa bitkisi'], ['🎵', 'Müzik kutusu']]),
  24: makeGiftCatalog(24, '#c66b85', [['💎', 'Elmas'], ['👑', 'Taç'], ['💐', 'Çiçek buketi'], ['🎁', 'Büyük hediye'], ['🏆', 'Kupa'], ['💍', 'Yüzük'], ['🧴', 'Parfüm'], ['🧳', 'Valiz'], ['🌟', 'Yıldız paketi'], ['🚀', 'Sürpriz roket']]),
};
const OPPONENT_STATS: Record<OpponentId, { level: string; games: number; wins: number; streak: number; id: string }> = {
  1: { level: 'Usta', games: 238, wins: 141, streak: 4, id: 'M69433521' },
  2: { level: 'Usta adayı', games: 184, wins: 93, streak: 2, id: 'M53426493' },
  3: { level: 'Şanslı oyuncu', games: 207, wins: 108, streak: 3, id: 'M68787856' },
};
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
function Player({ person, name, active, vertical = false, gifts = [], onPress }: { person: number; name: string; active: boolean; vertical?: boolean; gifts?: SentGift[]; onPress?: () => void }) {
  const content = <>
    <LinearGradient colors={active ? ['#566820', '#283b20', '#101a19'] : ['#303b4c', '#151e2a', '#0b141f']} style={[StyleSheet.absoluteFill, { borderRadius: 9 }]} />
    <Avatar person={person} size={48} active={active} />
    <View style={vertical ? { position: 'absolute', width: 200, height: 36, left: -70, top: 135, transform: [{ rotate: '90deg' }] } : { flex: 1 }}><Text numberOfLines={1} style={s.playerName}>{name}</Text></View>
    <View style={[s.giftsOnBand, vertical && s.verticalGiftsOnBand]}>
      <Gift size={vertical ? 23 : 27} color="#e0b74d" fill="#a52d26" />
      {gifts.slice(-3).map((gift, index) => <View key={`${gift.sentAt}-${index}`} style={[s.giftBadge, { borderColor: gift.hours === 24 ? '#e48da6' : '#e0b74d' }]}><Text style={s.giftBadgeEmoji}>{gift.emoji}</Text><Text style={s.giftBadgeText}>{gift.hours}s</Text></View>)}
    </View>
  </>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={`${name} profilini aç`} onPress={onPress} style={[s.player, vertical && s.verticalPlayer, active && s.activePlayer]}>{content}</Pressable>
    : <View style={[s.player, vertical && s.verticalPlayer, active && s.activePlayer]}>{content}</View>;
}
function DiscardSlot({ tile, x, y, onPress, label, highlighted, disabled = false, testID }: { tile?: Tile; x: number; y: number; onPress?: () => void; label: string; highlighted?: boolean; disabled?: boolean; testID?: string }) {
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={disabled ? `${label}, bu taş bu turda kilitli` : label} disabled={disabled} onPress={onPress} style={[s.discardSlot, { left: x, top: y }, highlighted && s.discardHighlighted, disabled && s.discardDisabled]}>
    {tile ? <OkeyTile tile={tile} size={65} height={87} /> : <><ArrowDown size={28} color={highlighted ? '#edfb9d' : '#71a1b5'} /><Text style={s.slotLabel}>{label}</Text></>}
    {disabled && <Text style={s.lockedLabel}>KİLİTLİ</Text>}
  </Pressable>;
}
export default function GameScreen({ game, setGame, profile, userId, remoteGameId, room, round, roundCount, matchScores, roundScores = [], onUpdateProfile, onExit, onHelp, onReplay, paused, playerSeat = 0, onRemoteAction, onCallBot, onlineRoomId, onlineStarted = true, onlinePlayers = [], onlineHasBot = false, onlineCountdownEndsAt = null, onlineStartingUntil = null, onlineResultUntil = null }: Props) {
  const seat = playerSeat;
  const [viewport, setViewport] = useState({ width: W, height: H });
  const scale = Math.min(viewport.width / W, viewport.height / H);
  const [selected, setSelected] = useState<string | null>(null), [hoverDiscard, setHoverDiscard] = useState(false);
  const [profileTarget, setProfileTarget] = useState<OpponentId | null>(null);
  const [sentGifts, setSentGifts] = useState<Partial<Record<OpponentId, SentGift[]>>>({});
  const [friendRequests, setFriendRequests] = useState<Set<OpponentId>>(new Set());
  const [profileNotice, setProfileNotice] = useState('');
  const [giftCategory, setGiftCategory] = useState<GiftHours>(2);
  const [timeLeft, setTimeLeft] = useState(30);
  const [startCountdown, setStartCountdown] = useState(10);
  const [resultCountdown, setResultCountdown] = useState(5);
  const [storedSlots, setSlots] = useState<RackSlots>(() => {
    const groups = bestMelds(game.hands[seat], game.indicator, game.mode, true).map(m => m.tiles.map(t => t.id));
    const grouped = new Set(groups.flat());
    return arrangeRack(groups, game.hands[seat].filter(t => !grouped.has(t.id)).map(t => t.id));
  });
  const [reducedMotion, setReducedMotion] = useState(false);
  const preOpenSlots = useRef<RackSlots | null>(null);
  const previousOpened = useRef(game.opened[seat]);
  const hand = game.hands[seat], myTurn = game.turn === seat && !game.ended && (!onlineRoomId || onlineStarted);
  const occupied = (targetSeat: number) => !onlineRoomId || onlinePlayers.some(player => player.seat === targetSeat);
  const realPlayerCount = onlinePlayers.filter(player => !player.isBot).length;
  const botPlayerCount = onlinePlayers.filter(player => player.isBot).length;
  const playerName = (targetSeat: number) => onlinePlayers.find(player => player.seat === targetSeat)?.name ?? NAMES[targetSeat];
  const profilePaused = profileTarget !== null;
  const startMessageVisible = Boolean(onlineRoomId && !onlineStarted && onlineStartingUntil && onlineStartingUntil > Date.now());
  const slots = useMemo(() => reconcileRack(storedSlots, hand.map(t => t.id)), [storedSlots, hand]);
  useEffect(() => {
    if (!previousOpened.current && game.opened[seat]) preOpenSlots.current = [...storedSlots];
    previousOpened.current = game.opened[seat];
  }, [game.opened, seat, storedSlots]);
  useEffect(() => { if (slots.some((id, i) => id !== storedSlots[i])) setSlots(slots); }, [slots, storedSlots]);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion); const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion); return () => sub.remove(); }, []);
  useEffect(() => {
    if (game.ended || paused || (onlineRoomId && !onlineStarted)) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((game.rules.turnTimeSeconds * 1000 - (Date.now() - game.turnStartedAt)) / 1000));
      setTimeLeft(remaining);
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [game.turn, game.turnCount, game.turnStartedAt, game.ended, paused, onlineRoomId, onlineStarted]);
  useEffect(() => {
    if (!onlineRoomId || onlineStarted) return;
    const tick = () => {
      const until = onlineStartingUntil ?? onlineCountdownEndsAt;
      setStartCountdown(until ? Math.max(0, Math.ceil((until - Date.now()) / 1000)) : 0);
    };
    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [onlineRoomId, onlineStarted, onlineCountdownEndsAt, onlineStartingUntil]);
  useEffect(() => {
    if (!game.ended) return;
    const tick = () => setResultCountdown(Math.max(0, Math.ceil(((onlineResultUntil ?? (Date.now() + 5000)) - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [game.ended, onlineResultUntil]);
  const melds = useMemo(() => rackMelds(hand, game.indicator, slots, game.mode), [hand, game.indicator, slots, game.mode]);
  const points = melds.reduce((sum, meld) => sum + meld.score, 0);
  const previousDiscard = game.discards[(game.turn + 3) % 4].at(-1);
  const canDraw = myTurn && game.phase === 'draw' && !paused && (game.stock.length > 0 || Boolean(previousDiscard));
  const dropDrawnTile = (point: { x: number; y: number }, tapped: boolean, sourceX = 1074, sourceY = 433): DrawDrop => {
    const local = { x: point.x - RACK.x, y: point.y - RACK.y };
    const target = rackTarget(local) ?? (tapped ? slots.indexOf(null) : -1);
    if (target >= 0) return { slot: target, position: { x: RACK.x + slotPosition(target).x, y: RACK.y + slotPosition(target).y } };
    return { position: { x: sourceX, y: sourceY } };
  };
  const finishDraw = (drop?: DrawDrop) => {
    if (drop?.slot === undefined || !canDraw) return;
    const drawn = game.stock.at(-1);
    if (!drawn) return;
    setSlots(previous => moveRackSlot(reconcileRack(previous, [...hand.map(tile => tile.id), drawn.id]), drawn.id, drop.slot!));
    run(g => draw(g), 'DRAW_DECK');
  };
  const finishDiscardDraw = (drop?: DrawDrop) => {
    if (drop?.slot === undefined || !canDraw || !previousDiscard) return;
    const drawn = previousDiscard;
    setSlots(previous => moveRackSlot(reconcileRack(previous, [...hand.map(tile => tile.id), drawn.id]), drawn.id, drop.slot!));
    run(g => draw(g, 'discard'), 'DRAW_DISCARD');
  };
  const touch = () => {};
  const run = (fn: (g: Game) => Game, actionType = 'CLIENT_MOVE', payload: Record<string, unknown> = {}) => {
    if (paused || profilePaused) return;
    touch();
    if (game.turn !== seat || game.ended) return;
    if (onRemoteAction) { onRemoteAction(actionType, payload); return; }
    const next = fn(game);
    if (next === game) return;
    setGame(next);
    void appendGameAction(remoteGameId, userId, actionType, { round, turn: game.turn, ...payload });
  };
  const openPlayerProfile = (player: OpponentId) => { setProfileTarget(player); setGiftCategory(2); setProfileNotice(''); touch(); };
  const sendFriendRequest = () => {
    if (profileTarget === null) return;
    setFriendRequests(previous => new Set(previous).add(profileTarget));
    void saveFriendRequest(userId, `bot-${profileTarget}`);
    setProfileNotice(`${NAMES[profileTarget]} arkadaşlık isteğini aldı.`);
  };
  const sendGift = async (offer: GiftOffer) => {
    if (profileTarget === null) return;
    if (profile.coins < offer.cost) { setProfileNotice(`Bu hediye için ${offer.cost} coin gerekli.`); return; }
    const result = await saveGift(userId, `bot-${profileTarget}`, offer);
    if (!result.ok) { setProfileNotice('Hediye gönderilemedi; coinlerin değişmedi.'); return; }
    onUpdateProfile({ coins: result.remaining ?? profile.coins - offer.cost });
    setSentGifts(previous => ({ ...previous, [profileTarget]: [...(previous[profileTarget] ?? []), { hours: offer.hours, cost: offer.cost, emoji: offer.emoji, title: offer.title, sentAt: Date.now() }] }));
    setProfileNotice(`${offer.hours} saatlik hediye ${NAMES[profileTarget]} kişisine gönderildi.`);
  };
  function arrange(by: 'number' | 'color' | 'melds') {
    // In pair mode every valid pair is its own physical group. Leaving one
    // empty rack slot between groups lets rackMelds distinguish two pairs
    // made from four identical tiles.
    const pairGroups = game.mode === 'pairs' && by === 'number'
      ? bestMelds(sortTiles(hand, game.indicator, 'number'), game.indicator, 'pairs')
      : [];
    const groups = pairGroups.length
      ? pairGroups.map(meld => meld.tiles.map(tile => tile.id))
      : by === 'melds' || by === 'color' ? melds.map(m => m.tiles.map(t => t.id)) : [];
    const grouped = groups.flatMap(group => group.map(id => hand.find(tile => tile.id === id)).filter((tile): tile is Tile => Boolean(tile)));
    const ids = new Set(grouped.map(t => t.id));
    const tiles = [...grouped, ...sortTiles(hand.filter(t => !ids.has(t.id)), game.indicator, by === 'number' ? 'number' : 'color')];
    setSlots(arrangeRack(groups, tiles.filter(t => !ids.has(t.id)).map(t => t.id))); touch();
  }
  function collectOwnMelds() {
    const own = game.melds.filter(meld => meld.owner === seat);
    if (!own.length) return;
    const returned = own.flatMap(meld => meld.tiles);
    const template = preOpenSlots.current;
    const restoredIds = [...hand, ...returned].map(tile => tile.id);
    setSlots(template ? reconcileRack(template, restoredIds) : arrangeRack(own.map(meld => meld.tiles.map(tile => tile.id)), hand.map(tile => tile.id)));
    preOpenSlots.current = null;
    run(g => collectMelds(g, seat), 'COLLECT_MELDS');
  }
  function reorderMelds(index: number, drop: { row: number; column: number }) {
    if (!myTurn || !game.opened[seat] || game.phase !== 'discard') return;
    const target = drop.row * BOARD_COLUMNS + drop.column;
    const currentPositions = layoutMelds(game.melds.map(meld => ({ length: meld.tiles.length, start: face(meld.tiles[0], game.indicator).value, kind: meld.kind })));
    const ranked = game.melds.map((_, meldIndex) => ({ meldIndex, position: meldIndex === index ? target : currentPositions[meldIndex].row * BOARD_COLUMNS + currentPositions[meldIndex].column }));
    const moving = ranked.find(item => item.meldIndex === index)!;
    const rest = ranked.filter(item => item.meldIndex !== index).sort((a, b) => a.position - b.position || a.meldIndex - b.meldIndex);
    const insertAt = rest.findIndex(item => item.position >= moving.position);
    if (insertAt < 0) rest.push(moving); else rest.splice(insertAt, 0, moving);
    const proposed = rest.map(item => game.melds[item.meldIndex]);
    run(g => rearrangeTable(g, proposed, g.hands[g.turn]), 'REARRANGE_TABLE', { melds: proposed.map(meld => ({ ids: meld.tiles.map(tile => tile.id), kind: meld.kind })), remainingHand: hand.map(tile => tile.id) });
  }
  return <View testID="game-viewport" style={s.viewport} onLayout={e => setViewport({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
    <View testID="game-stage" style={[s.stage, { left: (viewport.width - W) / 2, top: (viewport.height - H) / 2, transform: [{ scale }] }]}>
      <LinearGradient colors={['#185a72', '#1d7391', '#0c4058']} locations={[0, .65, 1]} style={StyleSheet.absoluteFill} /><TablePattern />
      <View pointerEvents="none" style={s.frame} />
      <View style={s.wallet}><Coin size={49} /><Text style={s.walletText}>{profile.coins.toLocaleString('tr-TR')}</Text></View>
      <View style={s.timer}><Clock3 size={31} color="#cde4dd" /><View style={{ flex: 1, gap: 7 }}><View style={s.timerTrack}><View style={[s.timerFill, { width: `${myTurn ? timeLeft / game.rules.turnTimeSeconds * 100 : 48}%`, backgroundColor: myTurn && timeLeft <= 5 ? '#f2a15f' : '#d0e66a' }]} /></View><Text style={s.timerText}>{myTurn ? `SIRA SENDE · ${timeLeft}` : `${NAMES[game.turn].toLocaleUpperCase('tr-TR')} OYNUYOR`}</Text></View></View>
      <View style={{ position: 'absolute', left: 632, top: 10, width: 350 }}>{occupied(3) ? <Player person={3} name={playerName(3)} active={game.turn === 3 && !game.ended} gifts={sentGifts[3]} onPress={() => openPlayerProfile(3)} /> : <View style={s.waitingPlayer}><Text style={s.waitingPlayerText}>OYUNCU 4 BEKLENİYOR</Text></View>}</View>
      {onlineRoomId && <View style={s.onlineRoom}><Text style={s.onlineRoomLabel}>CANLI ODA</Text><Text style={s.onlineRoomId}>{onlineRoomId}</Text></View>}
      {onlineRoomId && !onlineStarted && <View style={s.waitingBanner}><View style={s.waitingBannerCopy}><Text style={s.waitingBannerText}>{onlineHasBot ? `BOTLU DENEME · ${realPlayerCount} GERÇEK · ${botPlayerCount} BOT` : `GERÇEK OYUNCULAR BEKLENİYOR · ${realPlayerCount}/4`}</Text>{onlineHasBot && <Text style={s.waitingBannerNote}>Coin değişmez</Text>}</View>{!onlineHasBot && onlinePlayers.length < 4 && onCallBot && <Pressable accessibilityRole="button" accessibilityLabel="Boş koltukları GÜLAY botlarıyla doldur" onPress={onCallBot} style={({ pressed }) => [s.botCallButton, pressed && { opacity: .7, transform: [{ scale: .97 }] }]}><Users size={15} color="#16271d" /><Text style={s.botCallButtonText}>BOT ÇAĞIR</Text></Pressable>}</View>}
      {onlineRoomId && !onlineStarted && (onlineCountdownEndsAt || onlineStartingUntil) && <View style={s.startOverlay} pointerEvents="auto"><View style={s.startModal}><View style={s.startIcon}><Clock3 size={29} color="#f4da7c" /></View><Text style={s.startEyebrow}>{onlineHasBot ? 'BOTLU DENEME' : 'MASA HAZIR'}</Text><Text style={s.startTitle}>{startMessageVisible ? 'Oyun başlıyor' : 'Oyun Başlıyor'}</Text>{!startMessageVisible && <Text style={s.startNumber}>{startCountdown}</Text>}<View style={s.startPlayers}><Users size={16} color="#b6d8d0" /><Text style={s.startPlayersText}>{realPlayerCount} gerçek oyuncu · {botPlayerCount} bot hazır{onlineHasBot ? ' · coin değişmez' : ''}</Text></View></View></View>}
      <BevelButton label="SATIN AL" tone="green" onPress={onHelp} style={{ left: 1210, top: 12, width: 172, height: 52, flexDirection: 'row' }}><ShoppingBag size={25} color="#fff4ae" /></BevelButton>
      <BevelButton label="Sohbet" iconOnly onPress={onHelp} style={{ left: 1398, top: 12, width: 82, height: 52 }}><MessageCircle size={27} color="#f6f3e4" /></BevelButton>
      <BevelButton label="Menü" iconOnly onPress={onExit} style={{ left: 1493, top: 12, width: 82, height: 52 }}><ChevronDown size={28} color="#f6f3e4" /></BevelButton>
      <View style={s.mainBoard}><MeldBoard melds={game.melds} indicator={game.indicator} editable={myTurn && game.phase === 'discard' && game.opened[seat]} onMeldDrop={reorderMelds} onMeldPress={i => selected ? run(g => extendMeld(g, selected, i), 'ADD_TO_MELD', { meldIndex: i, tileId: selected }) : setGame(g => g ? { ...g, message: 'İşlemek istediğin taşı seç, ardından pere dokun.' } : g)} /></View>
      <View style={s.badges}>{['Tek', 'Yardımlı', 'Katlamasız', `${round}/${roundCount} El`].map((label, i) => <LinearGradient key={label} colors={i === 1 ? ['#15a877', '#087657'] : ['#0a3c52', '#145c71']} style={s.badge}><Text style={s.badgeText}>{label}</Text></LinearGradient>)}</View>
      <View style={s.indicator}><OkeyTile tile={game.indicator} size={72} height={96} /></View>
      <View testID="draw-stock" accessibilityRole="button" accessibilityLabel={`Ortadan taş çek, ${game.stock.length} taş kaldı`} style={s.stock}>
        <OkeyTile size={72} height={96} back /><View style={s.stockCount}><Text style={s.stockText}>{game.stock.length}</Text></View>
      </View>
      <DrawTile tile={canDraw ? game.stock.at(-1) : undefined} indicator={game.indicator} source={{ x: 1074, y: 433, width: 72, height: 96 }} scale={scale} disabled={!canDraw || game.stock.length === 0} reducedMotion={reducedMotion} onStart={touch} onMove={() => {}} onDrop={(point, tapped) => dropDrawnTile(point, tapped)} onFinish={finishDraw} />
      <View style={s.score}><Text style={s.scoreText}>{game.opened[seat] ? '101+' : points}</Text></View>
      <View style={s.sideBoard}><Svg width="100%" height="100%"><Rect width="100%" height="100%" fill="#0b2b3e" />{Array.from({ length: 7 }, (_, i) => <Line key={`v${i}`} x1={i * 32} x2={i * 32} y1={0} y2={520} stroke={i === 3 ? '#91a6a8' : '#285065'} strokeWidth={i === 3 ? 1.3 : 1} />)}{Array.from({ length: 14 }, (_, i) => <Line key={`h${i}`} y1={i * 40} y2={i * 40} x1={0} x2={192} stroke="#285065" />)}</Svg></View>
      <View style={{ position: 'absolute', left: 9, top: 250 }}>{occupied(1) ? <Player person={1} name={playerName(1)} active={game.turn === 1 && !game.ended} vertical gifts={sentGifts[1]} onPress={() => openPlayerProfile(1)} /> : <View style={[s.waitingPlayer, s.waitingVertical]}><Text style={s.waitingPlayerText}>OYUNCU 2{ '\n' }BEKLENİYOR</Text></View>}</View>
      <View style={{ position: 'absolute', right: 9, top: 250 }}>{occupied(2) ? <Player person={2} name={playerName(2)} active={game.turn === 2 && !game.ended} vertical gifts={sentGifts[2]} onPress={() => openPlayerProfile(2)} /> : <View style={[s.waitingPlayer, s.waitingVertical]}><Text style={s.waitingPlayerText}>OYUNCU 3{ '\n' }BEKLENİYOR</Text></View>}</View>
      <DiscardSlot x={28} y={86} tile={game.discards[1].at(-1)} label="Atılan taş" />
      <DiscardSlot x={1486} y={86} tile={game.discards[2].at(-1)} label="Atılan taş" />
      <DiscardSlot x={28} y={548} tile={previousDiscard} label="Yandan al" disabled={Boolean(game.discardLockedTileId && previousDiscard?.id === game.discardLockedTileId)} testID="draw-discard" onPress={() => run(g => draw(g, 'discard'))} />
      <DrawTile tile={canDraw && previousDiscard && previousDiscard.id !== game.discardLockedTileId ? previousDiscard : undefined} indicator={game.indicator} source={{ x: 28, y: 548, width: 72, height: 96 }} scale={scale} disabled={!canDraw || !previousDiscard || previousDiscard.id === game.discardLockedTileId} reducedMotion={reducedMotion} onStart={touch} onMove={() => {}} onDrop={(point, tapped) => dropDrawnTile(point, tapped, 28, 548)} onFinish={finishDiscardDraw} />
      <DiscardSlot x={DISCARD.x} y={DISCARD.y} tile={game.discards[0].at(-1)} label="Buraya at" highlighted={hoverDiscard} testID="discard-target" />
      <View style={s.actions}>
        <BevelButton label="SERİ AÇ" tone="ivory" testID="open-melds" onPress={() => run(g => openMelds(g, melds), 'OPEN', { melds: melds.map(meld => ({ ids: meld.tiles.map(tile => tile.id), kind: meld.kind, score: meld.score })) })} disabled={!myTurn || game.phase !== 'discard'} style={s.meldAction}><SortArt small /></BevelButton>
        <BevelButton label="ÇİFT AÇ" tone="ivory" onPress={() => run(g => openMelds(g, melds), 'OPEN', { melds: melds.map(meld => ({ ids: meld.tiles.map(tile => tile.id), kind: meld.kind, score: meld.score })) })} disabled={!myTurn || game.phase !== 'discard'} style={s.meldAction}><SortArt small pair /></BevelButton>
        <BevelButton label="GERİ TOPLA" tone="ivory" onPress={collectOwnMelds} disabled={!myTurn || game.phase !== 'discard' || !game.opened[seat]} style={s.smallAction} />
        <BevelButton label="TAŞLARI İŞLE" tone="ivory" onPress={() => setGame(g => g ? { ...g, message: 'Istakandan taşı seç, masadaki uygun pere dokun.' } : g)} style={s.smallAction} />
      </View>
      <View style={{ position: 'absolute', left: 632, top: 599, width: 350 }}><Player person={seat} name={profile.name} active={myTurn} /></View>
      <Text accessibilityLiveRegion="polite" style={s.message}>{game.message}</Text>
      <BevelButton label={'ÇİFT\nDİZ'} onPress={() => arrange('number')} style={s.sortLeft}><SortArt pair /></BevelButton>
      <BevelButton label={'SERİ\nDİZ'} onPress={() => arrange('color')} style={s.sortRight}><SortArt /></BevelButton>
      <TileRack hand={hand} slots={slots} scale={scale} selected={selected} indicator={game.indicator} disabled={paused || profilePaused || game.ended} reducedMotion={reducedMotion}
        canDiscard={myTurn && game.phase === 'discard' && !paused} onSelect={id => { setSelected(id === selected ? null : id); touch(); }} onStart={touch} onHoverDiscard={setHoverDiscard}
        onMoveSlot={(id, slot) => setSlots(previous => moveRackSlot(reconcileRack(previous, hand.map(t => t.id)), id, slot))}
        onDiscard={id => { setSelected(null); run(g => discard(g, id), 'DISCARD', { tileId: id }); }} />
      {profileTarget !== null && <View style={s.profileOverlay}>
        <Pressable accessibilityLabel="Profil penceresini kapat" onPress={() => setProfileTarget(null)} style={StyleSheet.absoluteFill} />
        <View style={s.profileCard}>
          <View style={s.profileHeader}>
            <Avatar person={profileTarget} size={64} active />
            <View style={{ flex: 1 }}><Text style={s.profileName}>{NAMES[profileTarget]}</Text><Text style={s.profileId}>{OPPONENT_STATS[profileTarget].id} · çevrimiçi</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Profil penceresini kapat" onPress={() => setProfileTarget(null)} style={s.profileClose}><Text style={s.profileCloseText}>×</Text></Pressable>
          </View>
          <View style={s.statsRow}>
            {[
              ['OYUN', OPPONENT_STATS[profileTarget].games],
              ['KAZANMA', `${Math.round(OPPONENT_STATS[profileTarget].wins / OPPONENT_STATS[profileTarget].games * 100)}%`],
              ['SERI', `${OPPONENT_STATS[profileTarget].streak} el`],
            ].map(([label, value]) => <View key={label} style={s.statCard}><Text style={s.statValue}>{value}</Text><Text style={s.statLabel}>{label}</Text></View>)}
          </View>
          <Text style={s.profileLevel}>{OPPONENT_STATS[profileTarget].level} · masadaki oyuncu</Text>
          <Button onPress={sendFriendRequest} disabled={friendRequests.has(profileTarget)} style={{ marginTop: 17 }} compact>{friendRequests.has(profileTarget) ? 'İSTEK GÖNDERİLDİ' : 'ARKADAŞLIK İSTEĞİ GÖNDER'}</Button>
          <Text style={s.giftTitle}>COIN İLE HEDİYE GÖNDER</Text>
          <View style={s.giftTabs}>{([2, 3, 5, 24] as GiftHours[]).map(hours => <Pressable key={hours} accessibilityRole="button" accessibilityState={{ selected: giftCategory === hours }} onPress={() => setGiftCategory(hours)} style={[s.giftTab, giftCategory === hours && s.giftTabActive]}><Text style={[s.giftTabText, giftCategory === hours && s.giftTabTextActive]}>{hours}s</Text></Pressable>)}</View>
          <Text style={s.giftCategoryTitle}>{giftCategory} SAATLİK HEDİYELER · {GIFT_CATALOG[giftCategory].length} SEÇENEK</Text>
          <ScrollView style={s.giftScroll} contentContainerStyle={s.giftGrid}>{GIFT_CATALOG[giftCategory].map(offer => <Pressable key={offer.id} accessibilityRole="button" accessibilityLabel={`${offer.title}, ${offer.hours} saatlik hediye, ${offer.cost} coin`} onPress={() => sendGift(offer)} style={({ pressed }) => [s.giftOption, pressed && { transform: [{ scale: .97 }], opacity: .86 }]}>
            <View style={[s.giftIcon, { backgroundColor: `${offer.tone}28`, borderColor: `${offer.tone}88` }]}><Text style={s.giftEmoji}>{offer.emoji}</Text></View>
            <View style={{ flex: 1 }}><Text style={s.giftHours}>{offer.title}</Text><View style={s.giftCost}><Coin size={16} /><Text style={s.giftCostText}>{offer.cost}</Text></View></View>
          </Pressable>)}</ScrollView>
          {sentGifts[profileTarget]?.length ? <View style={s.sentGiftRow}><Text style={s.sentGiftLabel}>GÖNDERİLEN</Text><View style={s.sentGiftPills}>{sentGifts[profileTarget]!.slice(-5).map((gift, index) => <View key={`${gift.sentAt}-${index}`} style={s.sentGiftPill}><Text style={s.sentGiftEmoji}>{gift.emoji}</Text><Text style={s.sentGiftText}>{gift.hours}s</Text></View>)}</View></View> : null}
          {!!profileNotice && <Text accessibilityLiveRegion="polite" style={s.profileNotice}>{profileNotice}</Text>}
        </View>
      </View>}
      {game.ended && <View style={s.resultOverlay}><View style={s.scoreboard}><View style={s.scoreboardHeader}><View><Text style={s.scoreboardEyebrow}>EL SONUCU</Text><Text style={s.scoreboardTitle}>Oyun sonucu</Text></View><Trophy size={32} color="#f4d66e" /></View><Text style={s.resultCountdown}>{resultCountdown} SANİYE İÇİNDE YENİ OYUN BAŞLAYACAK</Text><View style={s.scoreRows}>{[0, 1, 2, 3].map(player => { const rowName = player === seat ? profile.name : playerName(player); const playerScore = roundScores[player] ?? 0; const winner = game.winner === player; return <View key={player} style={[s.scoreRow, player === seat && s.scoreRowMine]}><Avatar person={player} size={50} active={winner} /><View style={s.scorePlayerInfo}><Text style={s.scorePlayerName}>{rowName}</Text><View style={s.scoreMeta}><Coin size={16} /><Text style={s.scoreMetaText}>{playerScore < 0 ? `+${Math.abs(playerScore)}` : playerScore}</Text></View></View><Text style={[s.scoreResult, winner && s.scoreResultWinner]}>{winner ? 'KAZANAN' : playerScore}</Text></View>; })}</View></View></View>}
    </View>
  </View>;
}
const s = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden', backgroundColor: '#061d2a' }, stage: { position: 'absolute', width: W, height: H, overflow: 'hidden' }, frame: { ...StyleSheet.absoluteFill, borderWidth: 5, borderColor: '#082a3ac0' },
  wallet: { position: 'absolute', left: 24, top: 12, width: 177, height: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 9, borderWidth: 1, borderColor: '#57899a', backgroundColor: '#062737cc', paddingHorizontal: 9 }, walletText: { color: '#fff9e8', fontFamily: F.extra, fontSize: 28 }, onlineRoom: { position: 'absolute', left: 466, top: 12, minWidth: 112, height: 52, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: '#5fa4b2', backgroundColor: '#062737cc', alignItems: 'center', justifyContent: 'center' }, onlineRoomLabel: { color: '#9ccbd0', fontFamily: F.bold, fontSize: 8, letterSpacing: 1.2 }, onlineRoomId: { color: '#fff4ae', fontFamily: F.extra, fontSize: 16, letterSpacing: 2, marginTop: 3 },
  timer: { position: 'absolute', left: 220, top: 12, width: 230, height: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: '#529587', backgroundColor: '#082e3fd9' }, timerTrack: { height: 5, borderRadius: 4, backgroundColor: '#405e68' }, timerFill: { height: 5, borderRadius: 4, backgroundColor: '#d0e66a' }, timerText: { color: '#e0efcf', fontFamily: F.bold, fontSize: 10, letterSpacing: 1.4 },
  bevel: { position: 'absolute', borderRadius: 13, borderWidth: 2, borderColor: '#91accb', borderBottomWidth: 5, borderBottomColor: '#071d35', alignItems: 'center', justifyContent: 'center', gap: 5, ...elevation(5, .3) }, buttonGlint: { position: 'absolute', left: 3, right: 3, top: 2, height: '42%', borderRadius: 8, backgroundColor: '#ffffff0b', borderTopWidth: 1, borderColor: '#ffffff55' }, buttonText: { fontFamily: F.extra, fontSize: 19, color: '#fffdf3', textAlign: 'center', lineHeight: 28, textShadowColor: '#071729', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  player: { height: 59, borderRadius: 11, borderWidth: 2, borderColor: '#425364', padding: 4, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', gap: 12, ...elevation(3, .3) }, activePlayer: { borderColor: '#e5cb5e', ...elevation(5, .35) }, verticalPlayer: { width: 61, height: 260, flexDirection: 'column', paddingHorizontal: 3, paddingTop: 5 }, playerName: { fontFamily: F.bold, fontSize: 24, color: '#f6f2e7' }, waitingPlayer: { height: 59, borderRadius: 11, borderWidth: 1, borderColor: '#5c8a95', borderStyle: 'dashed', backgroundColor: '#082c3b99', alignItems: 'center', justifyContent: 'center', padding: 10 }, waitingVertical: { width: 61, height: 260 }, waitingPlayerText: { color: '#a9cbd0', fontFamily: F.bold, fontSize: 9, letterSpacing: 1, textAlign: 'center', lineHeight: 15 }, giftsOnBand: { zIndex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 3 }, verticalGiftsOnBand: { position: 'absolute', bottom: 9, left: 17, flexDirection: 'column', gap: 2, paddingRight: 0 }, giftBadge: { minWidth: 30, height: 21, paddingHorizontal: 3, borderRadius: 6, borderWidth: 1, backgroundColor: '#1c2a35e8', flexDirection: 'row', gap: 2, alignItems: 'center', justifyContent: 'center' }, giftBadgeEmoji: { fontSize: 10 }, giftBadgeText: { color: '#fff1b7', fontFamily: F.bold, fontSize: 8 }, waitingBanner: { position: 'absolute', left: 470, top: 67, width: 390, minHeight: 50, borderRadius: 17, borderWidth: 1, borderColor: '#9fc8a566', backgroundColor: '#082d40ee', alignItems: 'center', justifyContent: 'center', zIndex: 20, flexDirection: 'row', gap: 12, paddingHorizontal: 12 }, waitingBannerCopy: { flex: 1, alignItems: 'center' }, waitingBannerText: { color: '#d8e9c7', fontFamily: F.bold, fontSize: 10, letterSpacing: 1, textAlign: 'center' }, waitingBannerNote: { color: '#f2d477', fontFamily: F.bold, fontSize: 8, letterSpacing: 1, marginTop: 3 }, botCallButton: { minHeight: 38, borderRadius: 10, paddingHorizontal: 10, backgroundColor: '#d8eaa9', flexDirection: 'row', alignItems: 'center', gap: 5 }, botCallButtonText: { color: '#16271d', fontFamily: F.extra, fontSize: 9, letterSpacing: .6 },
  mainBoard: { position: 'absolute', left: 200, top: 80, width: 840, height: 520 }, badges: { position: 'absolute', left: 1054, top: 80, width: 108, gap: 7 }, badge: { height: 45, borderRadius: 8, borderWidth: 1, borderColor: '#082f43', justifyContent: 'center', alignItems: 'center' }, badgeText: { fontFamily: F.bold, fontSize: 19, color: '#f2f4e6' },
  indicator: { position: 'absolute', left: 1067, top: 296, padding: 7, borderWidth: 2, borderColor: '#4e91a5', borderRadius: 9, backgroundColor: '#082d40' }, stock: { position: 'absolute', left: 1067, top: 426, padding: 7, borderWidth: 2, borderColor: '#4e91a5', borderRadius: 9, backgroundColor: '#082d40' }, stockCount: { position: 'absolute', bottom: 12, alignSelf: 'center', borderWidth: 2, borderColor: '#fff', backgroundColor: '#d3d8d5', borderRadius: 20, minWidth: 38, height: 38, alignItems: 'center', justifyContent: 'center' }, stockText: { fontFamily: F.bold, color: '#182a33', fontSize: 25 },
  score: { position: 'absolute', left: 1061, top: 612, width: 94, height: 42, borderRadius: 14, borderWidth: 2, borderColor: '#aacbeb', borderBottomWidth: 4, backgroundColor: '#254983', alignItems: 'center', justifyContent: 'center' }, scoreText: { fontFamily: F.extra, color: '#fff', fontSize: 28 }, sideBoard: { position: 'absolute', left: 1176, top: 80, width: 192, height: 520, borderRadius: 7, overflow: 'hidden', borderWidth: 1, borderColor: '#2b5d6d' },
  discardSlot: { position: 'absolute', width: 92, height: 104, borderRadius: 10, borderWidth: 2, borderColor: '#31748a', backgroundColor: '#073044b5', alignItems: 'center', justifyContent: 'center', gap: 6 }, discardHighlighted: { borderColor: '#eeef8b', backgroundColor: '#617c39', ...elevation(9, .3) }, discardDisabled: { opacity: .48, borderColor: '#6f8490' }, slotLabel: { fontFamily: F.bold, fontSize: 11, color: '#a2c9cf' }, lockedLabel: { position: 'absolute', bottom: 4, color: '#e8d58e', fontFamily: F.bold, fontSize: 7, letterSpacing: 1 },
  actions: { position: 'absolute', left: 1384, top: 202, width: 132, gap: 12 }, meldAction: { position: 'relative', width: 132, height: 83 }, smallAction: { position: 'relative', width: 132, height: 53 }, message: { position: 'absolute', left: 200, top: 613, width: 418, height: 40, fontFamily: F.medium, color: '#d0e9e7', fontSize: 12, textAlign: 'center', textAlignVertical: 'center' }, sortLeft: { left: 23, top: 665, width: 90, height: 217 }, sortRight: { right: 23, top: 665, width: 90, height: 217 },
  profileOverlay: { ...StyleSheet.absoluteFill, zIndex: 120, backgroundColor: '#041522d9', alignItems: 'center', justifyContent: 'center', padding: 20 }, profileCard: { width: 520, maxWidth: '92%', maxHeight: '92%', borderRadius: 20, borderWidth: 2, borderColor: '#6794a4', backgroundColor: '#102d40', padding: 24, ...elevation(12, .5) }, profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 15 }, profileName: { color: '#fff7df', fontFamily: F.extra, fontSize: 27 }, profileId: { color: '#9fc0c9', fontFamily: F.medium, fontSize: 11, marginTop: 5 }, profileClose: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#8ab2bd66', alignItems: 'center', justifyContent: 'center' }, profileCloseText: { color: '#d8e8e5', fontSize: 26, lineHeight: 27, fontFamily: F.medium }, statsRow: { flexDirection: 'row', gap: 9, marginTop: 22 }, statCard: { flex: 1, minHeight: 67, borderRadius: 11, borderWidth: 1, borderColor: '#467488', backgroundColor: '#0a2434', alignItems: 'center', justifyContent: 'center' }, statValue: { color: '#f0d36b', fontFamily: F.extra, fontSize: 21 }, statLabel: { color: '#90b5bd', fontFamily: F.bold, fontSize: 8, letterSpacing: 1.2, marginTop: 4 }, profileLevel: { color: '#b7d2d4', fontFamily: F.medium, fontSize: 11, textAlign: 'center', marginTop: 12 }, giftTitle: { color: '#e8d38a', fontFamily: F.bold, fontSize: 10, letterSpacing: 1.5, marginTop: 22, marginBottom: 10 }, giftTabs: { flexDirection: 'row', gap: 7, marginBottom: 8 }, giftTab: { flex: 1, minHeight: 31, borderRadius: 8, borderWidth: 1, borderColor: '#528092', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a2535' }, giftTabActive: { backgroundColor: '#477648', borderColor: '#b5d58a' }, giftTabText: { color: '#9dbcc1', fontFamily: F.bold, fontSize: 11 }, giftTabTextActive: { color: '#f6f1d1' }, giftCategoryTitle: { color: '#90b5bd', fontFamily: F.bold, fontSize: 9, letterSpacing: 1.2, marginBottom: 7 }, giftScroll: { maxHeight: 335 }, giftGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, paddingBottom: 2 }, giftOption: { width: '48%', minHeight: 65, borderRadius: 11, borderWidth: 1, borderColor: '#528092', backgroundColor: '#0a2535', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 9 }, giftIcon: { width: 38, height: 38, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, giftEmoji: { fontSize: 21 }, giftHours: { color: '#fff6df', fontFamily: F.bold, fontSize: 12 }, giftCost: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }, giftCostText: { color: '#ecc66e', fontFamily: F.extra, fontSize: 12 }, sentGiftRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, paddingTop: 13, borderTopWidth: 1, borderTopColor: '#46748866' }, sentGiftLabel: { color: '#8eb5bc', fontFamily: F.bold, fontSize: 9, letterSpacing: 1 }, sentGiftPills: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, sentGiftPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 7, backgroundColor: '#2c4a45' }, sentGiftEmoji: { fontSize: 12 }, sentGiftText: { color: '#f1d276', fontFamily: F.bold, fontSize: 10 }, profileNotice: { color: '#d9edb0', fontFamily: F.medium, textAlign: 'center', fontSize: 11, marginTop: 14 }, startOverlay: { ...StyleSheet.absoluteFill, zIndex: 140, backgroundColor: '#041522c7', alignItems: 'center', justifyContent: 'center', padding: 20 }, startModal: { width: 620, minHeight: 310, borderRadius: 17, borderWidth: 2, borderColor: '#83baf1', backgroundColor: '#172749', alignItems: 'center', justifyContent: 'center', padding: 28, ...elevation(12, .5) }, startIcon: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#c5d9f0', backgroundColor: '#0c1834', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }, startEyebrow: { color: '#a4c0dd', fontFamily: F.bold, fontSize: 11, letterSpacing: 2.3 }, startTitle: { color: '#fff9e7', fontFamily: F.extra, fontSize: 31, marginTop: 7 }, startNumber: { color: '#f3d875', fontFamily: F.extra, fontSize: 76, lineHeight: 86, marginTop: 3 }, startPlayers: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 13, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#0b1c35', borderWidth: 1, borderColor: '#5a789c' }, startPlayersText: { color: '#b6d8d0', fontFamily: F.bold, fontSize: 11, letterSpacing: .5 },
  resultOverlay: { ...StyleSheet.absoluteFill, zIndex: 100, backgroundColor: '#051326df', alignItems: 'center', justifyContent: 'center', padding: 18 }, scoreboard: { width: 760, maxWidth: '92%', borderRadius: 18, borderWidth: 2, borderColor: '#88bdf2', backgroundColor: '#18284a', padding: 22, ...elevation(14, .55) }, scoreboardHeader: { minHeight: 58, borderRadius: 12, backgroundColor: '#263b6b', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 }, scoreboardEyebrow: { color: '#a8bfdf', fontFamily: F.bold, fontSize: 10, letterSpacing: 2 }, scoreboardTitle: { color: '#fff9e8', fontFamily: F.extra, fontSize: 28, marginTop: 2, textTransform: 'uppercase' }, resultCountdown: { color: '#80f034', fontFamily: F.extra, fontSize: 17, textAlign: 'center', marginVertical: 17, letterSpacing: .7 }, scoreRows: { gap: 8 }, scoreRow: { minHeight: 76, borderRadius: 3, backgroundColor: '#0e172d', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 13 }, scoreRowMine: { backgroundColor: '#1d60dd' }, scorePlayerInfo: { flex: 1 }, scorePlayerName: { color: '#fff8e8', fontFamily: F.extra, fontSize: 19 }, scoreMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }, scoreMetaText: { color: '#f2cb6c', fontFamily: F.bold, fontSize: 15 }, scoreResult: { minWidth: 90, color: '#fff8e8', fontFamily: F.extra, fontSize: 22, textAlign: 'right' }, scoreResultWinner: { color: '#65ed1e', fontSize: 16 }, result: { width: 450, padding: 35, gap: 16, borderRadius: 20, borderWidth: 1, borderColor: '#6e91a5', backgroundColor: '#12374c' }, resultTitle: { color: '#fff7df', fontFamily: F.extra, fontSize: 32 }, resultCopy: { color: '#b8d1d8', fontSize: 17 }, matchScoreText: { color: '#f0d36b', fontFamily: F.bold, fontSize: 12, letterSpacing: 1.2 },
});
