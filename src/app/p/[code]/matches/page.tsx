import { notFound, redirect } from 'next/navigation';
import { getParty } from '@/lib/party-server';
import MatchesScreen from '@/components/MatchesScreen';

export const dynamic = 'force-dynamic';

export default async function MatchesPage({ params }: { params: { code: string } }) {
  const { party, expired } = await getParty(params.code);
  if (!party) notFound();
  if (expired) redirect(`/p/${party.code}`);

  return <MatchesScreen party={party} />;
}
