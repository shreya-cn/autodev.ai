'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';

export default function ConditionalHeader() {
  const pathname = usePathname();
  
  // Don't show header on login or signout pages
  if (pathname === '/login' || pathname === '/signout') {
    return null;
  }
  
  return <Header />;
}
