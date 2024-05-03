import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

function ErrorBoundary() {
  const error = useRouteError();

  if (error !== undefined) {
    // eslint-disable-next-line no-console
    console.error(error);
  }

  return (
    <div className="h-full flex items-center justify-center flex-col text-center">
      <h1>Oops!</h1>
      {isRouteErrorResponse(error) ? (
        <>
          <h2>{error?.status}</h2>
          <p>Sorry, an unexpected error has occurred.</p>
          <p>{error?.statusText}</p>
          {error?.data?.message && <p>{error?.data.message}</p>}
        </>
      ) : (
        <p>Sorry, an unexpected error has occurred.</p>
      )}
      <button
        onClick={() => {
          window.location.href = '/';
        }}
      >
        Click here to reload the app
      </button>
    </div>
  );
}

export default ErrorBoundary;
