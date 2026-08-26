import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline } from '@mui/material';
import { ApolloProvider } from '@apollo/client/react';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import ThemedRoot from './ThemedRoot';
import apolloClient from './apollo';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

const RELOAD_FLAG = 'zimrate-chunk-reload';

/**
 * A lazy chunk failing to preload is usually a deploy landing while the tab was
 * open — the hashed filenames in this document no longer exist. One reload
 * fetches a fresh index.html and fixes it. If we already tried that, it's a real
 * network failure, so let it reach the ErrorBoundary instead of looping.
 */
window.addEventListener('vite:preloadError', (event) => {
  if (sessionStorage.getItem(RELOAD_FLAG)) return;
  event.preventDefault();
  sessionStorage.setItem(RELOAD_FLAG, '1');
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Theme outermost: the ErrorBoundary's own UI reads palette tokens, and
        useColorScheme has to be able to run anywhere in the tree. */}
    <ThemedRoot>
      <CssBaseline />
      <ErrorBoundary>
        <ApolloProvider client={apolloClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ApolloProvider>
      </ErrorBoundary>
    </ThemedRoot>
  </StrictMode>,
);

// Reaching here means the entry chunk ran, so any earlier reload worked.
sessionStorage.removeItem(RELOAD_FLAG);
