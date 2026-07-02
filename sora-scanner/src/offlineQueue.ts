import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'sora_scanner_offline_queue';

export interface QueuedScan {
  id: string;
  barcode: string;
  pairingCode: string;
  scannedAt: number;
  attempts: number;
  lastError?: string | null;
}

const readQueue = async (): Promise<QueuedScan[]> => {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = async (queue: QueuedScan[]): Promise<void> => {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const createScanId = (): string => {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SCAN-${Date.now().toString(36).toUpperCase()}-${random}`;
};

export const getQueuedScanCount = async (pairingCode?: string): Promise<number> => {
  const queue = await readQueue();
  if (!pairingCode) return queue.length;
  return queue.filter((item) => item.pairingCode === pairingCode).length;
};

export const enqueueScan = async (
  scan: Omit<QueuedScan, 'attempts' | 'lastError'>
): Promise<QueuedScan> => {
  const queue = await readQueue();
  const existing = queue.find((item) => item.id === scan.id);
  if (existing) return existing;

  const item: QueuedScan = {
    ...scan,
    attempts: 0,
    lastError: null,
  };

  queue.push(item);
  await writeQueue(queue);
  return item;
};

export const listQueuedScans = async (pairingCode: string): Promise<QueuedScan[]> => {
  const queue = await readQueue();
  return queue
    .filter((item) => item.pairingCode === pairingCode)
    .sort((a, b) => a.scannedAt - b.scannedAt);
};

export const removeQueuedScan = async (id: string): Promise<void> => {
  const queue = await readQueue();
  await writeQueue(queue.filter((item) => item.id !== id));
};

export const markQueuedScanFailed = async (
  id: string,
  error: string
): Promise<void> => {
  const queue = await readQueue();
  await writeQueue(
    queue.map((item) =>
      item.id === id
        ? { ...item, attempts: item.attempts + 1, lastError: error }
        : item
    )
  );
};
