import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { clearState, loadState, saveState } from '@/lib/storage';
import { cancelMedicationReminders } from '@/lib/notifications';
import {
  checkFamilyConnection,
  disconnectNativeDevice,
  FamilyConnection,
  FamilyCredentials,
  pairNativeDevice,
  reportNativeEvent,
} from '@/lib/family-sync';
import { clearFamilyCredentials, loadFamilyCredentials, saveFamilyCredentials } from '@/lib/sync-storage';
import {
  AccessibilityNeed,
  EmergencyContact,
  INITIAL_STATE,
  Language,
  LocalEvent,
  Medication,
  NakNakState,
  Role,
} from '@/types/naknak';

type NakNakContextValue = {
  state: NakNakState;
  loading: boolean;
  familyConnection: FamilyConnection;
  setLanguage: (language: Language) => void;
  startRole: (role: Role) => void;
  setName: (name: string) => void;
  finishSeniorOnboarding: (needs: AccessibilityNeed[]) => void;
  finishCaregiverOnboarding: () => void;
  addContact: (contact: Omit<EmergencyContact, 'id' | 'primary'>) => void;
  addMedication: (medication: Omit<Medication, 'id' | 'createdAt'>) => void;
  markMedicationTaken: (medicationId: string) => void;
  pairWithFamilyCode: (code: string) => Promise<void>;
  disconnectFamily: () => Promise<void>;
  recordCheckIn: () => Promise<boolean>;
  recordSosOpened: () => Promise<boolean>;
  resetApp: () => Promise<void>;
};

