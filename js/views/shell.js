/* ============================================================
   SHELL — sidebar + topbar, compartilhado por Empresa e Cliente
   ============================================================ */
import { icon, fmt } from '../ui.js';
import { IS_DEMO } from '../config.js';

export function buildShell({ root, user, roleLabel, nav, onNav, onLogout }) {
  root.innerHTML = `
    <div class="shell">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-logo"><span class="logo-mark" aria-hidden="true">F</span><img src="assets/logo.png" alt="Flex Drive"></div>
        <nav class="nav-list" id="nav-list">
          ${nav.map((n) => `
            <button class="nav-item" data-key="${n.key}">
              <span class="nav-ico">${icon(n.icon)}</span>
              <span>${n.label}</span>
              ${n.count != null ? `<span class="nav-count" data-count="${n.key}">${n.count}</span>` : ''}
            </button>`).join('')}
        </nav>
        <div class="sidebar-user">
          <div class="avatar">${fmt.initials(user.full_name)}</div>
          <div class="meta">
            <div class="name">${user.full_name || 'Usuário'}</div>
            <div class="role">${roleLabel}</div>
          </div>
          <button class="logout-btn" id="logout-btn" title="Sair">${icon('logout')}</button>
        </div>
      </aside>
      <div class="backdrop" id="backdrop"></div>

      <div class="main">
        <header class="topbar">
          <button class="menu-toggle" id="menu-toggle">${icon('menu')}</button>
          <div>
            <div class="page-title" id="page-title">—</div>
            <div class="page-sub" id="page-sub"></div>
          </div>
          <div class="spacer"></div>
          <div class="topbar-actions" id="topbar-actions"></div>
          ${IS_DEMO ? '<span class="badge badge-amber"><span class="dot"></span>Modo Demo</span>' : ''}
        </header>
        <main class="content" id="content"></main>
      </div>
    </div>
  `;

  const sidebar = root.querySelector('#sidebar');
  const backdrop = root.querySelector('#backdrop');
  const navList = root.querySelector('#nav-list');
  const content = root.querySelector('#content');

  // Rotula as células das tabelas (data-label) para virarem cards legíveis no mobile
  const labelizeTables = () => {
    content.querySelectorAll('table.tbl').forEach((tbl) => {
      const heads = [...tbl.querySelectorAll('thead th')].map((th) => th.textContent.trim());
      tbl.querySelectorAll('tbody tr').forEach((tr) => {
        [...tr.children].forEach((td, i) => { if (heads[i] && !td.hasAttribute('data-label')) td.setAttribute('data-label', heads[i]); });
      });
    });
  };
  new MutationObserver(labelizeTables).observe(content, { childList: true, subtree: true });

  const closeSidebar = () => { sidebar.classList.remove('open'); backdrop.classList.remove('show'); };
  root.querySelector('#menu-toggle').onclick = () => { sidebar.classList.add('open'); backdrop.classList.add('show'); };
  backdrop.onclick = closeSidebar;
  root.querySelector('#logout-btn').onclick = onLogout;

  navList.addEventListener('click', (e) => {
    const b = e.target.closest('.nav-item'); if (!b) return;
    setActive(b.dataset.key);
    closeSidebar();
    onNav(b.dataset.key);
  });

  function setActive(key) {
    navList.querySelectorAll('.nav-item').forEach((x) => x.classList.toggle('active', x.dataset.key === key));
  }
  function setTitle(title, sub = '') {
    root.querySelector('#page-title').textContent = title;
    root.querySelector('#page-sub').textContent = sub;
  }
  function setCount(key, n) {
    const el = root.querySelector(`[data-count="${key}"]`);
    if (el) el.textContent = n;
  }

  const topbarActions = root.querySelector('#topbar-actions');
  return { content, setActive, setTitle, setCount, topbarActions };
}
