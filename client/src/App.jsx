import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { Toaster } from 'sonner';

// Components
import { Navbar } from './components/navbar';
import { Footer } from './components/footer';
import { CommandPalette } from './components/command-palette';

// Pages
import { LandingPage } from './pages/landing-page';

const FeedPage = React.lazy(() => import('./pages/feed-page').then((m) => ({ default: m.FeedPage })));
const IdeaDetailPage = React.lazy(() => import('./pages/idea-detail-page').then((m) => ({ default: m.IdeaDetailPage })));
const SubmitIdeaPage = React.lazy(() => import('./pages/submit-idea-page').then((m) => ({ default: m.SubmitIdeaPage })));
const EditIdeaPage = React.lazy(() => import('./pages/edit-idea-page').then((m) => ({ default: m.EditIdeaPage })));
const ReposPage = React.lazy(() => import('./pages/repos-page').then((m) => ({ default: m.ReposPage })));
const LeaderboardPage = React.lazy(() => import('./pages/leaderboard-page').then((m) => ({ default: m.LeaderboardPage })));
const ProfilePage = React.lazy(() => import('./pages/profile-page').then((m) => ({ default: m.ProfilePage })));
const LoginPage = React.lazy(() => import('./pages/login-page').then((m) => ({ default: m.LoginPage })));
const SignupPage = React.lazy(() => import('./pages/signup-page').then((m) => ({ default: m.SignupPage })));
const ForgotPasswordPage = React.lazy(() => import('./pages/forgot-password-page').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = React.lazy(() => import('./pages/reset-password-page').then((m) => ({ default: m.ResetPasswordPage })));
const AdminModerationPage = React.lazy(() => import('./pages/admin-moderation-page').then((m) => ({ default: m.AdminModerationPage })));
const AdminWaitlistPage = React.lazy(() => import('./pages/admin-waitlist-page').then((m) => ({ default: m.AdminWaitlistPage })));
const NotFoundPage = React.lazy(() => import('./pages/not-found-page').then((m) => ({ default: m.NotFoundPage })));

function RouteLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[40vh] w-full" aria-busy="true" aria-label="Loading content">
      <div className="w-6 h-6 border-2 border-border-strong border-t-accent-strong rounded-full animate-spin" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme}
      richColors
      closeButton
      position="bottom-center"
      toastOptions={{
        className: 'rounded-[8px] border border-border-strong bg-surface-raised text-ink',
      }}
    />
  );
}

function GlobalShortcuts({ onOpenCommandPalette }) {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenCommandPalette();
      } else if (!isInput && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        navigate('/submit');
      } else if (!isInput && e.key === '/') {
        e.preventDefault();
        onOpenCommandPalette();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, onOpenCommandPalette]);

  return null;
}

export function App() {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <div className="flex flex-col min-h-screen bg-bg text-ink">
              <GlobalShortcuts onOpenCommandPalette={() => setCommandPaletteOpen(true)} />
              <Navbar onOpenCommandPalette={() => setCommandPaletteOpen(true)} />
              <div className="flex-1">
                <React.Suspense fallback={<RouteLoadingFallback />}>
                  <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/feed" element={<FeedPage />} />
                    <Route path="/ideas/:id" element={<IdeaDetailPage />} />
                    <Route path="/ideas/:id/edit" element={<EditIdeaPage />} />
                    <Route path="/submit" element={<SubmitIdeaPage />} />
                    <Route path="/repos" element={<ReposPage />} />
                    <Route path="/leaderboard" element={<LeaderboardPage />} />
                    <Route path="/profile/:id" element={<ProfilePage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/admin" element={<AdminModerationPage />} />
                    <Route path="/admin/waitlist" element={<AdminWaitlistPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </React.Suspense>
              </div>
              <Footer />
            </div>
            <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
            <ThemedToaster />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
