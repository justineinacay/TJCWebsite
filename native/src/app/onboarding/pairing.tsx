import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Field, InfoPanel, PageHeader, PrimaryButton, Screen, SecondaryButton } from '@/components/ui';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';
import { useNakNak } from '@/context/naknak-context';

const TEXT = {
  tl: {
    title: 'Ikonekta sa iyong pamilya',
    description: 'Ilagay ang 6-character Family Code mula sa Caregiver / Anak dashboard.',
    label: 'Family Code',
    placeholder: 'A1B2C3',
    connect: 'Ikonekta ang NakNak',
    connecting: 'Kumokonekta…',
    skip: 'Gamitin muna nang offline',
    privacy: 'Ang private device key ay ise-save sa secure storage ng phone. Hindi ito ipinapakita sa screen.',
  },
  en: {
    title: 'Connect with your family',
    description: 'Enter the 6-character Family Code from the Caregiver / Anak dashboard.',
    label: 'Family Code',
    placeholder: 'A1B2C3',
    connect: 'Connect NakNak',
    connecting: 'Connecting…',
    skip: 'Use offline for now',
    privacy: 'The private device key is saved in secure phone storage and is never shown on screen.',
  },
  ceb: {
    title: 'Ikonekta sa imong pamilya',
    description: 'Isulod ang 6-character Family Code gikan sa Caregiver / Anak dashboard.',
    label: 'Family Code',
    placeholder: 'A1B2C3',
    connect: 'Ikonekta ang NakNak',
    connecting: 'Nagkonekta…',
    skip: 'Gamita una offline',
    privacy: 'Ang private device key i-save sa secure storage sa phone ug dili ipakita sa screen.',
  },
};

export default function PairingScreen() {
  const { state, familyConnection, pairWithFamilyCode } = useNakNak();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const copy = TEXT[state.profile.language];
  const connecting = familyConnection.status === 'checking';

  const finish = () => router.replace('/senior/home');
  const connect = async () => {
    const normalized = code.replace(/[^a-z0-9]/gi, '').toUpperCase();
    if (normalized.length !== 6) {
      setError(state.profile.language === 'en' ? 'Enter all 6 characters.' : 'Ilagay ang kumpletong 6-character code.');
      return;
    }
    setError('');
    try {
      await pairWithFamilyCode(normalized);
      finish();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Hindi makakonekta gamit ang code na iyon.');
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <PageHeader title={copy.title} description={copy.description} onBack={() => router.back()} />
      <View style={styles.codeCard}>
        <View style={styles.iconShell}>
          <MaterialCommunityIcons color={colors.redDark} name="account-group" size={30} />
        </View>
        <Field
          autoCapitalize="characters"
          autoCorrect={false}
          error={error}
          inputStyle={styles.codeInput}
          label={copy.label}
          maxLength={6}
          onChangeText={(value) => setCode(value.replace(/[^a-z0-9]/gi, '').toUpperCase())}
          placeholder={copy.placeholder}
          value={code}
        />
      </View>
      <InfoPanel title="Private at ligtas" tone="green">
        {copy.privacy}
      </InfoPanel>
      <View style={styles.actions}>
        <PrimaryButton disabled={connecting} label={connecting ? copy.connecting : copy.connect} onPress={connect} />
        <SecondaryButton label={copy.skip} onPress={finish} />
      </View>
      <Text style={styles.note}>Maaari mo itong ikonekta o palitan anumang oras sa Profile.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl },
  codeCard: {
    gap: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    ...shadows.raised,
  },
  iconShell: {
    width: 58,
    height: 58,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.redSoft,
  },
  codeInput: { fontSize: 24, lineHeight: 30, fontFamily: typography.rounded, letterSpacing: 5, textAlign: 'center' },
  actions: { gap: spacing.sm },
  note: { color: colors.inkMuted, fontSize: 13, lineHeight: 18, fontFamily: typography.regular, textAlign: 'center' },
});
