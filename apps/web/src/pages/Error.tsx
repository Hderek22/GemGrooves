import MainNavigation from '../components/MainNavigation';
import layout from '../styles/layout.module.css';

function ErrorPage() {
  return (
    <>
      <MainNavigation />
      <main className={layout.fill}>
        <div className={layout.centered}>
          <h1>An error occurred!</h1>
          <p>Could not find this page.</p>
        </div>
      </main>
    </>
  );
}

export default ErrorPage;
