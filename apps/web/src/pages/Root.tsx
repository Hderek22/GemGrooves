import { Outlet } from 'react-router-dom';

import MainNavigation from '../components/MainNavigation';
import layout from '../styles/layout.module.css';

function RootLayout() {
  return (
    <>
      <MainNavigation />
      <main className={layout.fill}>
        <Outlet />
      </main>
    </>
  );
}

export default RootLayout;
