import { Box, Typography, Button, Stack, Paper, Fade } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useState } from 'react';
import { apiUrl } from '../config';
import { useInView } from '../hooks/useInView';
import { useMotionTimeout } from '../hooks/useReducedMotion';

export default function CtaSection() {
  const [copied, setCopied] = useState(false);
  const { ref, inView } = useInView<HTMLDivElement>();
  const timeout = useMotionTimeout(600);

  // Both the rendered snippet and the copied text derive from this, so they cannot drift.
  const restUrl = apiUrl('/api/v1');
  const graphqlUrl = apiUrl('/api/graphql');
  const exampleCurl = `curl -X POST ${restUrl} \\\n  -d 'prefer=mean'`;

  const handleCopy = () => {
    navigator.clipboard.writeText(exampleCurl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Box
      id="docs"
      ref={ref}
      sx={{
        py: { xs: 8, md: 12 },
        px: { xs: 2, md: 6 },
        bgcolor: 'background.default',
      }}
    >
      <Fade in={inView} timeout={timeout}>
      <Box sx={{ maxWidth: 900, mx: 'auto', textAlign: 'center' }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Start in Seconds
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 5, maxWidth: 560, mx: 'auto' }}>
          The API is completely free with no authentication. One request is all it takes.
        </Typography>

        <Paper
          sx={{
            bgcolor: 'code.bg',
            border: '1px solid', borderColor: 'divider',
            borderRadius: 2,
            p: 3,
            mb: 4,
            position: 'relative',
            textAlign: 'left',
          }}
        >
          <Box
            component="pre"
            sx={{
              m: 0,
              fontFamily: 'Monaco, Consolas, "Courier New", monospace',
              fontSize: '0.85rem',
              color: 'text.secondary',
              overflow: 'auto',
              '& .keyword': { color: 'code.keyword' },
              '& .string': { color: 'code.string' },
              '& .flag': { color: 'code.flag' },
            }}
          >
            <code>
              <span className="keyword">curl</span>{' '}
              <span className="flag">-X POST</span>{' '}
              <span className="string">{restUrl}</span>{' \\\n  '}
              <span className="flag">-d</span>{' '}
              <span className="string">'prefer=mean'</span>
            </code>
          </Box>
          <Button
            size="small"
            startIcon={<ContentCopyIcon fontSize="small" />}
            onClick={handleCopy}
            sx={{
              position: 'absolute',
              top: 12,
              right: 12,
              color: 'text.secondary',
              fontSize: '0.75rem',
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </Paper>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
          <Button
            variant="contained"
            size="large"
            href={restUrl}
            target="_blank"
            rel="noopener"
            sx={{ px: 5 }}
          >
            Try the API
          </Button>
          <Button
            variant="outlined"
            size="large"
            href={graphqlUrl}
            target="_blank"
            rel="noopener"
            sx={{ px: 5 }}
          >
            GraphQL Playground
          </Button>
        </Stack>
      </Box>
      </Fade>
    </Box>
  );
}
