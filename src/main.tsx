import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import App from './App.tsx';
import {
  ForgotPasswordScreen,
  LoginScreen,
  RegisterScreen,
  ResetPasswordScreen,
  VerifyEmailScreen,
} from './screens/auth/auth-screens';
import { ThemeProvider } from './components/theme-provider';
import { ToastProvider } from './components/ui/toast';
import { AuthProvider } from './context/auth-context';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <Routes>
              <Route path="/auth/login" element={<LoginScreen />} />
              <Route path="/auth/register" element={<RegisterScreen />} />
              <Route path="/auth/forgot-password" element={<ForgotPasswordScreen />} />
              <Route path="/auth/reset-password" element={<ResetPasswordScreen />} />
              <Route path="/auth/verify-email" element={<VerifyEmailScreen />} />
              <Route path="/:role/:screen" element={<App />} />
              <Route path="*" element={<Navigate to="/auth/login" replace />} />
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
