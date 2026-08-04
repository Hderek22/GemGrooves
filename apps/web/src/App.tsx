import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import ErrorPage from './pages/Error';
import Home from './pages/Home';
import OurPurpose from './pages/OurPurpose';
import RootLayout from './pages/Root';
import TheLounge from './pages/TheLounge';
import TheRecordShop from './pages/TheRecordShop';
import TheStudio from './pages/TheStudio';

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/OurPurpose', element: <OurPurpose /> },
      { path: '/TheLounge', element: <TheLounge /> },
      { path: '/TheStudio', element: <TheStudio /> },
      { path: '/TheRecordShop', element: <TheRecordShop /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}

export default App;
