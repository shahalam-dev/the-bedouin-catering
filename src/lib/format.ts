/** 3500 -> "RM 35", 3550 -> "RM 35.50". Prices are stored as integer sen. */
export function formatRM(sen: number): string {
  const rm = sen / 100
  return `RM ${Number.isInteger(rm) ? rm.toLocaleString('en-MY') : rm.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
