/* ============================================================
   PRIMEIRO ACESSO — motorista define a própria senha
   ============================================================ */
import { api } from '../api.js';
import { icon, toast, escapeHtml } from '../ui.js';

export function renderFirstAccess(root, user, onDone, onLogout) {
  root.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card glass fade-in">
        <div class="auth-logo"><img src="assets/logo.png" alt="Flex Drive"></div>
        <div class="auth-title">Crie sua senha</div>
        <div class="auth-sub">Olá, ${escapeHtml(user.full_name?.split(' ')[0] || 'motorista')}! Este é seu primeiro acesso — defina uma senha pessoal para continuar.</div>
        <div class="alert alert-error" id="fa-alert"></div>
        <form id="fa-form">
          <div class="field"><label for="np">Nova senha</label><input class="input" type="password" id="np" minlength="6" placeholder="mínimo 6 caracteres" autocomplete="new-password" required></div>
          <div class="field"><label for="np2">Confirmar senha</label><input class="input" type="password" id="np2" minlength="6" placeholder="repita a senha" autocomplete="new-password" required></div>
          <button class="btn btn-blue btn-block" type="submit" id="fa-btn" style="margin-top:.4rem">${icon('shield')} Salvar e entrar</button>
        </form>
        <button class="btn btn-glass btn-block" id="fa-logout" style="margin-top:.7rem">Sair</button>
      </div>
    </div>`;

  const alertBox = root.querySelector('#fa-alert');
  const form = root.querySelector('#fa-form');
  const btn = root.querySelector('#fa-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBox.classList.remove('show');
    const np = form.np.value, np2 = form.np2.value;
    if (np.length < 6) { alertBox.textContent = 'A senha precisa ter ao menos 6 caracteres.'; alertBox.classList.add('show'); return; }
    if (np !== np2) { alertBox.textContent = 'As senhas não conferem.'; alertBox.classList.add('show'); return; }
    btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px"></span> Salvando...';
    try {
      await api.setOwnPassword(np);
      toast('Senha criada! Bem-vindo. 🎉', 'ok');
      onDone();
    } catch (err) {
      alertBox.textContent = err.message || 'Não foi possível salvar a senha.';
      alertBox.classList.add('show');
      btn.disabled = false; btn.innerHTML = `${icon('shield')} Salvar e entrar`;
    }
  });

  root.querySelector('#fa-logout').onclick = onLogout;
}
