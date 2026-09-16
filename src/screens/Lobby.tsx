import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, ArrowUpRight, Check, ChevronRight, Clock3, Coffee, Gift, Layers3, Leaf, Moon, Plus, Settings2, ShieldCheck, Sparkles, Trophy, Users, X, Zap } from 'lucide-react-native';
import { C, F, elevation } from '../theme';
import { Button, Avatar, Coin, Label, OkeyTile, SectionTitle } from '../components/UI';
import TableArt, { Grain } from '../components/TableArt';
import { Mode } from '../game/engine';
import { Profile, todayKey } from '../storage';

export type Page = 'lobby' | 'tables' | 'stats' | 'collection' | 'settings' | 'rules';
export type Room = { title: string; subtitle: string; mode: Mode; theme: Profile['theme']; tag: string; icon: typeof Coffee; reward: number; entryFee: number };
export const ROOMS: Room[] = [
  { title: 'Klasik masa', subtitle: 'Bildiğin oyun, sevdiğin keyif.', mode: 'classic', theme: 'green', tag: 'EN SEVİLEN', icon: Coffee, reward: 500, entryFee: 250 },
  { title: 'Çifte gidelim', subtitle: 'Biraz şans, iki kat strateji.', mode: 'pairs', theme: 'plum', tag: 'ÇİFT AÇMALI', icon: Layers3, reward: 750, entryFee: 500 },
  { title: 'Gece masası', subtitle: 'Sakin bir masa, son bir el.', mode: 'classic', theme: 'blue', tag: 'GECE MODU', icon: Moon, reward: 500, entryFee: 250 },
];
type Props = { page: Page; profile: Profile; update: (patch: Partial<Profile>) => void; onStart: (room: Room) => void; navigate: (page: Page) => void; onCustom: () => void; onBonus: () => void; onSignOut: () => void };

function RoomCard({ room, onPress }: { room: Room; onPress: () => void }) {
  const Icon = room.icon;
  const tint = room.theme === 'plum' ? '#b59aa7' : room.theme === 'blue' ? '#9eafc5' : '#b4c79b';
  return <Pressable accessibilityRole="button" accessibilityLabel={`${room.title}, gerçek oyuncularla oyna`} onPress={onPress} style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [s.roomCard, { borderColor: hovered ? tint : C.border, opacity: pressed ? .85 : 1 }]}>
    <View style={s.roomTop}><View style={[s.roomIcon, { backgroundColor: `${tint}14` }]}><Icon size={19} strokeWidth={1.7} color={tint} /></View><Label color={tint} style={{ fontSize: 8, letterSpacing: 1.25 }}>{room.tag}</Label><ArrowUpRight size={17} color={C.muted} /></View>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginTop: 20 }}><View style={{ flex: 1 }}><Text style={s.roomTitle}>{room.title}</Text><Text style={s.roomSubtitle}>{room.subtitle}</Text></View><View style={{ flexDirection: 'row', paddingRight: 4, transform: [{ rotate: '9deg' }] }}><View style={{ transform: [{ rotate: '-14deg' }], marginRight: -10, marginTop: 3 }}><OkeyTile size={29} tile={{ value: room.mode === 'pairs' ? 8 : 5, color: room.theme === 'plum' ? 'red' : 'blue' }} /></View><OkeyTile size={29} tile={{ value: room.mode === 'pairs' ? 8 : 6, color: room.theme === 'plum' ? 'red' : 'blue' }} /></View></View>
    <View style={s.roomFooter}><View style={s.inline}><Users size={13} color={C.muted} /><Text style={s.small}>4 gerçek oyunculu masa</Text></View><View style={s.inline}><Coin size={16} /><Text style={[s.small, { color: C.gold }]}>-{room.entryFee} giriş · +{room.reward}</Text></View></View>
  </Pressable>;
}

