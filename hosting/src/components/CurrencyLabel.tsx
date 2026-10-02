import { Box, Stack, Typography } from '@mui/material';
import { currencyName, flagUrl } from '../../calculator/currency';

/**
 * A currency as flag, code and currency name — the code stays the prominent part,
 * the name is there for anyone who does not recognise the code.
 *
 * `inline` keeps everything on one line, for places with no room for a second
 * one such as a select's chosen value.
 */
export default function CurrencyLabel({ currency, inline }: { currency: string; inline?: boolean }) {
  const code = currency.toUpperCase();
  const name = currencyName(currency);
  // currencyName falls back to the code; showing it twice says nothing.
  const showName = name.toUpperCase() !== code;

  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
      <Box
        component="img"
        src={flagUrl(currency) ?? undefined}
        alt=""
        width={inline ? 20 : 28}
        height={inline ? 15 : 21}
        sx={{ borderRadius: 0.5, flexShrink: 0, objectFit: 'cover' }}
        // A currency with no flag keeps its slot so the codes stay aligned.
        onError={(event) => {
          event.currentTarget.style.visibility = 'hidden';
        }}
      />
      <Box
        sx={{
          minWidth: 0,
          display: 'flex',
          flexDirection: inline ? 'row' : 'column',
          alignItems: inline ? 'baseline' : 'flex-start',
          gap: inline ? 0.75 : 0,
        }}
      >
        <Typography fontWeight={700} variant={inline ? 'body2' : 'body1'} lineHeight={1.2}>
          {code}
        </Typography>
        {showName && (
          <Typography variant="caption" color="text.secondary" noWrap lineHeight={1.2} sx={{ maxWidth: '100%' }}>
            {name}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}
