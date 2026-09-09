import * as SecureStore from 'expo-secure-store';

import { FamilyCredentials } from '@/lib/family-sync';

const FAMILY_CREDENTIALS_KEY = 'naknak_family_credentials_v1';

export async function loadFamilyCredentials(): Promise<FamilyCredentials | null> {
  const value = await SecureStore.getItemAsync(FAMILY_CREDENTIALS_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as FamilyCredentials;
  } catch {
    await SecureStore.deleteItemAsync(FAMILY_CREDENTIALS_KEY);
    return null;
  }
}

export async function saveFamilyCredentials(credentials: FamilyCredentials): Promise<void> {
  await SecureStore.setItemAsync(FAMILY_CREDENTIALS_KEY, JSON.stringify(credentials), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearFamilyCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(FAMILY_CREDENTIALS_KEY);
}