export default function Lobby({ page, profile, update, onStart, navigate, onCustom, onBonus, onSignOut }: Props) {
  const [filter, setFilter] = useState<'all' | Mode>('all');
  const [name, setName] = useState(profile.name);
  const [saved, setSaved] = useState(false);
  const claimed = profile.lastBonus === todayKey();
  const titles: Record<Page, [string, string]> = {
    lobby: ['Bir el daha?', 'Günün yorgunluğu kapıda kalsın.'], tables: ['Masanı seç.', 'Dört gerçek oyuncu buluşsun, keyif başlasın.'],
    stats: ['Senin hikâyen.', 'Her el, yeni bir tecrübe.'], collection: ['Masana renk kat.', 'Küçük detaylar, sana özel bir atmosfer.'],
    settings: ['Tam senlik.', 'Oyununu kendi ritmine ayarla.'], rules: ['Oyunun incelikleri.', 'İlk taşından son perine, küçük bir rehber.'],
  };
  return <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
    <View style={s.pageHeading}><View><Label color={C.green}>{page === 'lobby' ? 'İYİ Kİ GELDİN' : 'KEYİF 101'}</Label><Text accessibilityRole="header" style={s.heading}>{titles[page][0]}</Text><Text style={s.subtitle}>{titles[page][1]}</Text></View><View style={s.modeBadge}><View style={s.statusDot} /><Text style={s.small}>Gerçek oyuncularla canlı masa</Text></View></View>

    {page === 'lobby' && <>
      <View style={s.heroRow}>
        <LinearGradient colors={['#345a43', '#254b39', '#204534']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <Grain />
          <View style={{ position: 'absolute', width: 510, height: 510, right: -125, top: -110, borderRadius: 300, borderWidth: 1, borderColor: '#e0e9be0b' }} /><View style={{ position: 'absolute', width: 420, height: 420, right: -80, top: -60, borderRadius: 300, borderWidth: 1, borderColor: '#e0e9be0d' }} />
          <View style={s.heroArt}><TableArt scale={1} /></View>
          <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#d1dbb731', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 7 }}><Sparkles size={12} color={C.gold} /><Label color={C.gold} style={{ fontSize: 8, letterSpacing: 1.6 }}>SENİN MASAN HAZIR</Label></View>
          <Text style={s.heroTitle}>Hoş sohbet,{ '\n' }iyi oyun.</Text>
          <Text style={s.heroDescription}>Bir tutam şans, biraz strateji.{ '\n' }101’in en keyifli hâline hoş geldin.</Text>
          <View style={{ marginTop: 25, alignSelf: 'flex-start', zIndex: 2 }}><Button onPress={() => onStart(ROOMS[0])} icon={<ArrowRight size={19} color={C.ink} />} style={{ minWidth: 194 }} testID="quick-play">Hemen oyna</Button></View>
          <View style={[s.inline, { marginTop: 18, gap: 9 }]}><ShieldCheck size={13} color="#a9bca1" /><Text style={{ fontFamily: F.medium, color: '#bbcbb2', fontSize: 10 }}>Ücretsiz masa · Beklemeden oyna</Text></View>
        </LinearGradient>
        <LinearGradient colors={['#eee1c4', '#d9c297']} style={s.reward}>
          <View><View style={[s.inline, { gap: 6 }]}><Gift size={14} color="#78603e" /><Label color="#78603e" style={{ fontSize: 9 }}>KÜÇÜK BİR HOŞ GELDİN</Label></View>
            <Text style={s.rewardTitle}>Günün{ '\n' }güzelliği.</Text><Text style={s.rewardDesc}>Yeni bir gün, yeni bir şans.</Text></View>
          <View style={{ height: 90, alignItems: 'center', justifyContent: 'center', marginVertical: 3 }}><View style={{ transform: [{ rotate: '-12deg' }] }}><Coin size={60} /></View><View style={{ position: 'absolute', right: 28, top: 34 }}><Coin size={37} /></View><Sparkles size={18} color="#a8874d" style={{ position: 'absolute', left: 25, top: 12 }} /></View>
          <View><Text style={s.rewardValue}>+750 <Text style={{ fontSize: 13, fontFamily: F.medium }}>çip</Text></Text><Pressable accessibilityRole="button" disabled={claimed} onPress={onBonus} style={({ pressed }) => [s.rewardButton, { opacity: pressed ? .7 : 1 }]}><Text style={{ color: '#fff4db', fontFamily: F.bold, fontSize: 12 }}>{claimed ? 'Bugünkü hediyen alındı' : 'Hediyeni al'}</Text>{claimed ? <Check size={15} color="#fff4db" /> : <ArrowRight size={15} color="#fff4db" />}</Pressable><Text style={{ textAlign: 'center', color: '#755f40', fontSize: 9, fontFamily: F.medium, marginTop: 9 }}>{claimed ? 'Yarın yeniden görüşürüz.' : 'Her gün yeni bir hediye seni bekler.'}</Text></View>
        </LinearGradient>
      </View>
      <View style={{ marginTop: 32 }}><SectionTitle title="Nasıl bir oyun olsun?" action="Tüm masalar" onPress={() => navigate('tables')} /><View style={s.rooms}>{ROOMS.map(room => <RoomCard key={room.title} room={room} onPress={() => onStart(room)} />)}</View></View>
      <View style={s.bottomBanner}><View style={s.bannerIcon}><Leaf size={25} color={C.green} strokeWidth={1.4} /></View><View style={{ flex: 1 }}><Text style={{ fontFamily: F.bold, fontSize: 14, color: C.text }}>Aceleye gerek yok.</Text><Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted, marginTop: 5, lineHeight: 19 }}>Reklamsız, beklemesiz. Sadece sen, taşların ve güzel bir oyun.</Text></View><View style={{ width: 1, height: 34, backgroundColor: C.border, marginHorizontal: 20 }} /><Pressable onPress={() => navigate('rules')} accessibilityRole="button" style={[s.inline, { minHeight: 44 }]}><Text style={{ color: C.green, fontFamily: F.bold, fontSize: 11 }}>101’e yeni misin?</Text><ArrowUpRight size={16} color={C.green} /></Pressable></View>
    </>}

    {page === 'tables' && <>
      <View style={s.filterRow}>{([['all', 'Tüm masalar'], ['classic', 'Klasik 101'], ['pairs', 'Çift açmalı']] as const).map(([value, label]) => <Pressable accessibilityRole="button" accessibilityState={{ selected: filter === value }} key={value} onPress={() => setFilter(value)} style={[s.filter, filter === value && { backgroundColor: C.green, borderColor: C.green }]}><Text style={{ fontFamily: F.bold, color: filter === value ? C.ink : C.muted, fontSize: 12 }}>{label}</Text></Pressable>)}</View>
      <View style={s.rooms}>{ROOMS.filter(r => filter === 'all' || r.mode === filter).map(room => <RoomCard key={room.title} room={room} onPress={() => onStart(room)} />)}</View>
      <View style={[s.infoPanel, { marginTop: 24, alignItems: 'center', paddingVertical: 35 }]}><Settings2 color={C.gold} size={30} /><Text style={s.panelTitle}>Kendi masanı kur.</Text><Text style={[s.subtitle, { textAlign: 'center', marginBottom: 24 }]}>Oyun türünü ve masanın rengini seç; gerçek oyuncuların katılmasını bekle.</Text><Button onPress={onCustom} secondary icon={<Plus size={18} color={C.text} />}>Masa oluştur</Button><Text style={[s.small, { marginTop: 18 }]}>Masa dört gerçek oyuncu katılınca başlar.</Text></View>
    </>}

    {page === 'stats' && <>
      <View style={[s.infoPanel, { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 24 }]}><Avatar size={76} /><View><Label color={C.gold}>KEYİF KULÜBÜ</Label><Text style={{ fontFamily: F.serif, color: C.text, fontSize: 30, marginTop: 6 }}>{profile.name}</Text><Text style={s.subtitle}>{profile.games < 5 ? 'Yeni bir hikâye başlıyor.' : 'Masanın tanıdık yüzü.'}</Text></View></View>
      <View style={s.rooms}>{[[Trophy, 'Kazanılan el', profile.wins], [Layers3, 'Oynanan el', profile.games], [Zap, 'Kazanma oranı', `%${profile.games ? Math.round(profile.wins / profile.games * 100) : 0}`]].map(([Icon, label, value], i) => { const I = Icon as typeof Trophy; return <View key={i} style={[s.infoPanel, { flex: 1 }]}><I color={C.gold} size={22} /><Text style={{ fontFamily: F.serif, fontSize: 46, color: C.text, marginVertical: 12 }}>{String(value)}</Text><Text style={s.subtitle}>{String(label)}</Text></View>; })}</View>
      <View style={[s.infoPanel, { marginTop: 24 }]}><SectionTitle title="İlk ustalık yolculuğun" subtitle={`${Math.min(profile.games, 10)} / 10 el tamamlandı`} /><View style={{ height: 7, backgroundColor: C.sidebar, borderRadius: 4, overflow: 'hidden' }}><View style={{ height: 7, width: `${Math.min(100, profile.games * 10)}%`, backgroundColor: C.green, borderRadius: 4 }} /></View><Text style={[s.subtitle, { marginTop: 18, marginBottom: 22 }]}>On el tamamla, masanın müdavimi ol. İstatistiklerin bu cihazda saklanır.</Text><Button onPress={() => onStart(ROOMS[0])} style={{ alignSelf: 'flex-start' }}>Bir el oyna</Button></View>
    </>}

    {page === 'collection' && <View style={s.rooms}>{ROOMS.map(room => <Pressable accessibilityRole="button" accessibilityLabel={`${room.title} temasını seç`} accessibilityState={{ selected: profile.theme === room.theme }} key={room.theme} onPress={() => update({ theme: room.theme })} style={[s.infoPanel, { flex: 1, alignItems: 'center', overflow: 'hidden', borderColor: profile.theme === room.theme ? C.gold : C.border }]}><TableArt scale={.6} tone={room.theme} compact /><Text style={s.roomTitle}>{room.theme === 'green' ? 'Ceviz & keçe' : room.theme === 'plum' ? 'Mürdüm akşamı' : 'Gece mavisi'}</Text><View style={[s.inline, { marginTop: 16 }]}>{profile.theme === room.theme && <Check size={15} color={C.green} />}<Text style={[s.subtitle, { color: C.green }]}>{profile.theme === room.theme ? 'Seçili tema' : 'Temayı seç'}</Text></View></Pressable>)}</View>}

    {page === 'settings' && <View style={[s.infoPanel, { maxWidth: 740 }]}><Label color={C.gold}>MASADA SANA NE DİYELİM?</Label><TextInput accessibilityLabel="Oyuncu adı" value={name} onChangeText={v => { setName(v); setSaved(false); }} maxLength={18} placeholder="Oyuncu adın" placeholderTextColor={C.muted} style={s.nameInput} /><Button onPress={() => { update({ name: name.trim() || 'Misafir' }); setSaved(true); }} style={{ alignSelf: 'flex-start', marginBottom: 22 }} compact icon={saved ? <Check color={C.ink} size={16} /> : undefined}>{saved ? 'Kaydedildi' : 'Adını kaydet'}</Button>
      <Pressable onPress={() => navigate('collection')} accessibilityRole="button" style={s.settingRow}><View><Text style={s.settingTitle}>Masa görünümü</Text><Text style={[s.subtitle, { marginTop: 5 }]}>Üç farklı atmosfer arasından seç.</Text></View><ChevronRight color={C.muted} size={20} /></Pressable><Button secondary onPress={onSignOut} style={{ alignSelf: 'flex-start', marginTop: 6 }}>Oturumu kapat</Button><Text style={[s.small, { marginTop: 22, lineHeight: 20 }]}>Keyif 101 · v1.0{ '\n' }Hesabınla giriş yaptığında profilin, ayarların ve istatistiklerin Supabase üzerinde saklanır.</Text>
    </View>}

    {page === 'rules' && <View style={{ maxWidth: 800, gap: 14 }}>{[
      ['01', 'Taşını çek, oyununu kur.', '106 taşla oynanır. İlk oyuncu 22, diğerleri 21 taş alır. İlk elde bir taş atarsın; sonraki sıralarda önce ortadan veya soldan taş çekip sonra sağa bir taş atarsın.'],
      ['02', 'Üç taş, bir per.', 'Aynı rengin ardışık en az üç sayısı (kırmızı 5-6-7) veya aynı sayının en az üç farklı rengi bir per oluşturur. 12-13-1 bir seri değildir.'],
      ['03', 'Hedef: 101.', 'Klasik masada ilk açılışta perlerinin toplamı en az 101 olmalı. “Per aç” elindeki en yüksek toplamlı uygun perleri masaya bırakır. Çift masasında aynı renk ve sayıdan en az 5 çiftle açılır.'],
      ['04', 'Okey, eksik parçan.', 'Göstergenin bir üst sayısı ve aynı rengi okeydir; 13’ten sonra 1 gelir. Okey her taşın yerine kullanılabilir. Yıldızlı sahte okey, gerçek okeyin renk ve sayı değerini taşır; serbest joker değildir.'],
      ['05', 'Masayı büyüt.', 'Elini açtıktan sonra bir taşını seçip masadaki uyumlu pere dokunarak taşı işleyebilirsin. Soldan taş almak için elin açık olmalı veya aldığın taşla hemen açabilmelisin.'],
      ['06', 'Son taş, en güzel an.', 'Son taşını sağa atınca el biter. Kazanan −101; açmamış oyuncu 202; açmış oyuncu elindeki sayıların toplamını yazar (eldeki okey 101). Taşlar biterse el beraberedir.'],
    ].map(([num, title, desc]) => <View key={num} style={[s.infoPanel, { flexDirection: 'row', gap: 20 }]}><Text style={{ fontFamily: F.serif, fontSize: 27, color: C.gold }}>{num}</Text><View style={{ flex: 1 }}><Text style={s.settingTitle}>{title}</Text><Text style={[s.subtitle, { lineHeight: 23, marginTop: 8 }]}>{desc}</Text></View></View>)}<Text style={[s.small, { lineHeight: 21, marginTop: 7 }]}>Bu masa dört gerçek oyuncu katılınca başlar. Oyuncu eksikse sıra ilerlemez ve hiçbir koltuğa bilgisayar oyuncusu eklenmez.</Text><Button onPress={() => onStart(ROOMS[0])} style={{ alignSelf: 'flex-start', marginTop: 12 }} icon={<ArrowRight color={C.ink} size={18} />}>Masaya katıl</Button></View>}

    <View style={s.footer}><Text style={s.footerText}>KEYİF 101</Text><View style={{ width: 3, height: 3, backgroundColor: '#617c6f', borderRadius: 3 }} /><Text style={{ fontSize: 10, fontFamily: F.medium, color: '#94ac9d' }}>İyi oyun, iyi hissettirir.</Text></View>
  </ScrollView>;
}
const s = StyleSheet.create({
  content: { padding: 38, paddingTop: 33, maxWidth: 1430, width: '100%', alignSelf: 'center', paddingBottom: 20 },
  pageHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30 },
  heading: { fontFamily: F.serif, color: C.text, fontSize: 46, letterSpacing: -1.8, marginTop: 8, marginBottom: 7 },
  subtitle: { color: C.muted, fontSize: 12, fontFamily: F.regular },
  small: { color: C.muted, fontSize: 10, fontFamily: F.medium },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 26 },
  statusDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: C.green },
  heroRow: { flexDirection: 'row', gap: 20 },
  hero: { flex: 1, minHeight: 343, padding: 30, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#64826166', ...elevation(12, .1) },
  heroArt: { position: 'absolute', right: -40, top: 16 },
  heroTitle: { fontFamily: F.serif, fontSize: 42, letterSpacing: -1.4, lineHeight: 49, color: '#f2edda', marginTop: 23 },
  heroDescription: { fontFamily: F.regular, fontSize: 12, lineHeight: 22, color: '#c0d0b9', marginTop: 14, maxWidth: 250 },
  reward: { width: 224, minHeight: 343, borderRadius: 20, padding: 23, borderWidth: 1, borderColor: '#f0debb', ...elevation(12, .1) },
  rewardTitle: { fontFamily: F.serif, color: '#4b4933', fontSize: 34, letterSpacing: -1, lineHeight: 38, marginTop: 18 },
  rewardDesc: { fontFamily: F.regular, fontSize: 10, color: '#756444', marginTop: 7 },
  rewardValue: { fontFamily: F.serif, color: '#5d4e30', fontSize: 31, textAlign: 'center' },
  rewardButton: { minHeight: 42, backgroundColor: '#665c3e', borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12, marginTop: 10, borderBottomWidth: 2, borderBottomColor: '#4e4731' },
  rooms: { flexDirection: 'row', gap: 16, alignItems: 'stretch' },
  roomCard: { flex: 1, padding: 20, borderRadius: 16, borderWidth: 1, backgroundColor: '#1b3a32', ...elevation(6, .08) },
  roomTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 9 },
  roomIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  roomTitle: { fontFamily: F.bold, fontSize: 17, color: C.text, letterSpacing: -.5 },
  roomSubtitle: { fontFamily: F.regular, fontSize: 10, lineHeight: 17, color: C.muted, marginTop: 6 },
  roomFooter: { marginTop: 22, borderTopWidth: 1, borderTopColor: '#ffffff0e', paddingTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  bottomBanner: { flexDirection: 'row', alignItems: 'center', gap: 18, borderWidth: 1, borderColor: C.border, padding: 22, borderRadius: 15, marginTop: 28, backgroundColor: '#19382f66' },
  bannerIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: '#b8d59b09', borderRadius: 30 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 25 },
  footerText: { fontFamily: F.bold, fontSize: 8, letterSpacing: 2.2, color: '#94ac9d' },
  filterRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  filter: { minHeight: 44, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  infoPanel: { backgroundColor: C.panel, padding: 25, borderWidth: 1, borderColor: C.border, borderRadius: 17 },
  panelTitle: { fontFamily: F.serif, fontSize: 30, color: C.text, marginVertical: 16 },
  nameInput: { minHeight: 52, borderWidth: 1, borderColor: C.border, backgroundColor: C.sidebar, borderRadius: 10, paddingHorizontal: 15, fontFamily: F.medium, color: C.text, fontSize: 15, marginTop: 14, marginBottom: 12 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 24, borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 23 },
  settingTitle: { fontFamily: F.bold, fontSize: 15, color: C.text },
});
