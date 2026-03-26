import React from 'react';
import { pinkChatApi } from '../../services/pinkChatService';
import { PinkChatRoom } from '../../types/pinkChat';
import { PinkChatPanel } from './PinkChatPanel';
import { usePinkChatAuth } from '../../contexts/PinkChatAuthContext';

export const PublicChatPanel: React.FC = () => {
  const { user, token } = usePinkChatAuth();
  const [rooms, setRooms] = React.useState<PinkChatRoom[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const allRooms = await pinkChatApi.getRooms(token || undefined);
      if (!cancelled) setRooms(allRooms.filter((r) => r.visibility === 'public'));
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <PinkChatPanel
      title="Public Chat"
      subtitle="Öffentlich sichtbar"
      rooms={rooms}
      token={token}
      userId={user?.id}
      displayName={user?.displayName}
      canPost={!!user}
      emptyHint="Noch keine Nachrichten im Public Space."
    />
  );
};

