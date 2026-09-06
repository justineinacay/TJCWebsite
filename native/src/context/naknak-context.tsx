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
  setLanguage: (language: Language) => void;
  startRole: (role: Role) => void;
  setName: (name: string) => void;
  finishSeniorOnboarding: (needs: AccessibilityNeed[]) => void;
  finishCaregiverOnboarding: () => void;
  addContact: (contact: Omit<EmergencyContact, 'id' | 'primary'>) => void;
  addMedication: (medication: Omit<Medication, 'id' | 'createdAt'>) => void;
  markMedicationTaken: (medicationId: string) => void;
  recordCheckIn: () => void;
  recordSosOpened: () => void;
  resetApp: () => Promise<void>;
};

const NakNakContext = createContext<NakNakContextValue | null>(null);

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function NakNakProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<NakNakState>(INITIAL_STATE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    loadState()
      .then((stored) => {
        if (active) setState(stored);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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

  const recordCheckIn = useCallback(() => {
    const now = new Date().toISOString();
    setState((current) => ({
      ...current,
      lastCheckInAt: now,
      events: [
        { id: createId('event'), type: 'check_in_ok' as const, createdAt: now },
        ...current.events,
      ].slice(0, 100),
    }));
  }, []);

  const recordSosOpened = useCallback(() => {
    appendEvent({ type: 'sos_opened', detail: 'Emergency screen opened locally' });
  }, [appendEvent]);

  const resetApp = useCallback(async () => {
    const notificationIds = state.medications.flatMap((medication) => medication.notificationIds);
    await cancelMedicationReminders(notificationIds);
    await clearState();
    setState(INITIAL_STATE);
  }, [state.medications]);

  const value = useMemo<NakNakContextValue>(
    () => ({
      state,
      loading,
      setLanguage,
      startRole,
      setName,
      finishSeniorOnboarding,
      finishCaregiverOnboarding,
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
      loading,
      markMedicationTaken,
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
