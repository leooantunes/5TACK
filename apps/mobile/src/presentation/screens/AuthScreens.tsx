import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSession } from '../../application/stores/sessionStore';
import { Banner, Button, Field, Logo, Screen, Txt } from '../components/primitives';
import { colors, space } from '../theme/tokens';

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : 'Algo deu errado';
}

function AuthShell({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: space.lg, paddingVertical: space.xxl, gap: space.lg }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignItems: 'center', gap: space.md, marginBottom: space.xl }}>
            <Logo size={48} subtitle={false} />
            <Txt variant="heading" style={{ textAlign: 'center', maxWidth: 280 }}>
              {title}
            </Txt>
            <Txt variant="caption" style={{ textAlign: 'center', maxWidth: 280, marginTop: space.xs }}>
              Escale 5 pros, use a função certa em cada um e suba no ranking
            </Txt>
          </View>

          <View style={{ gap: space.md }}>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

export function LoginScreen() {
  const login = useSession((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Entrar">
      {error ? <Banner message={error} /> : null}
      <Field
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="voce@email.com"
      />
      <Field
        label="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        placeholder="••••••••"
        onSubmitEditing={submit}
      />
      <Button title="Entrar" onPress={submit} loading={loading} disabled={!email || !password} />
      <View style={{ alignItems: 'center', marginTop: space.md }}>
        <Link href="/register">
          <Txt variant="caption">
            Novo por aqui? <Txt variant="caption" color={colors.accent} style={{ fontWeight: '600' }}>Criar conta</Txt>
          </Txt>
        </Link>
      </View>
    </AuthShell>
  );
}

export function RegisterScreen() {
  const register = useSession((s) => s.register);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validação leve de UX; a regra que vale é a do servidor.
  const passwordHint =
    password.length > 0 && (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
      ? 'Mínimo 8 caracteres, com letras e números'
      : null;

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await register(email, password, displayName);
    } catch (e) {
      const details = (e as { details?: { message: string }[] }).details;
      setError(Array.isArray(details) && details[0] ? details[0].message : errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Criar conta">
      {error ? <Banner message={error} /> : null}
      <Field
        label="Nick no ranking"
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="none"
        maxLength={20}
        placeholder="seu_nick"
      />
      <Field
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="voce@email.com"
      />
      <View>
        <Field
          label="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="mín. 8 caracteres"
          error={passwordHint}
        />
      </View>
      <Txt variant="caption" color={colors.textMute} style={{ textAlign: 'center', marginTop: space.xs }}>
        Seu e-mail é privado. No ranking aparece só o seu nick.
      </Txt>
      <Button
        title="Criar conta"
        onPress={submit}
        loading={loading}
        disabled={!email || !displayName || !!passwordHint || !password}
      />
      <View style={{ alignItems: 'center', marginTop: space.md }}>
        <Link href="/login">
          <Txt variant="caption">
            Já tem conta? <Txt variant="caption" color={colors.accent} style={{ fontWeight: '600' }}>Entrar</Txt>
          </Txt>
        </Link>
      </View>
    </AuthShell>
  );
}
