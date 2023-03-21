import { NavLink } from 'react-router-dom';

import classes from './MainNavigation.module.css';

function MainNavigation() {
  return (
    <header className={classes.header}>
      <nav>
        <ul className={classes.list}>
          <li>
            <NavLink
              to="/"
              className={({ isActive }) => (isActive ? classes.active : undefined)}
              style={({ isActive }) => ({ textAlign: isActive ? 'center' : 'left' })}
              end
            >
              GemGrooves
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/OurPurpose"
              className={({ isActive }) => (isActive ? classes.active : undefined)}
            >
              Our Purpose
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/TheLounge"
              className={({ isActive }) => (isActive ? classes.active : undefined)}
            >
              The Lounge
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/TheStudio"
              className={({ isActive }) => (isActive ? classes.active : undefined)}
            >
              The Studio
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/TheRecordShop"
              className={({ isActive }) => (isActive ? classes.active : undefined)}
            >
              The Record Shop
            </NavLink>
          </li>
        </ul>
      </nav>
    </header>
  );
}

export default MainNavigation;
