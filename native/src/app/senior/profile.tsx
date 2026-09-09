import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Href, router } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/bottom-nav';
import { BrandedBackdrop, InfoPanel, SecondaryButton, SectionTitle } from '@/components/ui';
import { ACCESSIBILITY_OPTIONS, COPY } from '@/constants/copy';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';
import { useNakNak } from '@/context/naknak-context';

export default function ProfileScreen() {
  const { state, familyConnection, disconnectFamily, resetApp } = useNakNak();
  const copy = COPY[state.profile.language];
  const editLabel = state.profile.language === 'en' ? 'Edit accessibility settings' : state.profile.language === 'ceb' ? 'Usba ang accessibility settings' : 'Baguhin ang accessibility settings';
  const remoteTitle = familyConnection.status === 'connected'
    ? state.profile.language === 'en' ? 'Connected to caregiver dashboard' : 'Connected sa caregiver dashboard'
    : state.profile.language === 'en' ? 'Needs a connection' : state.profile.language === 'ceb' ? 'Kinahanglan ug koneksyon' : 'Kailangan ng koneksyon';

  const restart = async () => {
    await resetApp();
    router.replace('/');
  };

  const confirmDisconnect = () => {
    Alert.alert(
      'I-disconnect ang family dashboard?',
      'Mananatili sa phone ang local contacts at gamot, pero hindi na maipapadala ang Ayos Ako at SOS status.',
      [
        { text: 'Kanselahin', style: 'cancel' },
        { text: 'I-disconnect', style: 'destructive', onPress: () => void disconnectFamily() },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <BrandedBackdrop />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{state.profile.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={styles.title}>{copy.profileTitle}</Text>
            <Text style={styles.name}>{state.profile.name}</Text>
          </View>
        </View>

        <SectionTitle>{copy.accessibilityNeeds}</SectionTitle>
        {state.profile.accessibilityNeeds.length ? (
          <View style={styles.needs}>
            {state.profile.accessibilityNeeds.map((need) => {
              const option = ACCESSIBILITY_OPTIONS[need];
              return (
                <View key={need} style={styles.needRow}>
                  <View style={styles.needIcon}>
                    <MaterialCommunityIcons color={colors.redDark} name={option.icon} size={24} />
                  </View>
                  <View style={styles.needCopy}>
                    <Text style={styles.needTitle}>{option.label[state.profile.language]}</Text>
                    <Text style={styles.needDescription}>{option.description[state.profile.language]}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <InfoPanel title={copy.skip}>{copy.accessibilityDescription}</InfoPanel>
        )}

        <SecondaryButton label={editLabel} onPress={() => router.push('/onboarding/accessibility')} />

        <SectionTitle>{copy.offlineSection}</SectionTitle>
        <View style={styles.offlineFacts}>
          {copy.offlineFacts.map((fact) => (
            <View key={fact} style={styles.factRow}>
              <View style={styles.factCheck}>
                <MaterialCommunityIcons color={colors.greenDark} name="check-bold" size={17} />
              </View>
              <Text style={styles.factText}>{fact}</Text>
            </View>
          ))}
        </View>

        <InfoPanel
          title={remoteTitle}
          tone={familyConnection.status === 'connected' ? 'green' : 'amber'}
          icon={<MaterialCommunityIcons color={familyConnection.status === 'connected' ? colors.greenDark : colors.amberDark} name={familyConnection.status === 'connected' ? 'cloud-check' : 'cloud-alert'} size={22} />}
        >
          {familyConnection.status === 'connected'
            ? `Nakatalaga ang phone na ito kay ${familyConnection.seniorName || state.profile.name}. Ang Ayos Ako at SOS status ay ipinapadala lamang kapag kinumpirma ng server.`
            : familyConnection.message || copy.caregiverNotSentDetail}
        </InfoPanel>

        {familyConnection.status === 'connected' ? (
          <SecondaryButton label="I-disconnect ang family dashboard" onPress={confirmDisconnect} tone="danger" />
        ) : (
          <SecondaryButton label="Ikonekta gamit ang Family Code" onPress={() => router.push('/onboarding/pairing' as Href)} />
        )}

        <SecondaryButton label={copy.restartOnboarding} onPress={restart} tone="danger" />
      </ScrollView>
      <BottomNav active="profile" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.red, ...shadows.raised },
  avatarText: { color: colors.white, fontSize: 29, fontFamily: typography.rounded },
  headerCopy: { flex: 1 },
  title: { color: colors.ink, fontSize: 28, lineHeight: 32, fontFamily: typography.rounded, letterSpacing: -0.6 },
  name: { color: colors.inkMuted, fontSize: 17, lineHeight: 22, fontWeight: '700' },
  needs: { gap: spacing.sm },
  needRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  needIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.redSoft },
  needCopy: { flex: 1, gap: 2 },
  needTitle: { color: colors.ink, fontSize: 17, fontFamily: typography.rounded },
  needDescription: { color: colors.inkMuted, fontSize: 15, lineHeight: 20, fontFamily: typography.regular },
  offlineFacts: { borderRadius: radius.md, backgroundColor: colors.greenSoft, padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: 'rgba(32,155,87,0.12)' },
  factRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  factCheck: { width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  factText: { flex: 1, color: colors.ink, fontSize: 15, lineHeight: 21, fontFamily: typography.regular },
});
