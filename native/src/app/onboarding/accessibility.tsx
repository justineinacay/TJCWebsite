import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Href, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PageHeader, PrimaryButton, Screen } from '@/components/ui';
import { ACCESSIBILITY_OPTIONS, COPY } from '@/constants/copy';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';
import { useNakNak } from '@/context/naknak-context';
import { AccessibilityNeed } from '@/types/naknak';

const NEEDS = Object.keys(ACCESSIBILITY_OPTIONS) as AccessibilityNeed[];

export default function AccessibilityOnboardingScreen() {
  const { state, finishSeniorOnboarding } = useNakNak();
  const copy = COPY[state.profile.language];
  const [selected, setSelected] = useState<AccessibilityNeed[]>(state.profile.accessibilityNeeds);

  const toggle = (need: AccessibilityNeed) => {
    setSelected((current) =>
      current.includes(need) ? current.filter((item) => item !== need) : [...current, need],
    );
  };

  const finish = () => {
    const editingExistingProfile = state.profile.onboarded;
    finishSeniorOnboarding(selected);
    router.replace((editingExistingProfile ? '/senior/home' : '/onboarding/pairing') as Href);
  };

  return (
    <Screen contentStyle={styles.content}>
      <PageHeader
        title={copy.accessibilityTitle(state.profile.name)}
        description={copy.accessibilityDescription}
        onBack={() => router.back()}
      />

      <View style={styles.options} accessibilityRole="list">
        {NEEDS.map((need) => {
          const option = ACCESSIBILITY_OPTIONS[need];
          const isSelected = selected.includes(need);
          return (
            <Pressable
              key={need}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={`${option.label[state.profile.language]}. ${option.description[state.profile.language]}`}
              onPress={() => toggle(need)}
              style={({ pressed }) => [
                styles.option,
                isSelected && styles.optionSelected,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.optionIcon, isSelected && styles.optionIconSelected]}>
                <MaterialCommunityIcons
                  color={isSelected ? colors.white : colors.redDark}
                  name={option.icon}
                  size={25}
                />
              </View>
              <View style={styles.optionCopy}>
                <Text style={styles.optionTitle}>{option.label[state.profile.language]}</Text>
                <Text style={styles.optionDescription}>{option.description[state.profile.language]}</Text>
              </View>
              <View style={[styles.check, isSelected && styles.checkSelected]}>
                {isSelected ? (
                  <MaterialCommunityIcons color={colors.white} name="check-bold" size={18} />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <PrimaryButton label={selected.length ? `${copy.finish} (${selected.length})` : copy.skip} onPress={finish} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl },
  options: { gap: spacing.md },
  option: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
    ...shadows.raised,
  },
  optionSelected: { borderColor: colors.red, backgroundColor: colors.redSoft },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  optionIconSelected: { backgroundColor: colors.red },
  optionCopy: { flex: 1, gap: 3 },
  optionTitle: { color: colors.ink, fontSize: 17, lineHeight: 21, fontFamily: typography.rounded },
  optionDescription: { color: colors.inkMuted, fontSize: 14, lineHeight: 19, fontFamily: typography.regular },
  check: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSelected: { backgroundColor: colors.green, borderColor: colors.green },
  pressed: { opacity: 0.72 },
});
