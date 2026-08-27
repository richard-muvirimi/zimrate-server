import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ErrorBoundary from './components/ErrorBoundary';
import RouteFallback from './components/RouteFallback';
import ScrollToHash from './components/ScrollToHash';
import { useBranding } from './useBranding';
import { trackPageView } from './analytics';

// HomePage stays eager: it is the entry route, and keeping it (with SiteLayout,
// Header and Footer) in the entry chunk avoids a second waterfall before first
// paint. Everything else is split.
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const FaqPage = lazy(() => import('./pages/FaqPage'));
const DevelopersPage = lazy(() => import('./pages/DevelopersPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const LoginPage = lazy(() => import('./admin/pages/LoginPage'));
const ForgotPasswordPage = lazy(() => import('./admin/pages/ForgotPasswordPage'));
const VerifyEmailPage = lazy(() => import('./admin/pages/VerifyEmailPage'));

const AdminShell = lazy(() => import('./admin/AdminShell'));
const DashboardPage = lazy(() => import('./admin/pages/DashboardPage'));
const RatesPage = lazy(() => import('./admin/pages/RatesPage'));
const RateFormPage = lazy(() => import('./admin/pages/RateFormPage'));
const SourcesPage = lazy(() => import('./admin/pages/SourcesPage'));
const SourceFormPage = lazy(() => import('./admin/pages/SourceFormPage'));
const UsersPage = lazy(() => import('./admin/pages/UsersPage'));
const OptionsPage = lazy(() => import('./admin/pages/OptionsPage'));
const ImportExportPage = lazy(() => import('./admin/pages/ImportExportPage'));
const SmtpPage = lazy(() => import('./admin/pages/SmtpPage'));
const BrandingPage = lazy(() => import('./admin/pages/BrandingPage'));
const AdminNotFoundPage = lazy(() => import('./admin/pages/AdminNotFoundPage'));

const routeTitles: Array<[RegExp, string]> = [
  [/^\/$/, 'ZimRate'],
  [/^\/privacy$/, 'Privacy | ZimRate'],
  [/^\/faq$/, 'FAQ | ZimRate'],
  [/^\/contact$/, 'Contact | ZimRate'],
  [/^\/developers$/, 'Developers | ZimRate'],
  [/^\/admin\/login$/, 'Admin Login | ZimRate'],
  [/^\/admin\/forgot-password$/, 'Reset Password | ZimRate'],
  [/^\/admin\/verify-email$/, 'Verify Email | ZimRate'],
  [/^\/admin\/rates\/new$/, 'New Rate | ZimRate'],
  [/^\/admin\/rates\/[^/]+$/, 'Edit Rate | ZimRate'],
  [/^\/admin\/rates$/, 'Rates | ZimRate'],
  [/^\/admin\/sources\/new$/, 'New Source | ZimRate'],
  [/^\/admin\/sources\/[^/]+$/, 'Edit Source | ZimRate'],
  [/^\/admin\/sources$/, 'Sources | ZimRate'],
  [/^\/admin\/users$/, 'Users | ZimRate'],
  [/^\/admin\/options$/, 'Options | ZimRate'],
  [/^\/admin\/smtp$/, 'Email / SMTP | ZimRate'],
  [/^\/admin\/branding$/, 'Branding | ZimRate'],
  [/^\/admin\/import-export$/, 'Import / Export | ZimRate'],
  [/^\/admin$/, 'Admin Dashboard | ZimRate'],
  // First match wins, so this only fires when nothing above matched.
  [/.*/, 'Page Not Found | ZimRate'],
];

function PageTitleManager() {
  const location = useLocation();
  const branding = useBranding();

  useEffect(() => {
    const match = routeTitles.find(([pattern]) => pattern.test(location.pathname));
    const title = match?.[1] ?? 'ZimRate';
    // Titles are authored against the placeholder name; substitute only once
    // the real one has arrived, so a blank never reaches the tab.
    document.title = branding.app_name ? title.replace(/ZimRate/g, branding.app_name) : title;
  }, [location.pathname, branding.app_name]);

  // Declared after the title effect so it runs second in the same commit and
  // reports the resolved title. Keyed on the path alone: including the query
  // string would fire a hit on every admin filter change, and including
  // branding would double-count the first route when it arrives.
  useEffect(() => {
    trackPageView(document.title);
  }, [location.pathname]);

  useEffect(() => {
    if (!branding.icon_url) return;
    // Runtime favicon swap: the bundled default shows until this lands, which
    // is unavoidable without server-side rendering.
    document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]').forEach((link) => {
      link.href = branding.icon_url;
    });
  }, [branding.icon_url]);

  return null;
}

function App() {
  return (
    <>
      <PageTitleManager />
      <ScrollToHash />
      {/* Scoped boundary so a failed route chunk doesn't take down navigation. */}
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public landing page */}
            <Route path="/" element={<HomePage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/developers" element={<DevelopersPage />} />

            {/* Admin auth */}
            <Route path="/admin/login" element={<LoginPage />} />
            <Route path="/admin/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/admin/verify-email" element={<VerifyEmailPage />} />

            {/* Protected admin routes */}
            <Route path="/admin" element={<AdminShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="rates" element={<RatesPage />} />
              <Route path="rates/new" element={<RateFormPage />} />
              <Route path="rates/:id" element={<RateFormPage />} />
              <Route path="sources" element={<SourcesPage />} />
              <Route path="sources/new" element={<SourceFormPage />} />
              <Route path="sources/:id" element={<SourceFormPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="options" element={<OptionsPage />} />
              <Route path="smtp" element={<SmtpPage />} />
              <Route path="branding" element={<BrandingPage />} />
              <Route path="import-export" element={<ImportExportPage />} />
              {/* Keeps /admin/typo inside the admin chrome instead of falling
                  through to the public 404 mid-session. */}
              <Route path="*" element={<AdminNotFoundPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  );
}

export default App;
