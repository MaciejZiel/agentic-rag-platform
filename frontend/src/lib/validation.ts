/** Sanitize user input by stripping potentially dangerous HTML/script tags */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Validate email format */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Validate that a string is within length limits */
export function isWithinLength(value: string, min: number, max: number): boolean {
  const trimmed = value.trim();
  return trimmed.length >= min && trimmed.length <= max;
}

/** Validate a filename is safe (no path traversal) */
export function isSafeFilename(filename: string): boolean {
  return !/[/\\:*?"<>|]/.test(filename) && !filename.startsWith(".");
}

/** Validate JSON string */
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/** Format validation errors for display */
export function getValidationError(field: string, value: string, rules: {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  email?: boolean;
}): string | null {
  const trimmed = value.trim();

  if (rules.required && !trimmed) {
    return `${field} is required`;
  }
  if (rules.minLength && trimmed.length < rules.minLength) {
    return `${field} must be at least ${rules.minLength} characters`;
  }
  if (rules.maxLength && trimmed.length > rules.maxLength) {
    return `${field} must be at most ${rules.maxLength} characters`;
  }
  if (rules.email && !isValidEmail(trimmed)) {
    return "Please enter a valid email address";
  }
  return null;
}
