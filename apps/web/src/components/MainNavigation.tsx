import { NavLink } from 'react-router-dom';

import ConnectWalletButton from './ConnectWalletButton';
import classes from './MainNavigation.module.css';

const links = [
  { to: '/', label: 'GemGrooves', end: true },
  { to: '/OurPurpose', label: 'Our Purpose' },
  { to: '/TheLounge', label: 'The Lounge' },
  { to: '/TheStudio', label: 'The Studio' },
  { to: '/TheRecordShop', label: 'The Record Shop' },
];

function MainNavigation() {
  return (
    <header className={classes.header}>
      <nav className={classes.nav}>
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
      <ConnectWalletButton />
    </header>
  );
}

export default MainNavigation;
