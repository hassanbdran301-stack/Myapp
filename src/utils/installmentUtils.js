/**
 * Calculate installment schedule from a given debt amount and installment cap.
 * All installments equal the cap, except the last which is the remainder.
 */
export function calculateInstallments(totalDebt, installmentCap) {
  if (totalDebt <= 0 || installmentCap <= 0) return []

  const rounded = Math.round(totalDebt * 100) / 100
  const fullCount = Math.floor(rounded / installmentCap)
  const remainder = Math.round((rounded % installmentCap) * 100) / 100

  const installments = []
  for (let i = 0; i < fullCount; i++) {
    installments.push(installmentCap)
  }
  if (remainder > 0) {
    installments.push(remainder)
  }
  return installments
}

/**
 * Recalculate the full installment schedule after a confirmed payment.
 *
 * @param {Array} existingInstallments - current installments array from Firestore
 * @param {number} paidIndex          - index of the installment that was paid
 * @param {number} paidAmount         - amount actually paid
 * @param {number} installmentCap     - agreed installment cap (never changes)
 * @returns {Array} new installments array
 */
export function recalculateAfterPayment(existingInstallments, paidIndex, paidAmount, installmentCap) {
  // Mark the paid installment as confirmed
  const updated = existingInstallments.map((inst, idx) => {
    if (idx === paidIndex) {
      return {
        ...inst,
        paidAmount,
        status: 'confirmed',
        confirmedAt: new Date().toISOString(),
      }
    }
    return inst
  })

  // Calculate remaining debt from all non-confirmed installments
  const confirmedDebt = updated
    .filter((i) => i.status === 'confirmed')
    .reduce((sum, i) => sum + i.paidAmount, 0)

  const originalTotal = existingInstallments.reduce((sum, i) => sum + i.dueAmount, 0)
  const remainingDebt = Math.round((originalTotal - confirmedDebt) * 100) / 100

  if (remainingDebt <= 0) {
    // All paid - keep confirmed installments only
    return updated.filter((i) => i.status === 'confirmed')
  }

  // Keep only confirmed installments, recalculate the rest
  const confirmedOnes = updated.filter((i) => i.status === 'confirmed')
  const newAmounts = calculateInstallments(remainingDebt, installmentCap)

  const newPending = newAmounts.map((amount, idx) => ({
    id: confirmedOnes.length + idx + 1,
    dueAmount: amount,
    paidAmount: 0,
    status: 'pending',
    paymentDate: null,
    confirmedAt: null,
    signature: null,
    confirmedBy: null,
    isExtra: idx >= existingInstallments.length - paidIndex - 1,
  }))

  return [...confirmedOnes, ...newPending]
}

/**
 * Build the initial installments array for a new debt.
 */
export function buildInitialInstallments(totalDebt, installmentCap) {
  const amounts = calculateInstallments(totalDebt, installmentCap)
  return amounts.map((amount, idx) => ({
    id: idx + 1,
    dueAmount: amount,
    paidAmount: 0,
    status: 'pending',      // pending | awaiting_confirmation | confirmed
    paymentDate: null,
    confirmedAt: null,
    signature: null,
    confirmedBy: null,
    isExtra: false,
  }))
}

/**
 * Compute remaining debt from installments array.
 */
export function getRemainingDebt(installments) {
  return Math.round(
    installments
      .filter((i) => i.status !== 'confirmed')
      .reduce((sum, i) => sum + i.dueAmount, 0) * 100
  ) / 100
}

/**
 * Format number with commas and two decimals (e.g. 1,500.00 ₪)
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('ar-IL', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' ₪'
}
