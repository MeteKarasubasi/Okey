import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions, Modal, ScrollView, Platform, BackHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { Fraunces_600SemiBold, Fraunces_500Medium_Italic } from '@expo-google-fonts/fraunces';
import { ArrowRight, Bell, Check, ChevronDown, CircleHelp, Coffee, Gift, House, LayoutGrid, Leaf, Plus, RotateCw, Settings, ShieldCheck, Sparkles, Trophy, Users, X } from 'lucide-react-native';
import { C, F } from './src/theme';
import { Avatar, Button, Coin, IconButton, Label, Logo } from './src/components/UI';
import Lobby, { Page, Room, ROOMS } from './src/screens/Lobby';
import GameScreen from './src/screens/GameScreen';
import AuthScreen from './src/screens/AuthScreen';
import { Game, Mode, newGame } from './src/game/engine';
import { Profile, todayKey, useProfile } from './src/storage';
import { useAuth } from './src/auth';
import { supabaseConfigured } from './src/supabase';

const NAV = [
  { page: 'lobby' as Page, title: 'Lobi', icon: House },
  { page: 'tables' as Page, title: 'Oyun masaları', short: 'Masalar', icon: LayoutGrid },
  { page: 'stats' as Page, title: 'İstatistiklerim', short: 'İstatistik', icon: Trophy },
  { page: 'collection' as Page, title: 'Koleksiyon', icon: Sparkles },
];
export default function App() {
  const { width, height } = useWindowDimensions();
  const desktop = width >= 1024;
  const needsRotation = width < 900 && width < height;
  const [fontsLoaded, fontError] = useFonts({ Manrope_400Regular, Manrope_500Medium, Manrope_700Bold, Manrope_800ExtraBold, Fraunces_600SemiBold, Fraunces_500Medium_Italic });
  const auth = useAuth();
  const { profile, setProfile, ready, storageError } = useProfile(auth.user?.id);
  const [page, setPage] = useState<Page>('lobby');
  const [game, setGame] = useState<Game | null>(null);
  const [room, setRoom] = useState<Room>(ROOMS[0]);
  const [modal, setModal] = useState<'custom' | 'bonus' | 'exit' | 'help' | 'notifications' | null>(null);
  const [customMode, setCustomMode] = useState<Mode>('classic');
  const [customTheme, setCustomTheme] = useState<Profile['theme']>('green');
  const recorded = useRef(false);
  const update = (patch: Partial<Profile>) => setProfile(current => ({ ...current, ...patch }));
  const start = (newRoom: Room) => { recorded.current = false; setRoom(newRoom); setGame(newGame(newRoom.mode)); setModal(null); };
  const exit = () => { if (game?.ended) { setGame(null); setPage('lobby'); } else setModal('exit'); };
  const navigate = (next: Page) => { setPage(next); };
  useEffect(() => {
    if (game?.ended && !recorded.current) {
      recorded.current = true;
      setProfile(p => ({ ...p, games: p.games + 1, wins: p.wins + (game.winner === 0 ? 1 : 0), coins: p.coins + (game.winner === 0 ? room.reward : 0) }));
    }
  }, [game?.ended]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.title = game ? `${room.title} · Keyif 101` : 'Keyif 101 · Bir el daha?';
    document.documentElement.lang = 'tr';
  }, [game !== null, room.title]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (modal) { setModal(null); return true; }
      if (game) { exit(); return true; }
      if (page !== 'lobby') { setPage('lobby'); return true; }
      return false;
    }); return () => sub.remove();
  }, [modal, game, page]);
  const claim = () => { if (profile.lastBonus !== todayKey()) { setProfile(p => p.lastBonus === todayKey() ? p : { ...p, coins: p.coins + 750, lastBonus: todayKey() }); setModal('bonus'); } };
  if ((!fontsLoaded && !fontError) || !ready || auth.loading) return <SafeAreaProvider><View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: C.text, fontSize: 36, fontFamily: 'Georgia' }}>keyif.</Text><Text style={{ color: C.muted, marginTop: 15 }}>Taşlar hazırlanıyor…</Text></View></SafeAreaProvider>;
  if (supabaseConfigured && !auth.user) return <SafeAreaProvider><StatusBar style="light" /><AuthScreen auth={auth} /></SafeAreaProvider>;
  if (needsRotation && !game) return <SafeAreaProvider><SafeAreaView style={s.safe} edges={['top', 'bottom', 'left', 'right']}><StatusBar style="light" /><View style={s.rotateGate}><View style={s.rotateIcon}><RotateCw size={38} color={C.gold} strokeWidth={1.4} /></View><Text style={s.rotateTitle}>Telefonu çevir.</Text><Text style={s.rotateCopy}>Keyif 101 yatay ekranda oynanır.{ '\n' }Taşlarını daha rahat görmen için ekranı döndür.</Text><View style={s.rotateRule}><Text style={s.rotateRuleText}>YATAY OYUN · DAHA FERAH MASA · DAHA RAHAT OYUN</Text></View></View></SafeAreaView></SafeAreaProvider>;
  return <SafeAreaProvider><SafeAreaView style={s.safe} edges={['top', 'bottom', 'left', 'right']}><StatusBar style="light" />
    {game ? <GameScreen game={game} setGame={setGame} profile={profile} room={room} onExit={exit} onHelp={() => setModal('help')} onReplay={() => start(room)} paused={modal !== null || needsRotation} /> : <View style={{ flex: 1, flexDirection: 'row' }}>
      {desktop && <View style={s.sidebar}><View style={{ paddingLeft: 8, marginBottom: 49 }}><Logo /></View><Label style={{ paddingLeft: 17, marginBottom: 16, fontSize: 8 }} color="#8fa596">OYUN ALANI</Label><View style={{ gap: 8 }}>{NAV.map(item => { const Icon = item.icon; return <Pressable key={item.page} accessibilityRole="button" accessibilityState={{ selected: page === item.page }} onPress={() => navigate(item.page)} style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [s.navItem, page === item.page && s.navActive, hovered && page !== item.page && { backgroundColor: '#ffffff05' }, pressed && { opacity: .7 }]}><Icon size={19} strokeWidth={1.7} color={page === item.page ? C.green : C.muted} /><Text style={[s.navText, page === item.page && { color: C.green }]}>{item.title}</Text>{page === item.page && <View style={{ width: 5, height: 5, backgroundColor: C.green, borderRadius: 5, marginLeft: 'auto' }} />}</Pressable>; })}</View>
        <View style={s.sideCard}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}><Coffee size={20} strokeWidth={1.4} color={C.gold} /><Text style={{ color: C.text, fontFamily: F.serif, fontSize: 20 }}>Senin masan.</Text></View><Text style={{ color: C.muted, fontFamily: F.regular, fontSize: 11, lineHeight: 19, marginTop: 12, marginBottom: 18 }}>Kuralları sen seç,{ '\n' }biz taşları dağıtalım.</Text><Button onPress={() => { setCustomTheme(profile.theme); setModal('custom'); }} secondary compact icon={<Plus size={15} color={C.text} />}>Masa oluştur</Button></View>
        <View style={{ marginTop: 'auto', gap: 3 }}><Pressable accessibilityRole="button" onPress={() => navigate('rules')} style={s.navItem}><CircleHelp size={18} color={C.muted} /><Text style={s.navText}>Nasıl oynanır?</Text></Pressable><Pressable accessibilityRole="button" onPress={() => navigate('settings')} style={s.navItem}><Settings size={18} color={C.muted} /><Text style={s.navText}>Ayarlar</Text></Pressable></View><View style={s.sideFooter}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.green }} /><Text style={{ color: '#92ab9a', fontSize: 9, fontFamily: F.medium }}>Keyif her zaman yanında.</Text></View>
      </View>}
      <View style={{ flex: 1, minWidth: 0 }}><View style={[s.header, !desktop && { paddingHorizontal: 22, height: 80 }]}>{desktop ? <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><View style={s.headerMark}><Leaf size={20} color={C.green} strokeWidth={1.5} /></View><View><Text style={{ color: C.text, fontFamily: F.bold, fontSize: 12 }}>Keyif Kulübü</Text><Text style={{ color: C.muted, fontFamily: F.regular, fontSize: 10, marginTop: 4 }}>Güzel oyunların buluşma noktası.</Text></View></View> : <Logo small />}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: desktop ? 18 : 9 }}><Pressable accessibilityRole="button" accessibilityLabel={`${profile.coins} çip. Günlük hediyeyi görüntüle`} onPress={() => profile.lastBonus === todayKey() ? setModal('notifications') : claim()} style={s.wallet}><Coin size={23} /><Text style={{ color: C.gold, fontFamily: F.extra, fontSize: 13 }}>{profile.coins.toLocaleString('tr-TR')}</Text>{desktop && <View style={{ backgroundColor: '#e8bd731c', padding: 3, borderRadius: 5 }}><Plus size={13} color={C.gold} /></View>}</Pressable>{desktop && <IconButton label="Bildirimler" icon={<Bell size={18} color={C.muted} />} onPress={() => setModal('notifications')} />}{desktop && <View style={{ height: 30, width: 1, backgroundColor: C.border }} />}<Pressable accessibilityRole="button" accessibilityLabel="Profil ve ayarlar" onPress={() => navigate('settings')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Avatar size={desktop ? 40 : 35} />{desktop && <><View><Text style={{ color: C.text, fontFamily: F.bold, fontSize: 12 }}>{profile.name}</Text><Text style={{ color: C.muted, fontFamily: F.medium, fontSize: 9, marginTop: 3 }}>Keyifli oyuncu</Text></View><ChevronDown size={14} color={C.muted} /></>}</Pressable></View>
      </View>{storageError && <Text accessibilityLiveRegion="polite" style={{ color: C.gold, fontFamily: F.medium, paddingHorizontal: 22, paddingTop: 8, fontSize: 11 }}>Bu cihazda kayıt yapılamadı. İlerlemen yalnızca bu oturumda tutuluyor.</Text>}<Lobby key={page} page={page} profile={profile} update={update} onStart={r => start({ ...r, theme: r.title === 'Klasik masa' ? profile.theme : r.theme })} navigate={navigate} onCustom={() => { setCustomTheme(profile.theme); setModal('custom'); }} onBonus={claim} onSignOut={auth.signOut} />
      {!desktop && <View style={s.bottomNav}>{NAV.map(item => { const Icon = item.icon; return <Pressable key={item.page} accessibilityRole="button" accessibilityState={{ selected: page === item.page }} onPress={() => navigate(item.page)} style={s.bottomItem}><Icon size={20} strokeWidth={page === item.page ? 2.2 : 1.5} color={page === item.page ? C.green : '#99afa0'} /><Text style={{ fontFamily: page === item.page ? F.bold : F.medium, fontSize: 9, color: page === item.page ? C.green : '#99afa0', marginTop: 5 }}>{item.short ?? item.title}</Text>{page === item.page && <View style={{ position: 'absolute', top: 0, height: 2, width: 22, borderRadius: 2, backgroundColor: C.green }} />}</Pressable>; })}</View>}
      </View>
    </View>}
    {game && needsRotation && <View style={[StyleSheet.absoluteFill, { zIndex: 60 }]}><View style={s.rotateGate}><View style={s.rotateIcon}><RotateCw size={38} color={C.gold} /></View><Text style={s.rotateTitle}>Telefonu çevir.</Text><Text style={s.rotateCopy}>Keyif 101 yatay ekranda oynanır.{ '\n' }Taşlarının yerini senin için koruduk.</Text></View></View>}
    <Modal visible={modal !== null} transparent animationType="fade" onRequestClose={() => setModal(null)}><View style={s.scrim}><Pressable accessibilityLabel="Pencereyi kapat" onPress={() => setModal(null)} style={StyleSheet.absoluteFill} /><View style={[s.modal, modal === 'help' && { maxWidth: 600 }]} accessibilityViewIsModal><View style={{ position: 'absolute', right: 14, top: 14, zIndex: 2 }}><IconButton label="Kapat" icon={<X color={C.muted} size={18} />} onPress={() => setModal(null)} /></View>
      <ScrollView contentContainerStyle={{ padding: 28, paddingTop: 38 }}>
      {modal === 'custom' && <><Label color={C.gold}>SENİN MASAN, SENİN KEYFİN</Label><Text style={s.modalTitle}>Taşları dağıtalım.</Text><Text style={s.modalDescription}>Üç bot sana eşlik edecek. Masa ayarlarını seç ve oyuna başla.</Text><Label style={{ marginTop: 24 }}>OYUN TÜRÜ</Label><View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>{(['classic', 'pairs'] as Mode[]).map(mode => <Button key={mode} secondary={customMode !== mode} style={{ flex: 1 }} onPress={() => setCustomMode(mode)} compact>{mode === 'classic' ? 'Klasik 101' : '5 çift'}</Button>)}</View><Label style={{ marginTop: 24 }}>MASA RENGİ</Label><View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>{(['green', 'blue', 'plum'] as const).map((theme, i) => <Pressable accessibilityRole="button" accessibilityLabel={['Yeşil keçe', 'Gece mavisi', 'Mürdüm'][i]} accessibilityState={{ selected: customTheme === theme }} key={theme} onPress={() => setCustomTheme(theme)} style={{ flex: 1, height: 60, backgroundColor: ['#3c634c', '#33586a', '#624554'][i], borderRadius: 12, borderWidth: 2, borderColor: customTheme === theme ? C.gold : '#ffffff15', alignItems: 'center', justifyContent: 'center' }}>{customTheme === theme && <Check color={C.gold} size={20} />}</Pressable>)}</View><Text style={[s.modalDescription, { fontSize: 11, marginVertical: 20 }]}>Giriş ücretsiz · Tek el · Kazanana +{customMode === 'pairs' ? 750 : 500} çip</Text><Button icon={<ArrowRight color={C.ink} size={18} />} onPress={() => start({ ...ROOMS[customMode === 'pairs' ? 1 : 0], theme: customTheme, title: 'Benim masam' })}>Masayı aç</Button></>}
      {modal === 'bonus' && <View style={{ alignItems: 'center', paddingTop: 15 }}><Gift size={42} color={C.gold} /><Text style={s.modalTitle}>Bugün şanslı günün.</Text><Text style={[s.modalDescription, { textAlign: 'center' }]}>Günlük hediyen cüzdanına eklendi.{ '\n' }Yarın yine uğra!</Text><View style={{ marginVertical: 25, flexDirection: 'row', alignItems: 'center', gap: 13 }}><Coin size={43} /><Text style={{ fontFamily: F.serif, color: C.gold, fontSize: 42 }}>+750</Text></View><Button onPress={() => setModal(null)} style={{ width: '100%' }}>Teşekkürler!</Button></View>}
      {modal === 'exit' && <><Coffee size={31} color={C.gold} /><Text style={s.modalTitle}>Küçük bir mola mı?</Text><Text style={[s.modalDescription, { marginBottom: 25 }]}>Lobiye dönersen bu el kapanır. Tamamlanmamış el istatistiklerine eklenmez.</Text><Button onPress={() => setModal(null)}>Oyuna dön</Button><Button secondary style={{ marginTop: 10 }} onPress={() => { setGame(null); setModal(null); setPage('lobby'); }}>Lobiye dön</Button></>}
      {modal === 'help' && <><Label color={C.gold}>MASA REHBERİ</Label><Text style={s.modalTitle}>Keyifle oyna.</Text>{[
        ['1. Taş çek', 'İlk elde 22 taşın var; birini atarak başla. Sonraki ellerde kapalı taşı tutup ıstakaya sürükle; kısa dokunuşta taş ilk boş slota gelir.'],
        ['2. Perlerini kur', 'Aynı renkte ardışık 3+ taş veya aynı sayının 3–4 farklı rengi bir perdir. Seri diz ve Çift diz ıstakanı sıralar.'],
        ['3. Elini aç', 'Per aç, toplamı en az 101 olan perlerini açar. Çift masasında 5 çift gerekir. Gösterge +1 okeydir; yıldızlı sahte okey onun renk ve sayısını taşır.'],
        ['4. Taşları sürükle', 'Sıra kimde olursa olsun taşlarını tutup ıstakanın iki sırasında düzenleyebilirsin. Turunu bitirmek için taşı sağ alttaki atma kutusuna sürükle. Açtıktan sonra bir taş seçip uygun pere dokunarak işle.'],
        ['5. Son taşı bitir', 'Son taşını atınca kazanırsın. Kazanan −101, açmayan 202, açan eldeki taş toplamını yazar. İşlek cezaları, katlama ve bitiş çarpanları yoktur.'],
      ].map(([title, description]) => <View key={title} style={{ marginTop: 20 }}><Text style={{ fontFamily: F.bold, color: C.text, fontSize: 13 }}>{title}</Text><Text style={[s.modalDescription, { marginTop: 7, fontSize: 12 }]}>{description}</Text></View>)}<Button onPress={() => setModal(null)} style={{ marginTop: 27 }}>Anladım, devam edelim</Button></>}
      {modal === 'notifications' && <><Bell size={30} color={C.gold} /><Text style={s.modalTitle}>Kulüpten haberler.</Text><View style={{ padding: 18, backgroundColor: C.sidebar, borderRadius: 12, marginTop: 10 }}><Text style={{ color: C.text, fontFamily: F.bold, fontSize: 13 }}>Keyif’e hoş geldin!</Text><Text style={[s.modalDescription, { marginTop: 7, fontSize: 12 }]}>Masalar hazır, girişler ücretsiz. Günlük hediyeni almayı unutma.</Text></View><Button onPress={profile.lastBonus === todayKey() ? () => setModal(null) : claim} style={{ marginTop: 20 }}>{profile.lastBonus === todayKey() ? 'Hediyem alındı, tamam' : '750 çip hediyemi al'}</Button></>}
      </ScrollView>
    </View></View></Modal>
  </SafeAreaView></SafeAreaProvider>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  sidebar: { width: 220, backgroundColor: C.sidebar, borderRightWidth: 1, borderRightColor: '#29453a', paddingHorizontal: 18, paddingTop: 37, paddingBottom: 20 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 16, minHeight: 47, borderRadius: 10 },
  navActive: { backgroundColor: '#b4cf9713', borderWidth: 1, borderColor: '#b4cf971c' },
  navText: { fontFamily: F.medium, color: C.muted, fontSize: 12 },
  sideCard: { padding: 18, borderWidth: 1, borderColor: '#345044', backgroundColor: '#1b382e', borderRadius: 15, marginTop: 36, marginBottom: 40 },
  sideFooter: { flexDirection: 'row', alignItems: 'center', gap: 7, borderTopWidth: 1, borderTopColor: '#284336', paddingTop: 20, marginTop: 18, paddingLeft: 10 },
  header: { height: 87, paddingHorizontal: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#29483c' },
  headerMark: { width: 38, height: 38, backgroundColor: '#c1d9a010', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  wallet: { minHeight: 39, flexDirection: 'row', gap: 9, alignItems: 'center', borderWidth: 1, borderColor: '#e8bd7324', backgroundColor: '#e8bd7308', borderRadius: 10, paddingHorizontal: 10 },
  bottomNav: { flexDirection: 'row', backgroundColor: C.sidebar, borderTopWidth: 1, borderTopColor: C.border },
  bottomItem: { flex: 1, minHeight: 65, alignItems: 'center', justifyContent: 'center' },
  scrim: { flex: 1, backgroundColor: '#051b16d9', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: C.panel, width: '100%', maxWidth: 450, maxHeight: '90%', borderWidth: 1, borderColor: '#57745f', borderRadius: 24, overflow: 'hidden' },
  modalTitle: { fontFamily: F.serif, fontSize: 32, letterSpacing: -1, color: C.text, marginTop: 19, marginBottom: 12 },
  modalDescription: { fontFamily: F.regular, color: C.muted, fontSize: 13, lineHeight: 22 },
  rotateGate: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: C.bg },
  rotateIcon: { width: 76, height: 76, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8bd7310', borderWidth: 1, borderColor: '#e8bd7330', transform: [{ rotate: '-18deg' }] },
  rotateTitle: { fontFamily: F.serif, color: C.text, fontSize: 34, marginTop: 24 },
  rotateCopy: { fontFamily: F.regular, color: C.muted, fontSize: 13, lineHeight: 22, textAlign: 'center', marginTop: 10 },
  rotateRule: { marginTop: 24, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  rotateRuleText: { fontFamily: F.bold, fontSize: 8, color: C.green, letterSpacing: 1.2 },
});
