/* ============================================================
   BIOMETRIA — desbloqueio por digital / Face ID (WebAuthn)
   Convênio de dispositivo: guarda o token da sessão no aparelho,
   protegido por um gesto biométrico do sistema operacional.
   Funciona em celulares com autenticador de plataforma.
   ============================================================ */
const KEY = 'flexdrive_bio';

const b64 = {
  enc: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))),
  dec: (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0)),
};

function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }

export async function biometricAvailable() {
  try {
    if (!window.PublicKeyCredential || !navigator.credentials || !window.isSecureContext) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

export function isEnrolled() { return !!load()?.credId; }
export function enrolledEmail() { return load()?.email || null; }
export function storedToken() { return load()?.token || null; }
export function disableBiometric() { localStorage.removeItem(KEY); }

/* registra a biometria deste aparelho para o usuário logado */
export async function enrollBiometric(user, token) {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Flex Drive' },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: user.email || 'motorista',
        displayName: user.full_name || 'Motorista',
      },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
      timeout: 60000,
    },
  });
  if (!cred) throw new Error('Não foi possível registrar a biometria.');
  localStorage.setItem(KEY, JSON.stringify({ credId: b64.enc(cred.rawId), email: user.email, token }));
  return true;
}

/* pede o gesto biométrico; retorna true se o SO confirmar */
export async function verifyBiometric() {
  const rec = load();
  if (!rec?.credId) throw new Error('Biometria não configurada neste aparelho.');
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: 'public-key', id: b64.dec(rec.credId) }],
      userVerification: 'required',
      timeout: 60000,
    },
  });
  return !!assertion;
}
