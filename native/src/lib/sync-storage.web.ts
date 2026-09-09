import { FamilyCredentials } from '@/lib/family-sync';

const FAMILY_CREDENTIALS_KEY = 'naknak_family_credentials_v1';

export async function loadFamilyCredentials(): Promise<FamilyCredentials | null> {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(FAMILY_CREDENTIALS_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as FamilyCredentials;
  } catch {
    window.localStorage.removeItem(FAMILY_CREDENTIALS_KEY);
    return null;
  }
}

export async function saveFamilyCredentials(credentials: FamilyCredentials): Promise<void> {
  if (typeof window !== 'undefined') window.localStorage.setItem(FAMILY_CREDENTIALS_KEY, JSON.stringify(credentials));
}

export async function clearFamilyCredentials(): Promise<void> {
  if (typeof window !== 'undefined') window.localStorage.removeItem(FAMILY_CREDENTIALS_KEY);
}
