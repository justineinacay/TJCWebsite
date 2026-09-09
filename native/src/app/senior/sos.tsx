import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandedBackdrop, InfoPanel, PrimaryButton, SecondaryButton } from '@/components/ui';
import { COPY } from '@/constants/copy';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';
import { useNakNak } from '@/context/naknak-context';
import { callPhoneNumber } from '@/lib/calling';

export default function SosScreen() {
  const { state, recordSosOpened } = useNakNak();
  const recorded = useRef(false);
  const [callError, setCallError] = useState('');
  const [delivery, setDelivery] = useState<'sending' | 'delivered' | 'local'>('sending');
  const copy = COPY[state.profile.language];
  const primaryContact = state.contacts.find((contact) => contact.primary) ?? state.contacts[0];
  const dialerHint = state.profile.language === 'en'
    ? 'Opens the phone dialer directly.'
    : state.profile.language === 'ceb'
      ? 'Direktang moabli ang phone dialer.'
      : 'Direktang bubuksan ang phone dialer.';

  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;
    void recordSosOpened().then((delivered) => setDelivery(delivered ? 'delivered' : 'local'));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  }, [recordSosOpened]);

  const call = async (phone: string) => {
    setCallError('');
    const result = await callPhoneNumber(phone);
    if (!result.ok) setCallError(result.reason);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <BrandedBackdrop />
      <View style={styles.hero}>
        <View style={styles.sosMark}>
          <Text style={styles.sosMarkText}>SOS</Text>
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {copy.sosActive}
        </Text>
        <Text style={styles.subtitle}>{copy.sosHonestSubtitle}</Text>
      </View>

      <View style={styles.statuses}>
        <InfoPanel title={copy.savedLocally} tone="green" icon={<MaterialCommunityIcons color={colors.greenDark} name="cellphone-check" size={23} />}>
          {copy.savedLocallyDetail}
        </InfoPanel>
        <InfoPanel
          title={delivery === 'delivered' ? 'Nasa caregiver dashboard na' : delivery === 'sending' ? 'Kinukumpirma ang connection' : copy.caregiverNotSent}
          tone={delivery === 'delivered' ? 'green' : 'amber'}
          icon={<MaterialCommunityIcons color={delivery === 'delivered' ? colors.greenDark : colors.amberDark} name={delivery === 'delivered' ? 'cloud-check' : 'cloud-alert'} size={23} />}
        >
          {delivery === 'delivered'
            ? 'Kinumpirma ng NakNak server ang SOS sa caregiver dashboard. Hindi nito ginagarantiya na may push notification na natanggap.'
            : delivery === 'sending'
              ? 'Naka-save na sa phone habang hinihintay ang kumpirmasyon ng server.'
              : copy.caregiverNotSentDetail}
        </InfoPanel>
        <InfoPanel title={copy.locationNotShared} tone="neutral" icon={<MaterialCommunityIcons color={colors.inkMuted} name="map-marker-off" size={23} />}>
          {copy.locationNotSharedDetail}
        </InfoPanel>
      </View>

      {callError ? (
        <Text accessibilityLiveRegion="assertive" style={styles.error}>
          {callError}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {primaryContact ? (
          <PrimaryButton
            accessibilityHint={dialerHint}
            label={copy.callPrimary(primaryContact.name)}
            onPress={() => call(primaryContact.phone)}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/senior/contacts')}
            style={({ pressed }) => [styles.addContact, pressed && styles.pressed]}
          >
            <Text style={styles.addContactTitle}>{copy.noPrimaryContact}</Text>
            <Text style={styles.addContactLink}>+ {copy.saveContact}</Text>
          </Pressable>
        )}

        <View style={styles.emergencyRow}>
          <SecondaryButton label={`${copy.call} 911`} onPress={() => call('911')} tone="danger" style={styles.emergencyButton} />
          <SecondaryButton label={`${copy.call} 112`} onPress={() => call('112')} tone="danger" style={styles.emergencyButton} />
        </View>
        <SecondaryButton label={copy.returnHome} onPress={() => router.replace('/senior/home')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  hero: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  sosMark: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.red,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.76)',
    ...shadows.sos,
  },
  sosMarkText: { color: colors.white, fontSize: 19, fontFamily: typography.rounded },
  title: { color: colors.ink, fontSize: 28, lineHeight: 32, fontFamily: typography.rounded, letterSpacing: -0.6, textAlign: 'center' },
  subtitle: { color: colors.inkMuted, fontSize: 15, lineHeight: 21, fontFamily: typography.regular, textAlign: 'center', maxWidth: 340 },
  statuses: { flex: 1, justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  error: { color: colors.redDark, fontSize: 14, lineHeight: 19, fontWeight: '800', textAlign: 'center', marginBottom: spacing.sm },
  actions: { gap: spacing.sm },
  addContact: {
    minHeight: 64,
    borderWidth: 2,
    borderColor: colors.red,
    borderRadius: radius.md,
    backgroundColor: colors.redSoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    padding: spacing.md,
  },
  addContactTitle: { color: colors.ink, fontSize: 14, lineHeight: 19, fontWeight: '700', textAlign: 'center' },
  addContactLink: { color: colors.redDark, fontSize: 15, fontWeight: '900' },
  emergencyRow: { flexDirection: 'row', gap: spacing.sm },
  emergencyButton: { flex: 1 },
  pressed: { opacity: 0.72 },
});
