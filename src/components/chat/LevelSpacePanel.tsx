import React from 'react';
import { usePinkChatAuth } from '../../contexts/PinkChatAuthContext';
import { pinkChatApi } from '../../services/pinkChatService';
import { PinkChatRoom } from '../../types/pinkChat';
import { AdminRoomManager } from './AdminRoomManager';
import { AuthGateCard } from './AuthGateCard';
import { PinkChatPanel } from './PinkChatPanel';

const canAccessRoom = (room: PinkChatRoom, level: string, role: string) => {
  if (role === 'admin') return true;
  if (room.visibility === 'public') return true;
  if (room.visibility === 'level1') return level === 'level1' || level === 'level2';
  if (room.visibility === 'level2') return level === 'level2';
  return false;
};

export const LevelSpacePanel: React.FC = () => {
  const { user, token } = usePinkChatAuth();
  const [rooms, setRooms] = React.useState<PinkChatRoom[]>([]);

  const loadRooms = React.useCallback(async () => {
    const allRooms = await pinkChatApi.getRooms(token || undefined);
    if (!user) {
      setRooms([]);
      return;
    }
    const allowed = allRooms.filter((r) => r.visibility !== 'public').filter((r) => canAccessRoom(r, user.level, user.role));
    setRooms(allowed);
  }, [token, user]);

  React.useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  return (
    <div className="space-y-3">
      <AuthGateCard />
      {user ? (
        <>
          {user.role === 'admin' && token && <AdminRoomManager token={token} onRoomCreated={() => void loadRooms()} />}
          <PinkChatPanel
            title="Level Space"
            subtitle="Nur sichtbar nach Login (L1/L2). Admins können Räume verwalten."
            rooms={rooms}
            token={token}
            userId={user.id}
            displayName={user.displayName}
            canPost={true}
            emptyHint="Keine freigegebenen Räume für deinen Level."
          />
        </>
      ) : (
        <div className="rounded-xl border border-pink-300/40 bg-black/35 p-3 text-xs text-pink-100/80">
          Logge dich ein, um den geschützten Level-Space zu sehen.
        </div>
      )}
    </div>
  );
};

