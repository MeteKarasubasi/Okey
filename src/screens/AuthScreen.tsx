import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react-native';
import { C, F, elevation } from '../theme';
import { Button, Logo } from '../components/UI';
import type { useAuth } from '../auth';

type Auth = ReturnType<typeof useAuth>;
export default function AuthScreen({ auth }: { auth: Auth }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const submit = async () => {
    setNotice('');
    if (!email.trim() || password.length < 6 || (mode === 'signup' && !name.trim())) {
      setNotice(mode === 'signup' ? 'Adını, geçerli e-postanı ve en az 6 karakterli şifreni gir.' : 'E-posta ve en az 6 karakterli şifre gerekli.');
      return;
    }
    setBusy(true);
    const result = mode === 'signin' ? await auth.signIn(email.trim(), password) : await auth.signUp(email.trim(), password, name.trim());
    setBusy(false);
    if (result.error) return;
    if (mode === 'signup' && 'data' in result && !result.data.session) setNotice('Hesabın oluşturuldu. E-postandaki doğrulama bağlantısından sonra giriş yapabilirsin.');
  };
  return <View style={s.page}>
    <View style={s.glow} /><View style={s.card}>
      <Logo small /><Text style={s.eyebrow}>KEYİF KULÜBÜ</Text><Text style={s.title}>{mode === 'signin' ? 'Masana dön.' : 'Aramıza katıl.'}</Text>
      <Text style={s.copy}>{mode === 'signin' ? 'Oyunlarını, istatistiklerini ve ayarlarını her cihazda yanında taşı.' : 'Profilini oluştur, ilerlemeni ve oyun istatistiklerini güvenle sakla.'}</Text>
      {mode === 'signup' && <Field icon={<UserRound size={17} color={C.muted} />} value={name} onChangeText={setName} placeholder="Oyuncu adın" autoCapitalize="words" />}
      <Field icon={<Mail size={17} color={C.muted} />} value={email} onChangeText={setEmail} placeholder="E-posta adresin" keyboardType="email-address" autoCapitalize="none" />
      <View style={s.passwordWrap}><Field icon={<LockKeyhole size={17} color={C.muted} />} value={password} onChangeText={setPassword} placeholder="Şifren" secureTextEntry={!showPassword} autoCapitalize="none" /><Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'} onPress={() => setShowPassword(value => !value)} style={s.eye}>{showPassword ? <EyeOff size={17} color={C.muted} /> : <Eye size={17} color={C.muted} />}</Pressable></View>
      {(notice || auth.error) && <Text style={s.error}>{notice || auth.error}</Text>}
      <Button disabled={busy} onPress={submit} icon={<ArrowRight size={18} color={C.ink} />}>{busy ? 'Bekle…' : mode === 'signin' ? 'Giriş yap' : 'Hesap oluştur'}</Button>
      <Pressable accessibilityRole="button" onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setNotice(''); auth.setError(''); }} style={s.switch}><Text style={s.switchText}>{mode === 'signin' ? 'Hesabın yok mu? ' : 'Zaten hesabın var mı? '}<Text style={{ color: C.green }}>{mode === 'signin' ? 'Kayıt ol' : 'Giriş yap'}</Text></Text></Pressable>
    </View><Text style={s.privacy}>Verilerin hesabına bağlı tutulur ve cihazlar arasında senkronize edilir.</Text>
  </View>;
}
function Field({ icon, ...props }: { icon: React.ReactNode } & React.ComponentProps<typeof TextInput>) {
  return <View style={s.field}>{icon}<TextInput {...props} placeholderTextColor={C.muted} style={s.input} /></View>;
}
const s = StyleSheet.create({
  page: { flex: 1, minHeight: '100%', backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 20, overflow: 'hidden' },
  glow: { position: 'absolute', width: 520, height: 520, borderRadius: 300, backgroundColor: '#2b66501c', top: -150, right: -170 },
  card: { width: '100%', maxWidth: 440, padding: 34, borderRadius: 24, borderWidth: 1, borderColor: '#57745f', backgroundColor: '#193932f2', ...elevation(18, .18) },
  eyebrow: { color: C.gold, fontFamily: F.bold, fontSize: 9, letterSpacing: 2, marginTop: 28 },
  title: { color: C.text, fontFamily: F.serif, fontSize: 38, marginTop: 10 },
  copy: { color: C.muted, fontFamily: F.regular, fontSize: 13, lineHeight: 21, marginTop: 9, marginBottom: 24 },
  field: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 15, borderRadius: 11, borderWidth: 1, borderColor: '#527265', backgroundColor: '#0c2924', marginTop: 10 },
  input: { flex: 1, color: C.text, fontFamily: F.medium, fontSize: 13, minHeight: 50, outlineStyle: 'none' } as any,
  passwordWrap: { position: 'relative' }, eye: { position: 'absolute', right: 14, top: 25, zIndex: 2 },
  error: { color: '#f2b4a2', fontFamily: F.medium, fontSize: 11, lineHeight: 18, marginTop: 12 },
  switch: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 14 }, switchText: { color: C.muted, fontFamily: F.medium, fontSize: 12 },
  privacy: { color: '#8ea99c', fontFamily: F.medium, fontSize: 10, textAlign: 'center', marginTop: 17 },
});
