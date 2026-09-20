import { notFound, redirect } from 'next/navigation';
import { getParty } from '@/lib/party-server';
import DeckScreen from '@/components/DeckScreen';

export const dynamic = 'force-dynamic';

export default async function DeckPage({ params }: { params: { code: string } }) {
  const { party, expired } = await getParty(params.code);
  if (!party) notFound();
  if (expired) redirect(`/p/${party.code}`);

  return <DeckScreen party={party} />;
}
