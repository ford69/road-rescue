import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import App from './App.tsx';
import {
  AdminLoginScreen,
  ForgotPasswordScreen,
  LoginScreen,
  RegisterScreen,
  ResetPasswordScreen,
  VerifyEmailScreen,
} from './screens/auth/auth-screens';
import { LandingPage } from './screens/landing';
import { OfflineScreen } from './screens/offline';
import { ThemeProvider } from './components/theme-provider';
import { ToastProvider } from './components/ui/toast';
import { AuthProvider } from './context/auth-context';
import { NetworkStatusBanner } from './components/pwa/network-status-banner';
import { InstallPrompt } from './components/pwa/install-prompt';
import { PwaUpdateBanner } from './components/pwa/update-banner';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <NetworkStatusBanner />
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth/login" element={<LoginScreen />} />
              <Route path="/auth/admin" element={<AdminLoginScreen />} />
              <Route path="/auth/register" element={<RegisterScreen />} />
              <Route path="/auth/forgot-password" element={<ForgotPasswordScreen />} />
              <Route path="/auth/reset-password" element={<ResetPasswordScreen />} />
              <Route path="/auth/verify-email" element={<VerifyEmailScreen />} />
              <Route path="/offline" element={<OfflineScreen />} />
              <Route path="/provider/earnings" element={<Navigate to="/mechanic/earnings" replace />} />
              <Route path="/:role/:screen" element={<App />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <InstallPrompt />
            <PwaUpdateBanner />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
