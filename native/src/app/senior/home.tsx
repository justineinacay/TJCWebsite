import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/bottom-nav';
import { BrandedBackdrop } from '@/components/ui';
import { COPY } from '@/constants/copy';
import { colors, gradients, radius, shadows, spacing, typography } from '@/constants/theme';
import { useNakNak } from '@/context/naknak-context';

export default function SeniorHomeScreen() {
  const { state, recordCheckIn } = useNakNak();
  const { width, height } = useWindowDimensions();
  const [checkInMessage, setCheckInMessage] = useState('');
  const copy = COPY[state.profile.language];
  const needs = state.profile.accessibilityNeeds;
  const generalAssistance = needs.includes('general');
  const visual = needs.includes('vision') || generalAssistance;
  const mobility = needs.includes('mobility') || generalAssistance;
  const cognitive = needs.includes('cognitive') || generalAssistance;
  const compact = height < 720;
  const landscape = width > height;
  const sosSize = landscape
    ? Math.min(150, height * 0.42)
    : Math.min(compact ? 188 : 216, Math.max(154, height * (compact ? 0.27 : 0.26)));
  const sosTitleSize = Math.min(visual ? 40 : 42, sosSize * 0.195);
  const sosHint = state.profile.language === 'en'
    ? 'Opens the emergency screen and direct calling options.'
    : state.profile.language === 'ceb'
      ? 'Moabli sa emergency screen ug direktang mga tawag.'
      : 'Binubuksan ang emergency screen at direktang mga tawag.';

  const checkIn = async () => {
    const delivered = await recordCheckIn();
    setCheckInMessage(
      delivered
        ? state.profile.language === 'en'
          ? 'Check-in confirmed in the caregiver dashboard.'
          : state.profile.language === 'ceb'
            ? 'Nakumpirma ang check-in sa caregiver dashboard.'
            : 'Nakumpirma ang check-in sa caregiver dashboard.'
        : state.profile.language === 'en'
          ? 'Check-in saved on this phone.'
        : state.profile.language === 'ceb'
          ? 'Naka-save niini nga phone ang imong check-in.'
          : 'Naka-save sa phone ang check-in mo.',
    );
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <BrandedBackdrop />
      <View style={[styles.header, compact && styles.headerCompact]}>
        <View style={[styles.headerShell, compact && styles.headerShellCompact]}>
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel="NakNak"
            source={require('../../../assets/images/icon.png')}
            style={[styles.brandBadge, compact && styles.brandBadgeCompact]}
          />
          <View style={styles.identity}>
            <Text style={[styles.greeting, visual && styles.visualGreeting]}>{copy.greeting}</Text>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={[styles.name, visual && styles.visualName]}>
                {state.profile.name}
              </Text>
            </View>
          </View>
          <View style={styles.offlineBadge}>
            <MaterialCommunityIcons color={colors.greenDark} name="cloud-check-outline" size={15} />
            <Text style={styles.offlineBadgeText}>{copy.offlineShort}</Text>
          </View>
        </View>
      </View>

      {!compact && cognitive ? (
        <View style={styles.helper}>
          <View style={styles.helperIconShell}>
            <MaterialCommunityIcons color={colors.greenDark} name="head-heart-outline" size={18} />
          </View>
          <Text style={[styles.helperText, visual && styles.visualHelper]}>{copy.cognitiveHelper}</Text>
        </View>
      ) : null}

      {checkInMessage && !compact ? (
        <View accessibilityLiveRegion="polite" style={styles.checkInNotice}>
          <MaterialCommunityIcons color={colors.greenDark} name="check-circle" size={18} />
          <Text style={styles.checkInNoticeText}>{checkInMessage}</Text>
        </View>
      ) : null}

      <View style={[styles.main, landscape && styles.mainLandscape]}>
        <View style={styles.sosArea}>
          <View style={[styles.sosAura, { width: sosSize + 24, height: sosSize + 24, borderRadius: (sosSize + 24) / 2 }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${copy.sosLabel}. ${copy.sosHelp}`}
              accessibilityHint={sosHint}
              onPress={async () => {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
                router.push('/senior/sos');
              }}
              style={({ pressed }) => [
                styles.sosButton,
                { width: sosSize, height: sosSize, borderRadius: sosSize / 2 },
                pressed && styles.sosPressed,
              ]}
            >
              <LinearGradient
                colors={gradients.red}
                end={{ x: 0.9, y: 1 }}
                start={{ x: 0.15, y: 0 }}
                style={[StyleSheet.absoluteFill, { borderRadius: sosSize / 2 }]}
              />
              <View style={[styles.sosShine, { borderRadius: sosSize / 2 }]} />
              <View style={[styles.sosInnerRing, { borderRadius: sosSize / 2 }]} />
              <View style={styles.sosIconShell}>
                <MaterialCommunityIcons color={colors.white} name="shield-alert" size={21} />
              </View>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.78}
                numberOfLines={1}
                style={[styles.sosTitle, { fontSize: sosTitleSize, lineHeight: sosTitleSize + 4 }]}
              >
                {copy.sosLabel}
              </Text>
              <Text style={[styles.sosSubtitle, visual && styles.visualSosSubtitle]}>{copy.sosHelp}</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.actions, landscape && styles.actionsLandscape]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.okay}
            onPress={checkIn}
            style={({ pressed }) => [
              styles.okayButton,
              compact && styles.okayCompact,
              mobility && styles.mobilityOkay,
              pressed && styles.actionPressed,
            ]}
          >
            <LinearGradient
              colors={gradients.green}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={styles.actionGradient}
            >
              <View style={styles.okayIconShell}>
                <MaterialCommunityIcons color={colors.white} name="check-bold" size={21} />
              </View>
              <Text style={[styles.okayLabel, visual && styles.visualAction]}>{copy.okay}</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.rescue}
            onPress={() => router.push('/senior/contacts')}
            style={({ pressed }) => [
              styles.rescueButton,
              compact && styles.rescueCompact,
              mobility && styles.mobilityRescue,
              pressed && styles.actionPressed,
            ]}
          >
            <LinearGradient
              colors={gradients.amber}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={styles.actionGradient}
            >
              <View style={styles.rescueIconShell}>
                <MaterialCommunityIcons color={colors.amberDark} name="ambulance" size={21} />
              </View>
              <View style={styles.rescueCopy}>
                <Text style={[styles.rescueTitle, visual && styles.visualRescueTitle]}>{copy.rescueTitle}</Text>
                <Text style={[styles.rescueAction, visual && styles.visualRescueAction]}>{copy.rescueAction}</Text>
              </View>
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      <BottomNav active="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
  header: {
    minHeight: 78,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  headerShell: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.82)',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    ...shadows.card,
  },
  headerCompact: { minHeight: 67, paddingTop: 6, paddingBottom: 3 },
  headerShellCompact: { minHeight: 58, paddingVertical: 5 },
  brandBadge: { width: 48, height: 48, borderRadius: 15 },
  brandBadgeCompact: { width: 42, height: 42, borderRadius: 13 },
  identity: { flex: 1, minWidth: 0 },
  greeting: { color: colors.inkMuted, fontSize: 12, lineHeight: 16, fontFamily: typography.medium },
  visualGreeting: { fontSize: 16, lineHeight: 21, color: colors.ink },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { color: colors.ink, fontSize: 23, lineHeight: 27, fontFamily: typography.rounded, flexShrink: 1, letterSpacing: -0.5 },
  visualName: { fontSize: 28, lineHeight: 33 },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.greenSoft,
    borderWidth: 1,
    borderColor: 'rgba(32, 155, 87, 0.14)',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  offlineBadgeText: { color: colors.greenDark, fontSize: 12, lineHeight: 15, fontFamily: typography.bold },
  helper: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: 'rgba(229, 247, 236, 0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(32, 155, 87, 0.13)',
    ...shadows.card,
  },
  helperIconShell: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.76)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: { flex: 1, color: colors.greenDark, fontSize: 13, lineHeight: 18, fontFamily: typography.bold },
  visualHelper: { fontSize: 15, lineHeight: 20 },
  checkInNotice: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
    minHeight: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenSoft,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
    ...shadows.card,
  },
  checkInNoticeText: { color: colors.greenDark, fontSize: 13, fontFamily: typography.bold, textAlign: 'center' },
  main: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  mainLandscape: { flexDirection: 'row', gap: spacing.lg },
  sosArea: { flex: 1, minHeight: 0, width: '100%', alignItems: 'center', justifyContent: 'center' },
  sosAura: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(227, 23, 34, 0.055)',
    borderWidth: 4,
    borderColor: 'rgba(227, 23, 34, 0.10)',
  },
  sosButton: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.red,
    padding: spacing.lg,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.88)',
    overflow: 'hidden',
    ...shadows.sos,
  },
  sosShine: {
    position: 'absolute',
    width: '72%',
    height: '36%',
    top: -8,
    left: '5%',
    backgroundColor: 'rgba(255,255,255,0.10)',
    transform: [{ rotate: '-10deg' }],
  },
  sosInnerRing: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    margin: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.30)',
  },
  sosIconShell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  sosPressed: { transform: [{ scale: 0.96 }], opacity: 0.88 },
  sosTitle: { color: colors.white, fontSize: 40, lineHeight: 44, fontFamily: typography.rounded, letterSpacing: -1 },
  sosSubtitle: { color: colors.white, fontSize: 12, lineHeight: 15, fontFamily: typography.bold, textAlign: 'center', maxWidth: 142 },
  visualSosSubtitle: { fontSize: 14, lineHeight: 18 },
  actions: { width: '100%', flexShrink: 0, gap: spacing.sm },
  actionsLandscape: { width: '52%', justifyContent: 'center' },
  okayButton: {
    minHeight: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.green,
    overflow: 'hidden',
    ...shadows.raised,
  },
  okayCompact: { minHeight: 56 },
  mobilityOkay: { minHeight: 66 },
  actionGradient: {
    flex: 1,
    width: '100%',
    minHeight: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  okayIconShell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  okayLabel: { color: colors.white, fontSize: 21, fontFamily: typography.rounded },
  rescueButton: {
    minHeight: 62,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: '#E3B64F',
    backgroundColor: colors.amberSoft,
    overflow: 'hidden',
    ...shadows.card,
  },
  rescueCompact: { minHeight: 54 },
  mobilityRescue: { minHeight: 58 },
  rescueIconShell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  rescueCopy: { flexShrink: 1, alignItems: 'flex-start' },
  rescueTitle: { color: colors.amberDark, fontSize: 17, lineHeight: 20, fontFamily: typography.rounded },
  rescueAction: { color: colors.amberDark, fontSize: 13, lineHeight: 17, fontFamily: typography.medium },
  visualAction: { fontSize: 24 },
  visualRescueTitle: { fontSize: 19, lineHeight: 23 },
  visualRescueAction: { fontSize: 15, lineHeight: 19 },
  actionPressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
});
