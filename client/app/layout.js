import './globals.css';
import Providers from '../components/Providers';
import Navbar from '../components/Navbar';
import ViewportHeight from '../components/ViewportHeight';

export const metadata = {
  title: 'CardMatch - หาคู่เล่นการ์ดเกม',
  description: 'จับคู่ผู้เล่นการ์ดเกมและเล่นผ่านวิดีโอสด',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,   // prevent double-tap zoom on mobile
  userScalable: false,
  viewportFit: 'cover', // allow content into notch area (with safe-area insets)
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" data-scroll-behavior="smooth">
      <body>
        <Providers>
          <ViewportHeight />
          <Navbar />
          <main className="pt-16 w-full overflow-x-hidden" style={{ minHeight: 'calc(var(--vh, 1vh) * 100)' }}>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
