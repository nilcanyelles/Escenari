// Validació lleugera de correu/telèfon. Un camp buit és vàlid (són opcionals);
// només es marca com a error quan hi ha text que no sembla un correu/telèfon real.

export function isValidEmail(email: string): boolean {
  const v = (email || "").trim();
  if (!v) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

export function isValidPhone(phone: string): boolean {
  const v = (phone || "").trim();
  if (!v) return true;
  if (!/^\+?[\d\s-]+$/.test(v)) return false;
  const digits = v.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15;
}
