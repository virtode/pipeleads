export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—'

  const digits = phone.replace(/[\s\-().]/g, '')

  if (digits.startsWith('+33') && digits.length === 12) {
    const local = digits.slice(3) // 9 digits after +33
    return `+33 ${local[0]} ${local.slice(1, 3)} ${local.slice(3, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`
  }

  if (digits.startsWith('0') && digits.length === 10) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`
  }

  return phone
}
