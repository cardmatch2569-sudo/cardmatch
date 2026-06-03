import './globals.css';
import Providers from '../components/Providers';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ViewportHeight from '../components/ViewportHeight';

export const metadata = {
  title: 'CardMatch - หาเพื่อนเล่นการ์ดเกมส์',
  description: 'หาเพื่อนเล่นการ์ดเกมส์และเล่นผ่านวิดีโอสด',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icon-192.svg',
  },
  appleWebApp: {
    capable: true,
    title: 'CardMatch',
    statusBarStyle: 'black-translucent',
  },
  other: {
    // Android
    'mobile-web-app-capable': 'yes',
    // iOS
    'apple-touch-fullscreen': 'yes',
    'format-detection': 'telephone=no',
    // Windows (Edge / IE pinned sites)
    'msapplication-TileColor': '#7c3aed',
    'msapplication-tap-highlight': 'no',
    // Universal
    'application-name': 'CardMatch',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)',  color: '#07070f' },
    { media: '(prefers-color-scheme: light)', color: '#7c3aed' },
  ],
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
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