const NakNakContext = createContext<NakNakContextValue | null>(null);

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function NakNakProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<NakNakState>(INITIAL_STATE);
  const [loading, setLoading] = useState(true);
  const [familyCredentials, setFamilyCredentials] = useState<FamilyCredentials | null>(null);
  const [familyConnection, setFamilyConnection] = useState<FamilyConnection>({ status: 'local' });

  useEffect(() => {
    let active = true;
    Promise.all([loadState(), loadFamilyCredentials()])
      .then(([stored, credentials]) => {
        if (active) {
          setState(stored);
          setFamilyCredentials(credentials);
          if (credentials) setFamilyConnection({ status: 'checking', seniorName: credentials.seniorName });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (loading || !familyCredentials) return;
    let active = true;
    checkFamilyConnection(familyCredentials)
      .then((connection) => {
        if (active) setFamilyConnection(connection);
      })
      .catch((error: unknown) => {
        if (active) {
          setFamilyConnection({
            status: 'error',
            seniorName: familyCredentials.seniorName,
            message: error instanceof Error ? error.message : 'Hindi makumpirma ang family connection.',
          });
        }
      });
    return () => {
      active = false;
    };
  }, [familyCredentials, loading]);

  useEffect(() => {
    if (!loading) void saveState(state);
  }, [loading, state]);

  const setLanguage = useCallback((language: Language) => {
    setState((current) => ({
      ...current,
      profile: { ...current.profile, language },
    }));
  }, []);

  const startRole = useCallback((role: Role) => {
    setState((current) => ({
      ...current,
      profile: {
        ...current.profile,
        role,
        name: '',
        accessibilityNeeds: [],
        onboarded: false,
      },
    }));
  }, []);

  const setName = useCallback((name: string) => {
    setState((current) => ({
      ...current,
      profile: { ...current.profile, name: name.trim() },
    }));
  }, []);

  const finishSeniorOnboarding = useCallback((accessibilityNeeds: AccessibilityNeed[]) => {
    setState((current) => ({
      ...current,
      profile: { ...current.profile, accessibilityNeeds, onboarded: true },
    }));
  }, []);

  const finishCaregiverOnboarding = useCallback(() => {
    setState((current) => ({
      ...current,
      profile: { ...current.profile, onboarded: true },
    }));
  }, []);

  const addContact = useCallback((contact: Omit<EmergencyContact, 'id' | 'primary'>) => {
    setState((current) => ({
      ...current,
      contacts: [
        ...current.contacts,
        {
          ...contact,
          id: createId('contact'),
          primary: current.contacts.length === 0,
        },
      ],
    }));
  }, []);

  const addMedication = useCallback((medication: Omit<Medication, 'id' | 'createdAt'>) => {
    setState((current) => ({
      ...current,
      medications: [
        ...current.medications,
        { ...medication, id: createId('medication'), createdAt: new Date().toISOString() },
      ],
    }));
  }, []);

  const appendEvent = useCallback((event: Omit<LocalEvent, 'id' | 'createdAt'>) => {
    setState((current) => ({
      ...current,
      events: [
        { ...event, id: createId('event'), createdAt: new Date().toISOString() },
        ...current.events,
      ].slice(0, 100),
    }));
  }, []);

  const markMedicationTaken = useCallback(
    (medicationId: string) => {
      const medication = state.medications.find((item) => item.id === medicationId);
      appendEvent({
        type: 'medication_taken',
        detail: medication ? `${medication.name} ${medication.dose}` : medicationId,
      });
    },
    [appendEvent, state.medications],
  );

  const reportToFamily = useCallback(async (event: 'check_in_ok' | 'sos_opened', at: string) => {
    if (!familyCredentials) return false;
    try {
      const delivered = await reportNativeEvent(familyCredentials, event, at);
      if (delivered) {
        setFamilyConnection({
          status: 'connected',
          seniorName: familyCredentials.seniorName,
          lastConfirmedAt: new Date().toISOString(),
        });
      }
      return delivered;
    } catch (error) {
      setFamilyConnection({
        status: 'error',
        seniorName: familyCredentials.seniorName,
        message: error instanceof Error ? error.message : 'Naka-save sa phone pero hindi naipadala.',
      });
      return false;
    }
  }, [familyCredentials]);

  const pairWithFamilyCode = useCallback(async (code: string) => {
    setFamilyConnection({ status: 'checking' });
    try {
      const credentials = await pairNativeDevice(code, state.profile.name);
      await saveFamilyCredentials(credentials);
      setFamilyCredentials(credentials);
      setFamilyConnection({
        status: 'connected',
        seniorName: credentials.seniorName,
        lastConfirmedAt: new Date().toISOString(),
      });
    } catch (error) {
      setFamilyConnection({
        status: 'error',
        message: error instanceof Error ? error.message : 'Hindi makakonekta gamit ang Family Code.',
      });
      throw error;
    }
  }, [state.profile.name]);

  const disconnectFamily = useCallback(async () => {
    const credentials = familyCredentials;
    let remotelyRevoked = !credentials;
    if (credentials) {
      try {
        remotelyRevoked = await disconnectNativeDevice(credentials);
      } catch {
        remotelyRevoked = false;
      }
    }
    await clearFamilyCredentials();
    setFamilyCredentials(null);
    setFamilyConnection(remotelyRevoked
      ? { status: 'local' }
      : {
          status: 'error',
          message: 'Naka-disconnect ang phone. Tanggalin din ang lumang device sa caregiver dashboard kapag online.',
        });
  }, [familyCredentials]);

  const recordCheckIn = useCallback(async () => {
    const now = new Date().toISOString();
    setState((current) => ({
      ...current,
      lastCheckInAt: now,
      events: [
        { id: createId('event'), type: 'check_in_ok' as const, createdAt: now },
        ...current.events,
      ].slice(0, 100),
    }));
    return reportToFamily('check_in_ok', now);
  }, [reportToFamily]);

  const recordSosOpened = useCallback(async () => {
    const now = new Date().toISOString();
    appendEvent({ type: 'sos_opened', detail: 'Emergency screen opened locally' });
    return reportToFamily('sos_opened', now);
  }, [appendEvent, reportToFamily]);

  const resetApp = useCallback(async () => {
    const notificationIds = state.medications.flatMap((medication) => medication.notificationIds);
    await cancelMedicationReminders(notificationIds);
    if (familyCredentials) {
      try {
        await disconnectNativeDevice(familyCredentials);
      } catch {
        // Reset must still work offline; a caregiver can revoke the stale row later.
      }
    }
    await clearFamilyCredentials();
    await clearState();
    setFamilyCredentials(null);
    setFamilyConnection({ status: 'local' });
    setState(INITIAL_STATE);
  }, [familyCredentials, state.medications]);

  const value = useMemo<NakNakContextValue>(
    () => ({
      state,
      loading,
      familyConnection,
      setLanguage,
      startRole,
      setName,
      finishSeniorOnboarding,
      finishCaregiverOnboarding,
      pairWithFamilyCode,
      disconnectFamily,
      addContact,
      addMedication,
      markMedicationTaken,
      recordCheckIn,
      recordSosOpened,
      resetApp,
    }),
    [
      addContact,
      addMedication,
      finishCaregiverOnboarding,
      finishSeniorOnboarding,
      familyConnection,
      loading,
      markMedicationTaken,
      pairWithFamilyCode,
      disconnectFamily,
      recordCheckIn,
      recordSosOpened,
      resetApp,
      setLanguage,
      setName,
      startRole,
      state,
    ],
  );

  return <NakNakContext.Provider value={value}>{children}</NakNakContext.Provider>;
}

export function useNakNak() {
  const context = useContext(NakNakContext);
  if (!context) throw new Error('useNakNak must be used inside NakNakProvider');
  return context;
}
