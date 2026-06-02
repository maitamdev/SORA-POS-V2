export const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const toPositiveInt = (value: unknown, fallback = 1): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const parsePagination = (query: Record<string, unknown>) => {
  const page = Math.max(toPositiveInt(query.page, 1), 1);
  const limit = Math.min(Math.max(toPositiveInt(query.limit, 20), 1), 100);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  return { page, limit, from, to };
};

export const emptyToNull = <T extends Record<string, unknown>>(data: T): T => {
  const cleaned = { ...data };
  Object.keys(cleaned).forEach((key) => {
    if (cleaned[key] === '') {
      cleaned[key as keyof T] = null as T[keyof T];
    }
  });
  return cleaned;
};
