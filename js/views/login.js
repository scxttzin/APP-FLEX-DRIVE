/* ============================================================
   TELA DE LOGIN — abas Empresa / Cliente
   ============================================================ */
import { api } from '../api.js';
import { IS_DEMO } from '../config.js';
import { icon, toast } from '../ui.js';
import { biometricAvailable, isEnrolled, enrolledEmail, verifyBiometric, storedToken } from '../biometric.js';

export function renderLogin(root, onLogin) {
  let role = 'empresa';

  root.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card glass fade-in">
        <div class="auth-logo"><img src="assets/logo.png" alt="Flex Drive"></div>
        <div class="auth-title">Bem-vindo de volta</div>
        <div class="auth-sub">Acesse o painel da Flex Drive</div>

        <div class="seg" id="role-seg">
          <button data-role="empresa" class="active">Empresa</button>
          <button data-role="cliente">Motorista</button>
        </div>

        <div class="alert alert-error" id="login-alert"></div>

        <form id="login-form">
          <div class="field">
            <label for="email">E-mail</label>
            <input class="input" type="email" id="email" placeholder="seu@email.com" autocomplete="username" required>
          </div>
          <div class="field">
            <label for="password">Senha</label>
            <input class="input" type="password" id="password" placeholder="••••••••" autocomplete="current-password" required>
          </div>
          <button class="btn btn-blue btn-block" type="submit" id="login-btn" style="margin-top:.4rem">
            ${icon('shield')} Entrar
          </button>
        </form>

        ${IS_DEMO ? `
          <div class="alert alert-info show" style="margin-top:1.4rem;font-size:.8rem">
            <strong>Modo demonstração.</strong> Use uma das contas de teste:<br>
            <span style="display:inline-block;margin-top:.4rem">
              🏢 <strong>Empresa:</strong> empresa@flexdrive.com / flex123<br>
              🚗 <strong>Motorista:</strong> joao@cliente.com / cliente123
            </span>
          </div>` : ''}
      </div>
    </div>
    ${IS_DEMO ? '<div class="demo-tag">● MODO DEMO</div>' : ''}
  `;

  const seg = root.querySelector('#role-seg');
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    role = b.dataset.role;
    seg.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
  });

  const alertBox = root.querySelector('#login-alert');
  const form = root.querySelector('#login-form');
  const btn = root.querySelector('#login-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBox.classList.remove('show');
    const email = form.email.value.trim();
    const password = form.password.value;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px"></span> Entrando...';
    try {
      const user = await api.signIn({ email, password, role });
      toast(`Olá, ${user.full_name?.split(' ')[0] || 'usuário'}!`, 'ok');
      onLogin(user);
    } catch (err) {
      alertBox.textContent = err.message || 'Não foi possível entrar.';
      alertBox.classList.add('show');
      btn.disabled = false;
      btn.innerHTML = `${icon('shield')} Entrar`;
    }
  });

  // Entrada por biometria (aparelhos com digital / Face ID já cadastrados)
  (async () => {
    if (!isEnrolled() || !(await biometricAvailable())) return;
    const card = root.querySelector('.auth-card');
    const seg = root.querySelector('#role-seg');
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <button class="btn btn-blue btn-block" id="bio-btn" style="margin-bottom:.9rem">${icon('shield')} Entrar com biometria</button>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:1.2rem;color:var(--gray-4);font-size:.76rem">
        <span style="flex:1;height:1px;background:var(--gray-6)"></span>ou com e-mail e senha<span style="flex:1;height:1px;background:var(--gray-6)"></span>
      </div>`;
    card.insertBefore(wrap, seg);
    root.querySelector('#bio-btn').onclick = async () => {
      try {
        await verifyBiometric();
        const user = await api.restoreSession(storedToken());
        toast(`Olá, ${user.full_name?.split(' ')[0] || 'usuário'}!`, 'ok');
        onLogin(user);
      } catch (err) { toast(err.message || 'Falha na biometria — use a senha.', 'err'); }
    };
  })();
}
