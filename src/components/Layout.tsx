import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { getSession, logout } from '../api';
import { useUi } from '../ui';
import {
  IconAlert,
  IconBoxes,
  IconFile,
  IconMenu,
  IconPanel,
  IconPrint,
  IconScan,
  IconSidebar,
  IconTag,
} from './Icons';

const SIDEBAR_KEY = 'evalook-sidebar-collapsed';

const groups = [
  {
    label: 'Bodega',
    links: [
      { to: '/', label: 'Panel', icon: <IconPanel />, end: true },
      { to: '/referencias', label: 'Referencias', icon: <IconTag />, end: false },
      { to: '/inventario', label: 'Bodega', icon: <IconBoxes />, end: false },
      { to: '/entrada', label: 'Entrada', icon: <IconBoxes />, end: false },
      { to: '/pares', label: 'Pares', icon: <IconTag />, end: false },
    ],
  },
  {
    label: 'Salidas',
    links: [
      { to: '/salida-paginas', label: 'Salida páginas', icon: <IconScan />, end: false },
      { to: '/salida-dropi', label: 'Salida Dropi', icon: <IconScan />, end: false },
      { to: '/salida-fabrica', label: 'Salida de fábrica', icon: <IconScan />, end: false },
      { to: '/devolucion', label: 'Devolución', icon: <IconScan />, end: false },
    ],
  },
  {
    label: 'Cuentas',
    links: [
      { to: '/contabilidad', label: 'Contabilidad', icon: <IconFile />, end: false },
      { to: '/exel', label: 'Exel', icon: <IconFile />, end: false },
    ],
  },
  {
    label: 'Códigos',
    links: [
      { to: '/etiquetas', label: 'Etiquetas', icon: <IconPrint />, end: false },
      { to: '/novedades', label: 'Novedades', icon: <IconAlert />, end: false },
      { to: '/informes', label: 'Informes', icon: <IconFile />, end: false },
    ],
  },
];

const names: Record<string, string> = {
  '/': 'Panel',
  '/referencias': 'Referencias',
  '/inventario': 'Bodega',
  '/entrada': 'Entrada',
  '/pares': 'Pares',
  '/salida-paginas': 'Salida páginas',
  '/salida-dropi': 'Salida Dropi',
  '/salida-fabrica': 'Salida de fábrica',
  '/devolucion': 'Devolución',
  '/contabilidad': 'Contabilidad',
  '/exel': 'Exel',
  '/etiquetas': 'Etiquetas',
  '/novedades': 'Novedades',
  '/informes': 'Informes',
};

function readCollapsed() {
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) === '1';
  } catch {
    return false;
  }
}

export function Layout() {
  const { nextQr, openDamage } = useUi();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [canLogout, setCanLogout] = useState(false);
  const todayFull = new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'full',
    timeZone: 'America/Bogota',
  }).format(new Date());
  const todayShort = new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(new Date());

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.title = `${names[location.pathname] || 'Inventario'} · Calzado Evalook`;
  }, [location.pathname]);
  useEffect(() => {
    let alive = true;
    getSession()
      .then((session) => {
        if (alive) setCanLogout(Boolean(session.required));
      })
      .catch(() => {
        if (alive) setCanLogout(false);
      });
    return () => { alive = false; };
  }, []);

  function toggleSidebar() {
    const desktop = window.matchMedia('(min-width: 981px)').matches;
    if (desktop) {
      setCollapsed((current) => {
        const next = !current;
        try {
          window.localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
        } catch {
          /* ignore */
        }
        return next;
      });
      return;
    }
    setMobileOpen((current) => !current);
  }

  return (
    <div className={collapsed ? 'shell sidebar-collapsed' : 'shell'}>
      <aside className={mobileOpen ? 'sidebar open' : 'sidebar'}>
        <div className="brand">
          <span className="mark">EV</span>
          <div className="brand-text">
            <strong>Evalook</strong>
            <small>Calzado</small>
          </div>
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={toggleSidebar}
            aria-label="Cerrar menú"
            title="Cerrar menú"
          >
            <IconSidebar />
          </button>
        </div>
        <nav>
          {groups.map((group) => (
            <div key={group.label} className="nav-group">
              <p className="nav-label">{group.label}</p>
              {group.links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                  title={link.label}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <span>Siguiente código</span>
          <strong>{nextQr}</strong>
          <small>Consecutivo único</small>
        </div>
      </aside>
      {mobileOpen && (
        <button type="button" className="scrim" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} />
      )}
      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="menu-btn"
            onClick={toggleSidebar}
            aria-label={collapsed || !mobileOpen ? 'Abrir menú' : 'Cerrar menú'}
            title={collapsed ? 'Abrir menú' : 'Cerrar o abrir menú'}
          >
            <IconMenu />
            <span>{collapsed ? 'Menú' : 'Menú'}</span>
          </button>
          <p className="topbar-date">
            <span className="date-full">{todayFull}</span>
            <span className="date-short">{todayShort}</span>
          </p>
          <div className="topbar-actions">
            <button type="button" className="btn danger" onClick={() => openDamage('')}>
              Código dañado
            </button>
            {canLogout && (
              <button
                type="button"
                className="btn ghost"
                onClick={async () => {
                  try {
                    await logout();
                  } finally {
                    window.dispatchEvent(new CustomEvent('evalook:auth'));
                  }
                }}
              >
                Salir
              </button>
            )}
          </div>
        </header>
        <div className="main-inner">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
