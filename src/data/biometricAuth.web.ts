export interface BiometricCapability {
  hardware: boolean;
  enrolled: boolean;
  label: string;
}

/**
 * Purpose: web stub — biometrics are a phone-app feature.
 * Inputs: none.
 * Outputs: unavailable capability.
 * Side effects: none.
 * Design decisions: no expo-local-authentication import.
 */
export async function getBiometricCapability(): Promise<BiometricCapability> {
  return { hardware: false, enrolled: false, label: 'Biometrics' };
}

/**
 * Purpose: web never authenticates with biometrics.
 */
export async function authenticateWithBiometrics(): Promise<boolean> {
  return false;
}
