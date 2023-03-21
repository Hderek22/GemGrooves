import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import HomePage from './pages/Home';
import Products from './pages/Products';
import ErrorPage from './pages/Error';
import RootLayout from './pages/Root';
import TheStudio from './pages/TheStudio';
import TheLounge from './pages/TheLounge';
import OurPurpose from './pages/OurPurpose';
import TheRecordShop from './pages/TheRecordShop';

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/products', element: <Products /> },
      { path: '/thestudio', element: <TheStudio /> },
      { path: '/thelounge', element: <TheLounge /> },
      { path: '/OurPurpose', element: <OurPurpose /> },
      { path: '/TheRecordShop', element: <TheRecordShop /> },
    ],
  }
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
