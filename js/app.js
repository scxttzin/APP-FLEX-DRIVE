/* ============================================================
   FLEX DRIVE APP — ponto de entrada
   Decide entre Login / Área da Empresa / Área do Cliente
   ============================================================ */
import { api } from './api.js';
import { renderLogin } from './views/login.js';
import { renderEmpresa } from './views/empresa.js';
import { renderCliente } from './views/cliente.js';
import { renderFirstAccess } from './views/firstaccess.js';
import { toast, modal, icon } from './ui.js';
import { biometricAvailable, isEnrolled, enrollBiometric } from './biometric.js';

const root = document.getElementById('app');

function showLogin() {
  renderLogin(root, (user) => routeUser(user));
}

async function logout() {
  await api.signOut();
  toast('Sessão encerrada.', 'info');
  showLogin();
}

function routeUser(user) {
  if (user.role === 'cliente' && user.must_change_password) {
    renderFirstAccess(root, user, boot, logout);
    return;
  }
  if (user.role === 'empresa') renderEmpresa(root, user, logout);
  else renderCliente(root, user, logout);
  maybeOfferBiometric(user);
}

/* true apenas em aparelhos móveis (celular/tablet) — a biometria não é oferecida no desktop */
function isMobileDevice() {
  const uaData = navigator.userAgentData;
  if (uaData && typeof uaData.mobile === 'boolean') return uaData.mobile;
  const ua = navigator.userAgent || '';
  const mobileUA = /Android|iPhone|iPad|iPod|Windows Phone|BlackBerry|Mobile/i.test(ua);
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1; // iPad moderno
  const coarseSmall = matchMedia('(pointer: coarse)').matches && matchMedia('(max-width: 820px)').matches;
  return mobileUA || iPadOS || coarseSmall;
}

async function maybeOfferBiometric(user) {
  try {
    // 2) já cadastrada nesta conta/aparelho → nunca mais notificar
    if (isEnrolled() || localStorage.getItem('flexdrive_bio_declined')) return;
    // 1) só aparelhos móveis (desktop não recebe a oferta de biometria)
    if (!isMobileDevice()) return;
    if (!(await biometricAvailable())) return;
    setTimeout(() => {
      const m = modal({
        title: 'Entrar com biometria?', icon: 'shield',
        body: `<p class="body-sm" style="font-size:.95rem">Quer usar a biometria deste aparelho (digital / Face ID) para entrar mais rápido nas próximas vezes?</p>`,
        footer: `<button class="btn btn-glass" data-no>Agora não</button><button class="btn btn-blue" data-yes>${icon('shield')} Ativar biometria</button>`,
      });
      m.overlay.querySelector('[data-no]').onclick = () => { localStorage.setItem('flexdrive_bio_declined', '1'); m.close(); };
      m.overlay.querySelector('[data-yes]').onclick = async () => {
        try { const token = await api.getAuthToken(); await enrollBiometric(user, token); toast('Biometria ativada neste aparelho!', 'ok'); m.close(); }
        catch (e) { toast('Não foi possível ativar a biometria.', 'err'); m.close(); }
      };
    }, 1200);
  } catch (e) { /* ignore */ }
}

async function boot() {
  root.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;
  try {
    const user = await api.currentUser();
    if (user) routeUser(user);
    else showLogin();
  } catch (err) {
    console.error(err);
    showLogin();
  }
}

boot();
