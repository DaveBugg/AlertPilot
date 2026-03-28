export interface AuthUser {
  username: string;
  role: string;
  totp_enabled: boolean;
}

export interface AuthState {
  /** null = loading, false = not authenticated, AuthUser = authenticated */
  user: AuthUser | null | false;
  token: string;
  setupRequired: boolean;
}

export interface LoginResponse {
  ok: boolean;
  token?: string;
  user?: AuthUser;
  totp_required?: boolean;
}

export interface TotpSetupResponse {
  secret: string;
  uri: string;
  qr_png_base64: string;
}
