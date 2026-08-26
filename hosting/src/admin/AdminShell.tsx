import AuthGuard from './AuthGuard';
import AdminLayout from './AdminLayout';

/**
 * Single lazy entry point for the whole admin area. Keeping AuthGuard and
 * AdminLayout behind this one module is what keeps the Firebase SDK out of the
 * entry chunk — they sit in the `element` prop of the /admin route, so a static
 * import of either would pull firebase/auth onto the landing page.
 */
export default function AdminShell() {
  return (
    <AuthGuard>
      <AdminLayout />
    </AuthGuard>
  );
}
