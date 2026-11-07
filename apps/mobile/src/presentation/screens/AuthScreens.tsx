import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSession } from '../../application/stores/sessionStore';
import { Banner, Button, Field, HudPanel, Logo, Screen, Txt } from '../components/primitives';
import { colors, space } from '../theme/tokens';

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : 'Algo deu errado';
}

function AuthShell({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.xl, gap: space.xl }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'flex-start', gap: space.sm }}>
            <Logo size={56} />
            <Txt variant="caption" style={{ maxWidth: 300 }}>
              Escale 5 pros, use a função certa em cada um e suba no ranking a cada mapa jogado.
            </Txt>
          </View>
          <HudPanel style={{ gap: space.lg }}>
            <Txt variant="title">{title}</Txt>
            {children}
          </HudPanel>
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
      {error ? <Banner message={error} /> : null}
      <Button title="Entrar" onPress={submit} loading={loading} disabled={!email || !password} />
      <Link href="/register" style={{ alignSelf: 'center' }}>
        <Txt variant="caption">
          Novo por aqui? <Txt variant="caption" color={colors.accent}>Criar conta</Txt>
        </Txt>
      </Link>
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
      <Txt variant="caption" color={colors.textMute}>
        Seu e-mail é privado. No ranking aparece só o seu nick.
      </Txt>
      {error ? <Banner message={error} /> : null}
      <Button
        title="Criar conta"
        onPress={submit}
        loading={loading}
        disabled={!email || !displayName || !!passwordHint || !password}
      />
      <Link href="/login" style={{ alignSelf: 'center' }}>
        <Txt variant="caption">
          Já tem conta? <Txt variant="caption" color={colors.accent}>Entrar</Txt>
        </Txt>
      </Link>
    </AuthShell>
  );
}
