// Form and data validation utilities

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * Validate username format
 */
export function validateUsername(username: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!username) {
    errors.push('Username is required');
    return { valid: false, errors };
  }

  if (username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }

  if (username.length > 32) {
    errors.push('Username must not exceed 32 characters');
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, underscores, and hyphens');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate Solana wallet address
 */
export function validateWalletAddress(address: string): {
  valid: boolean;
  error?: string;
} {
  if (!address) {
    return { valid: false, error: 'Wallet address is required' };
  }

  // Solana addresses are base58 encoded and 32-44 characters
  if (!/^[1-9A-HJ-NP-Z]{32,44}$/.test(address)) {
    return { valid: false, error: 'Invalid Solana wallet address format' };
  }

  return { valid: true };
}

/**
 * Validate signup form data
 */
export function validateSignupForm(data: {
  email: string;
  password: string;
  full_name?: string;
  username?: string;
}): {
  valid: boolean;
  errors: Record<string, string[]>;
} {
  const errors: Record<string, string[]> = {};

  // Email validation
  if (!data.email) {
    errors.email = ['Email is required'];
  } else if (!validateEmail(data.email)) {
    errors.email = ['Invalid email format'];
  }

  // Password validation
  if (!data.password) {
    errors.password = ['Password is required'];
  } else if (data.password.length < 8) {
    errors.password = ['Password must be at least 8 characters long'];
  }

  // Full name validation
  if (data.full_name && data.full_name.length > 100) {
    errors.full_name = ['Full name must not exceed 100 characters'];
  }

  // Username validation
  if (data.username) {
    const usernameValidation = validateUsername(data.username);
    if (!usernameValidation.valid) {
      errors.username = usernameValidation.errors;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate login form data
 */
export function validateLoginForm(data: {
  email: string;
  password: string;
}): {
  valid: boolean;
  errors: Record<string, string[]>;
} {
  const errors: Record<string, string[]> = {};

  if (!data.email) {
    errors.email = ['Email is required'];
  } else if (!validateEmail(data.email)) {
    errors.email = ['Invalid email format'];
  }

  if (!data.password) {
    errors.password = ['Password is required'];
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate profile update data
 */
export function validateProfileUpdate(data: {
  full_name?: string;
  username?: string;
  bio?: string;
  avatar_url?: string;
}): {
  valid: boolean;
  errors: Record<string, string[]>;
} {
  const errors: Record<string, string[]> = {};

  if (data.full_name && data.full_name.length > 100) {
    errors.full_name = ['Full name must not exceed 100 characters'];
  }

  if (data.username) {
    const usernameValidation = validateUsername(data.username);
    if (!usernameValidation.valid) {
      errors.username = usernameValidation.errors;
    }
  }

  if (data.bio && data.bio.length > 500) {
    errors.bio = ['Bio must not exceed 500 characters'];
  }

  if (data.avatar_url && !isValidUrl(data.avatar_url)) {
    errors.avatar_url = ['Invalid URL format'];
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .slice(0, 1000); // Limit to 1000 chars
}
