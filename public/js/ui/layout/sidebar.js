import { el } from '../../utils/dom.js';
import { getNavItems, getCurrentRoute } from '../../core/router.js';

export function renderSidebar(onNavigate) {
  const sidebar = el('aside', { className: 'sidebar' });
  const nav = el('nav', { className: 'sidebar-nav' });
  const { path } = getCurrentRoute();

  getNavItems().forEach((item) => {
    const link = el('a', {
      href: `#${item.path}`,
      className: `nav-link ${path === item.path ? 'active' : ''}`,
      onclick: (e) => {
        e.preventDefault();
        onNavigate(item.path);
      }
    }, [
      el('span', { className: 'nav-icon', textContent: item.icon }),
      el('span', { textContent: item.label })
    ]);
    nav.appendChild(link);
  });

  sidebar.appendChild(nav);
  return sidebar;
}

export function updateSidebarActive(path) {
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.getAttribute('href') === `#${path}`);
  });
}
