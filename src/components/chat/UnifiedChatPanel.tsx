import React from 'react';
import { usePinkChatAuth } from '../../contexts/PinkChatAuthContext';
import { pinkChatApi } from '../../services/pinkChatService';
import { PinkChatMessage, PinkChatRoom } from '../../types/pinkChat';

const GUEST_NAME_KEY = 'pinkchat_guest_name';

const canAccessRoom = (room: PinkChatRoom, level: string, role: string) => {
  if (role === 'admin') return true;
  if (room.visibility === 'open') return true;
  if (room.visibility === 'public') return true;
  if (room.visibility === 'level1') return level === 'level1' || level === 'level2';
  if (room.visibility === 'level2') return level === 'level2';
  return false;
};

const VISIBILITY_LABEL: Record<string, string> = {
  open: '',
  public: '',
  level1: 'L1',
  level2: 'L2',
  admin: 'Admin',
};

export const UnifiedChatPanel: React.FC = () => {
  const { user, token } = usePinkChatAuth();
  const [allRooms, setAllRooms] = React.useState<PinkChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = React.useState('');
  const [messages, setMessages] = React.useState<PinkChatMessage[]>([]);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState('');
  const [guestName, setGuestName] = React.useState(() => localStorage.getItem(GUEST_NAME_KEY) || '');
  const [guestNameConfirmed, setGuestNameConfirmed] = React.useState(() => !!localStorage.getItem(GUEST_NAME_KEY));

  const loadRooms = React.useCallback(async () => {
    const rooms = await pinkChatApi.getRooms(token || undefined);
    setAllRooms(rooms.filter((r) => !r.archived));
  }, [token]);

  React.useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  const visibleRooms = React.useMemo(() => {
    if (!user) return allRooms.filter((r) => r.visibility === 'open' || r.visibility === 'public');
    return allRooms.filter((r) => canAccessRoom(r, user.level, user.role));
  }, [allRooms, user]);

  React.useEffect(() => {
    if (!visibleRooms.length) { setActiveRoomId(''); return; }
    if (!activeRoomId || !visibleRooms.some((r) => r.id === activeRoomId)) {
      const openRoom = visibleRooms.find((r) => r.visibility === 'open');
      setActiveRoomId(openRoom ? openRoom.id : visibleRooms[0].id);
    }
  }, [visibleRooms, activeRoomId]);

  const activeRoom = visibleRooms.find((r) => r.id === activeRoomId);
  const isOpenRoom = activeRoom?.visibility === 'open' || activeRoom?.visibility === 'public';
  const canPost = !!activeRoom && (!!user || (isOpenRoom && guestNameConfirmed && guestName.trim().length > 0));

  const load = React.useCallback(async () => {
    if (!activeRoomId) return;
    try {
      const next = await pinkChatApi.getMessages(activeRoomId, token || undefined);
      setMessages(next);
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Failed to load chat.');
    }
  }, [activeRoomId, token]);

  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => {
    if (!activeRoomId) return;
    const id = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(id);
  }, [activeRoomId, load]);

  const confirmGuestName = () => {
    const name = guestName.trim();
    if (name.length < 1) return;
    localStorage.setItem(GUEST_NAME_KEY, name);
    setGuestNameConfirmed(true);
  };

  const send = async () => {
    if (!canPost || !activeRoomId || !draft.trim()) return;

    const senderName = user ? user.displayName : guestName.trim();
    const senderId = user ? user.id : `guest-${guestName.trim().toLowerCase().replace(/\s+/g, '-')}`;
    const senderToken = token || null;

    try {
      setSending(true);
      const posted = await pinkChatApi.postMessage(activeRoomId, draft, senderToken, senderName, senderId);
      setMessages((prev) => [...prev, posted].slice(-200));
      setDraft('');
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const msgEndRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const showGuestPrompt = !user && isOpenRoom && !guestNameConfirmed;

  return (
    <section className="rounded-2xl border border-pink-300/70 bg-black/45 p-3 flex flex-col">
      <div className="mb-1.5">
        <h3 className="text-xs font-bold text-pink-100">PinkPuppets Chat</h3>
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {visibleRooms.map((room) => {
          const badge = VISIBILITY_LABEL[room.visibility] || '';
          return (
            <button
              key={room.id}
              onClick={() => setActiveRoomId(room.id)}
              className={`rounded border px-2 py-1 text-[11px] flex items-center gap-1 ${
                activeRoomId === room.id
                  ? 'border-pink-300 bg-pink-500/20 text-pink-100'
                  : 'border-pink-300/40 bg-black/20 text-pink-200/80 hover:bg-pink-500/10'
              }`}
            >
              #{room.name}
              {badge && <span className="rounded bg-pink-500/30 px-1 py-px text-[9px] text-pink-200">{badge}</span>}
            </button>
          );
        })}
      </div>

      <div className="h-52 overflow-y-auto rounded border border-pink-300/30 bg-black/35 p-2">
        {messages.length === 0 ? (
          <p className="text-xs text-pink-100/70">
            {activeRoom ? 'No messages yet.' : 'No room selected.'}
          </p>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <div key={msg.id} className="rounded border border-pink-300/20 bg-black/30 px-2 py-1">
                <div className="flex items-center justify-between text-[10px] text-pink-200/70">
                  <span className="font-semibold">{msg.displayName}</span>
                  <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-xs text-pink-50">{msg.content}</p>
              </div>
            ))}
            <div ref={msgEndRef} />
          </div>
        )}
      </div>

      {showGuestPrompt ? (
        <div className="mt-2 flex gap-2">
          <input
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmGuestName(); } }}
            placeholder="Enter your name..."
            maxLength={24}
            className="flex-1 rounded border border-pink-300/40 bg-black/30 px-2 py-1.5 text-xs text-pink-100 outline-none placeholder:text-pink-200/50"
          />
          <button
            onClick={confirmGuestName}
            disabled={!guestName.trim()}
            className="rounded border border-black bg-[#ff4fcf] px-3 py-1.5 text-xs font-bold text-black shadow-[2px_2px_0_#000] disabled:opacity-50"
          >
            OK
          </button>
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-1.5">
          {!user && guestNameConfirmed && isOpenRoom && (
            <div className="flex items-center gap-1.5 text-[10px] text-pink-200/80">
              <span>As <strong className="text-pink-100">{guestName}</strong></span>
              <button
                onClick={() => { setGuestNameConfirmed(false); localStorage.removeItem(GUEST_NAME_KEY); }}
                className="underline text-pink-300/80 hover:text-pink-200"
              >
                change
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
              disabled={!canPost || sending}
              placeholder={
                !activeRoom ? 'No room selected' :
                isOpenRoom && !user && !guestNameConfirmed ? 'Enter your name first...' :
                user || (isOpenRoom && guestNameConfirmed) ? 'Write a message...' :
                'Login to write'
              }
              className="flex-1 rounded border border-pink-300/40 bg-black/30 px-2 py-1.5 text-xs text-pink-100 outline-none placeholder:text-pink-200/50"
            />
            <button
              onClick={() => void send()}
              disabled={!canPost || !draft.trim() || sending}
              className="rounded border border-black bg-[#ff4fcf] px-3 py-1.5 text-xs font-bold text-black shadow-[2px_2px_0_#000] disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-[11px] text-red-300">{error}</p>}
    </section>
  );
};
