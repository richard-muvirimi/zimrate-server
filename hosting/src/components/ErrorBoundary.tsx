import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * A lazy chunk that failed to download. React.lazy caches the rejected promise
 * permanently, so clearing state and re-rendering just re-throws — these need a
 * full reload, not the normal "Try again".
 */
const CHUNK_ERROR = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    const isChunkError = CHUNK_ERROR.test(this.state.error?.message ?? '');

    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default',
          p: 4,
        }}
      >
        <Paper
          sx={{
            p: 4,
            maxWidth: 640,
            width: '100%',
            border: '1px solid',
            borderColor: 'error.dark',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <ErrorOutlineIcon color="error" sx={{ fontSize: 28 }} />
            <Typography variant="h6" fontWeight={700} color="error">
              {isChunkError ? "Couldn't load this page" : 'Something went wrong'}
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {isChunkError
              ? 'Part of the app failed to download. Check your connection and reload.'
              : this.state.error?.message ?? 'An unexpected error occurred.'}
          </Typography>

          {import.meta.env.DEV && this.state.errorInfo && (
            <Box
              component="pre"
              sx={{
                mt: 2,
                p: 2,
                bgcolor: 'code.bg',
                borderRadius: 1,
                fontSize: '0.72rem',
                overflow: 'auto',
                color: 'text.secondary',
                maxHeight: 300,
                whiteSpace: 'pre-wrap',
              }}
            >
              {this.state.error?.stack}
              {'\n\nComponent stack:'}
              {this.state.errorInfo.componentStack}
            </Box>
          )}

          <Button
            variant="outlined"
            sx={{ mt: 3 }}
            onClick={isChunkError ? () => window.location.reload() : this.handleReset}
          >
            {isChunkError ? 'Reload' : 'Try again'}
          </Button>
        </Paper>
      </Box>
    );
  }
}
