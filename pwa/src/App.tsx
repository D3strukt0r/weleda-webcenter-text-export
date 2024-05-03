import { lazy, Suspense } from 'react';
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom';
import { RootErrorBoundary } from './layout/RootErrorBoundary';
import BigSpinner from './layout/BigSpinner';
import ErrorBoundary from './layout/ErrorBoundary';
import NotFound from './layout/NotFound';

const Homepage = lazy(() => import('./pages/Homepage'));

const router = createBrowserRouter([
  {
    path: '/',
    element: <Outlet />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: <Homepage />,
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
]);

function App() {
  if (import.meta.hot) {
    import.meta.hot.dispose(() => router.dispose());
  }

  return (
    <RootErrorBoundary>
      <Suspense fallback={<BigSpinner />}>
        <RouterProvider
          router={router}
          fallbackElement={<BigSpinner />}
        />
      </Suspense>
    </RootErrorBoundary>
  );
}

export default App;
