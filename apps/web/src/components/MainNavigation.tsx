import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import ConnectWalletButton from './ConnectWalletButton';
import DevMockConnect from './DevMockConnect';
import classes from './MainNavigation.module.css';

const links = [
  { to: '/', label: 'GemGrooves', end: true },
  { to: '/OurPurpose', label: 'Our Purpose' },
  { to: '/TheLounge', label: 'The Lounge' },
  { to: '/TheStudio', label: 'The Studio' },
  { to: '/TheRecordShop', label: 'The Record Shop' },
];

function MainNavigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className={classes.header}>
      <button
        type="button"
        className={classes.hamburger}
        onClick={() => setIsMenuOpen((open) => !open)}
        aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isMenuOpen}
      >
        {isMenuOpen ? '✕' : '☰'}
      </button>
      <nav className={isMenuOpen ? `${classes.nav} ${classes.navOpen}` : classes.nav}>
        <ul className={classes.list}>
          {links.map(({ to, label, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) => (isActive ? classes.active : undefined)}
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className={classes.walletArea}>
        <ConnectWalletButton />
        {import.meta.env.DEV && <DevMockConnect />}
      </div>
    </header>
  );
}

export default MainNavigation;
