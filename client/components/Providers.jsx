'use client';
import { AuthProvider } from '../context/AuthContext';
import { SocketProvider } from '../context/SocketContext';

// Note: GoogleOAuthProvider has been moved into GoogleLoginButton directly
// to avoid calling google.accounts.id.initialize() twice
export default function Providers({ children }) {
  return (
    <AuthProvider>
      <SocketProvider>
        {children}
      </SocketProvider>
    </AuthProvider>
  );
}
