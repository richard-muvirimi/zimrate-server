import { useState } from 'react';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

export default function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Paper
      sx={{
        position: 'relative',
        bgcolor: 'code.bg',
        border: '1px solid', borderColor: 'divider',
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderBottomColor: 'divider' }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
          {language}
        </Typography>
        <Button size="small" color="inherit" startIcon={<ContentCopyIcon />} onClick={handleCopy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </Stack>
      <Box component="pre" sx={{ m: 0, p: 2.5, overflowX: 'auto', fontSize: '0.9rem' }}>
        <Box component="code" sx={{ fontFamily: 'Monaco, Consolas, "Courier New", monospace', color: 'code.text' }}>
          {code}
        </Box>
      </Box>
    </Paper>
  );
}
