import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Grid, Paper, Typography, CircularProgress, Chip, Stack, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Alert, Divider, Tooltip,
} from '@mui/material';
import {
  collection, getCountFromServer, query, orderBy, limit, getDocs, where,
} from 'firebase/firestore';
import { db } from '../../firebase';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import SourceIcon from '@mui/icons-material/Source';
import PublicIcon from '@mui/icons-material/Public';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import UpdateIcon from '@mui/icons-material/Update';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import ImportExportIcon from '@mui/icons-material/ImportExport';
import MailIcon from '@mui/icons-material/Mail';
import PeopleIcon from '@mui/icons-material/People';

interface RateRow {
  id: string;
  rate_name?: string;
  rate_currency?: string;
  rate?: number;
  status?: boolean;
  enabled?: boolean;
  status_message?: string;
  updated_at?: { toDate?: () => Date };
}

interface Stat {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  to?: string;
  tone?: 'default' | 'warning';
}

function toDate(value?: { toDate?: () => Date }) {
  return value?.toDate ? value.toDate() : null;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<Stat[]>([]);
  const [recent, setRecent] = useState<RateRow[]>([]);
  const [failing, setFailing] = useState<RateRow[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [scrapingEnabled, setScrapingEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [ratesCount, sourcesCount, recentSnap, optionsSnap] = await Promise.all([
          getCountFromServer(collection(db, 'rates')),
          getCountFromServer(collection(db, 'sources')),
          getDocs(query(collection(db, 'rates'), orderBy('updated_at', 'desc'), limit(8))),
          getDocs(collection(db, 'options')),
        ]);

        const recentRows = recentSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as RateRow);
        setRecent(recentRows);
        setLastUpdated(toDate(recentRows[0]?.updated_at));

        const scraping = optionsSnap.docs
          .map((d) => d.data())
          .find((o) => o.key === 'scraping_enabled');
        setScrapingEnabled(scraping ? scraping.value !== 'false' : true);

        // Rates the scraper could not read on its last pass.
        let failingRows: RateRow[] = [];
        try {
          const failingSnap = await getDocs(
            query(collection(db, 'rates'), where('status', '==', false), limit(5)),
          );
          failingRows = failingSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as RateRow);
        } catch {
          // Composite index may not exist for this filter — not fatal.
        }
        setFailing(failingRows);

        const currencies = new Set(
          recentSnap.docs.map((d) => d.data().rate_currency).filter(Boolean),
        );

        setStats([
          {
            label: 'Rates tracked',
            value: ratesCount.data().count,
            icon: <CurrencyExchangeIcon sx={{ color: 'primary.main', fontSize: 30 }} />,
            to: '/admin/rates',
          },
          {
            label: 'Sources',
            value: sourcesCount.data().count,
            icon: <SourceIcon sx={{ color: 'primary.main', fontSize: 30 }} />,
            to: '/admin/sources',
          },
          {
            label: 'Currencies (recent)',
            value: currencies.size,
            icon: <PublicIcon sx={{ color: 'primary.main', fontSize: 30 }} />,
          },
          {
            label: 'Failing rates',
            value: failingRows.length,
            icon: (
              <WarningAmberIcon
                sx={{ color: failingRows.length ? 'warning.main' : 'success.main', fontSize: 30 }}
              />
            ),
            tone: failingRows.length ? 'warning' : 'default',
            to: '/admin/rates',
          },
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Typography variant="h5" fontWeight={700}>Overview</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {scrapingEnabled !== null && (
            <Chip
              label={scrapingEnabled ? 'Scraping on' : 'Scraping paused'}
              color={scrapingEnabled ? 'success' : 'warning'}
              size="small"
              variant="outlined"
            />
          )}
          {lastUpdated && (
            <Tooltip title={lastUpdated.toLocaleString()}>
              <Chip
                icon={<UpdateIcon />}
                label={`Updated ${lastUpdated.toLocaleDateString()}`}
                size="small"
                variant="outlined"
              />
            </Tooltip>
          )}
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {stats.map(({ label, value, icon, to, tone }) => (
          <Grid key={label} size={{ xs: 6, md: 3 }}>
            <Paper
              {...(to ? { component: RouterLink, to } : {})}
              sx={{
                p: 2.5,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                height: '100%',
                textDecoration: 'none',
                border: '1px solid',
                borderColor: tone === 'warning' ? 'warning.main' : 'divider',
                transition: 'border-color 0.2s, transform 0.2s',
                ...(to && { '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' } }),
              }}
            >
              {icon}
              <Box>
                <Typography variant="h5" fontWeight={700}>{value}</Typography>
                <Typography variant="body2" color="text.secondary">{label}</Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 1.5 }}>
        QUICK ACTIONS
      </Typography>
      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mb: 4 }}>
        <Button component={RouterLink} to="/admin/sources/new" variant="contained" startIcon={<AddIcon />}>
          Add source
        </Button>
        <Button component={RouterLink} to="/admin/rates" variant="outlined" startIcon={<CurrencyExchangeIcon />}>
          Manage rates
        </Button>
        <Button component={RouterLink} to="/admin/users" variant="outlined" startIcon={<PeopleIcon />}>
          Users
        </Button>
        <Button component={RouterLink} to="/admin/smtp" variant="outlined" startIcon={<MailIcon />}>
          Email / SMTP
        </Button>
        <Button component={RouterLink} to="/admin/options" variant="outlined" startIcon={<SettingsIcon />}>
          Options
        </Button>
        <Button component={RouterLink} to="/admin/import-export" variant="outlined" startIcon={<ImportExportIcon />}>
          Import / Export
        </Button>
      </Stack>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: failing.length ? 7 : 12 }}>
          <Paper sx={{ border: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>Recently updated rates</Typography>
              <Button component={RouterLink} to="/admin/rates" size="small">View all</Button>
            </Stack>
            <Divider />
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Currency</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell align="right">Rate</TableCell>
                    <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                      Updated
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recent.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>{r.rate_currency ?? '—'}</Typography>
                      </TableCell>
                      <TableCell
                        sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        <Typography variant="body2" color="text.secondary">{r.rate_name ?? '—'}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={600}>
                          {typeof r.rate === 'number' ? r.rate.toLocaleString() : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                        <Typography variant="caption" color="text.secondary">
                          {toDate(r.updated_at)?.toLocaleDateString() ?? '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  {recent.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography color="text.secondary" py={3}>No rates yet</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {failing.length > 0 && (
          <Grid size={{ xs: 12, lg: 5 }}>
            <Paper sx={{ border: '1px solid', borderColor: 'warning.main', height: '100%' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 2 }}>
                <WarningAmberIcon color="warning" />
                <Typography variant="subtitle1" fontWeight={700}>Needs attention</Typography>
              </Stack>
              <Divider />
              <Box sx={{ p: 2 }}>
                <Stack spacing={2}>
                  {failing.map((r) => (
                    <Box key={r.id}>
                      <Typography variant="body2" fontWeight={600}>
                        {r.rate_currency ?? '—'} · {r.rate_name ?? 'Unnamed'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {r.status_message || 'Last scrape did not return a usable rate.'}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
                <Button component={RouterLink} to="/admin/rates" size="small" sx={{ mt: 2 }}>
                  Review rates
                </Button>
              </Box>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
