import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Dollar amount, or "n/a" when the model has no verified price (cost is null). */
export function formatCost(cost: number | null | undefined, digits = 4): string {
  return cost == null ? "n/a" : `$${cost.toFixed(digits)}`
}
