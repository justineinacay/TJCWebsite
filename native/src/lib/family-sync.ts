export const SUPABASE_URL = 'https://louqshzgqutxydfqgnyz.supabase.co';
// This is Supabase's public anonymous client key, not a secret/service-role key.
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvdXFzaHpncXV0eHlkZnFnbnl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMjgzMTUsImV4cCI6MjA5ODYwNDMxNX0.tvgCedmaK9OxRqeW1piNNRr4KXT0XFFF5EuJ3692vgU';

export type FamilyCredentials = {
  householdId: string;
  deviceSecret: string;
  seniorId: string;
  seniorName: string;
};

export type FamilyConnection = {
  status: 'local' | 'checking' | 'connected' | 'error';
  seniorName?: string;
  lastConfirmedAt?: string;
  message?: string;
};

type RpcError = { message?: string; hint?: string; details?: string };

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as T | RpcError | null;
  if (!response.ok) {
    const detail = payload && typeof payload === 'object' && 'message' in payload ? payload.message : undefined;
    throw new Error(detail || 'Hindi makakonekta sa NakNak family service.');
  }
  return payload as T;
}

export async function pairNativeDevice(code: string, seniorName: string): Promise<FamilyCredentials> {
  const rows = await rpc<{
    household_id: string;
    device_secret: string;
    senior_id: string;
    senior_name: string;
  }[]>('pair_native_device', {
    p_code: code.trim().toUpperCase(),
    p_label: 'NakNak Native Phone',
    p_senior_name: seniorName.trim(),
  });
  const row = rows?.[0];
  if (!row?.device_secret || !row?.senior_id) throw new Error('Hindi nakumpleto ang pag-connect ng device.');
  return {
    householdId: row.household_id,
    deviceSecret: row.device_secret,
    seniorId: row.senior_id,
    seniorName: row.senior_name,
  };
}

export async function checkFamilyConnection(credentials: FamilyCredentials): Promise<FamilyConnection> {
  const rows = await rpc<{ senior_name: string }[]>('native_device_get_status', {
    p_secret: credentials.deviceSecret,
  });
  const row = rows?.[0];
  if (!row) throw new Error('Hindi na mahanap ang naka-connect na family member.');
  return {
    status: 'connected',
    seniorName: row.senior_name,
    lastConfirmedAt: new Date().toISOString(),
  };
}

export async function reportNativeEvent(
  credentials: FamilyCredentials,
  event: 'check_in_ok' | 'sos_opened',
  clientTime: string,
): Promise<boolean> {
  const rows = await rpc<{ delivered: boolean }[]>('native_device_report', {
    p_secret: credentials.deviceSecret,
    p_event: event,
    p_client_time: clientTime,
  });
  return rows?.[0]?.delivered === true;
}

export async function disconnectNativeDevice(credentials: FamilyCredentials): Promise<boolean> {
  return rpc<boolean>('native_device_disconnect', {
    p_secret: credentials.deviceSecret,
  });
}
