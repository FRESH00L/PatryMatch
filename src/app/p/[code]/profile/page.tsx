import { notFound, redirect } from 'next/navigation';
import { getParty } from '@/lib/party-server';
import ProfileScreen from '@/components/ProfileScreen';

export const dynamic = 'force-dynamic';

export default async function ProfilePage({ params }: { params: { code: string } }) {
  const { party, expired } = await getParty(params.code);
  if (!party) notFound();
  if (expired) redirect(`/p/${party.code}`);

  return <ProfileScreen party={party} />;
}
