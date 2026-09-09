import * as LocalAuthentication from 'expo-local-authentication';

export interface BiometricCapability {
  hardware: boolean;
  enrolled: boolean;
  label: string;
}

/**
 * Purpose: describe Face ID / fingerprint availability for the lock picker.
 * Inputs: none (device hardware).
 * Outputs: hardware, enrolled, and a writer-facing label.
 * Side effects: queries expo-local-authentication.
 * Design decisions: native-only file so web Metro never loads the biometric module.
 */
export async function getBiometricCapability(): Promise<BiometricCapability> {
  const hardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = hardware ? await LocalAuthentication.isEnrolledAsync() : false;
  const types = hardware ? await LocalAuthentication.supportedAuthenticationTypesAsync() : [];
  const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
  let label = 'Biometrics';
  if (hasFace && hasFingerprint) {
    label = 'Face ID / fingerprint';
  } else if (hasFace) {
    label = 'Face ID';
  } else if (hasFingerprint) {
    label = 'Fingerprint';
  }
  return { hardware, enrolled, label };
}

/**
 * Purpose: prompt Face ID / fingerprint and return success.
 * Inputs: none (system prompt).
 * Outputs: true when the writer authenticates.
 * Side effects: system biometric sheet; device passcode fallback is disabled so Halo PIN is used instead.
 */
export async function authenticateWithBiometrics(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Halo',
      cancelLabel: 'Use PIN',
      disableDeviceFallback: true,
      fallbackLabel: '',
    });
    return result.success;
  } catch {
    return false;
  }
}
