import { redirect } from 'next/navigation';

// Registration is handled on the login page (tab switching)
export default function RegisterPage() {
  redirect('/login');
}
