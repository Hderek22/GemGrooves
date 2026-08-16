import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';

import MainNavigation from '../components/MainNavigation';
import buttons from '../styles/buttons.module.css';
import layout from '../styles/layout.module.css';

function ErrorPage() {
  const error = useRouteError();
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <>
      <MainNavigation />
      <main className={layout.fill}>
        <div className={layout.centered}>
          <h1>{isNotFound ? 'Page not found' : 'An error occurred'}</h1>
          <p>
            {isNotFound
              ? "The page you're looking for doesn't exist."
              : 'Something went wrong loading this page.'}
          </p>
          <Link to="/" className={buttons.pill}>
            Back to GemGrooves
          </Link>
        </div>
      </main>
    </>
  );
}

export default ErrorPage;
