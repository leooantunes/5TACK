import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useSession } from '../../application/stores/sessionStore';
import { colors, fonts } from '../../presentation/theme/tokens';

/** Área logada: sem sessão, volta para o login. */
export default function TabsLayout() {
  const status = useSession((s) => s.status);
  if (status !== 'signedIn') return <Redirect href="/login" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.bgElevated, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMute,
        tabBarLabelStyle: { fontFamily: fonts.heading, letterSpacing: 1, textTransform: 'uppercase', fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Torneios',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="trophy-outline" color={String(color)} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-outline" color={String(color)} size={size} />,
        }}
      />
    </Tabs>
  );
}
