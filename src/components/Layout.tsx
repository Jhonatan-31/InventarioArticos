import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { getSession, logout } from '../api';
import { useUi } from '../ui';
import { IconAlert, IconBoxes, IconFile, IconPanel, IconPrint, IconScan, IconTag } from './Icons';

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
  '/etiquetas': 'Etiquetas',
  '/novedades': 'Novedades',
  '/informes': 'Informes',
};

export function Layout() {
  const { nextQr, openDamage } = useUi();
  const location = useLocation();
  const [open, setOpen] = useState(false);
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

  useEffect(() => { setOpen(false); }, [location.pathname]);
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

  return (
    <div className="shell">
      <aside className={open ? 'sidebar open' : 'sidebar'}>
        <div className="brand">
          <span className="mark">EV</span>
          <div>
            <strong>Evalook</strong>
            <small>Calzado</small>
          </div>
        </div>
        <nav>
          {groups.map((group) => (
            <div key={group.label}>
              <p className="nav-label">{group.label}</p>
              {group.links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                >
                  {link.icon}
                  {link.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <span>Siguiente código</span>
          <strong>{nextQr}</strong>
          <small>Consecutivo único para todas las referencias</small>
        </div>
      </aside>
      {open && <button type="button" className="scrim" aria-label="Cerrar menú" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button type="button" className="menu-btn" onClick={() => setOpen(true)} aria-label="Abrir menú">
            Menú
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
