import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { PreviewProvider, usePreview } from '../features/preview';

function Routes() {
  const session = usePreview();
  const path = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (!session.signedIn && path !== '/welcome') router.replace('/welcome');
  }, [session.signedIn, path, router]);
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return <PreviewProvider><Routes /></PreviewProvider>;
}
