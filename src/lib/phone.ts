/** Kyrgyzstan numbers: +996 + nine national digits. No guessing other countries. */
export function normalizePhone(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const compact = input.trim().replace(/[\s()\-]/g, "");
  let national: string;
  if (compact.startsWith("+996")) national = compact.slice(4);
  else if (compact.startsWith("996") && compact.length === 12) national = compact.slice(3);
  else if (compact.startsWith("0") && compact.length === 10) national = compact.slice(1);
  else national = compact;
  return /^[2-9]\d{8}$/.test(national) ? `+996${national}` : null;
}
