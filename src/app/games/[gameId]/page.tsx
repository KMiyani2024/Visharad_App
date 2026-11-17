import { WordleGame } from '@/components/WordleGame';

export default async function GamePage({ params }: { params: Promise<{ gameId: string }> }) {
    const { gameId } = await params;
    return <WordleGame gameId={gameId} />;
}
