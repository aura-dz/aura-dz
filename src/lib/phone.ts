export function normalizeAlgerianPhone(value: string): string {
  let digits = value.replace(/\D/g, "");

  if (digits.startsWith("00213")) digits = digits.slice(5);
  else if (digits.startsWith("213")) digits = digits.slice(3);
  else if (digits.startsWith("0")) digits = digits.slice(1);

  if (!/^\d{9}$/.test(digits)) throw new Error("Invalid Algerian phone number");
  return `+213${digits}`;
}