import React from 'react';
import { pinkChatApi } from '../../services/pinkChatService';
import { PinkChatMessage, PinkChatRoom } from '../../types/pinkChat';

type Props = {
  title: string;
  subtitle?: string;
  rooms: PinkChatRoom[];
  token?: string | null;
  userId?: string;
  displayName?: string;
  canPost: boolean;
  emptyHint: string;
};

export const PinkChatPanel: React.FC<Props> = ({
  title,
  subtitle,
  rooms,
  token,
  userId,
  displayName,
  canPost,
  emptyHint,
}) => {
  const [activeRoomId, setActiveRoomId] = React.useState<string>('');
  const [messages, setMessages] = React.useState<PinkChatMessage[]>([]);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!rooms.length) {
      setActiveRoomId('');
      return;
    }
    if (!activeRoomId || !rooms.some((r) => r.id === activeRoomId)) setActiveRoomId(rooms[0].id);
  }, [rooms, activeRoomId]);

  const load = React.useCallback(async () => {
    if (!activeRoomId) return;
    try {
      const next = await pinkChatApi.getMessages(activeRoomId, token || undefined);
      setMessages(next);
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Chat konnte nicht geladen werden.');
    }
  }, [activeRoomId, token]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!activeRoomId) return;
    const id = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(id);
  }, [activeRoomId, load]);

  const send = async () => {
    if (!canPost || !activeRoomId || !draft.trim() || !token || !userId || !displayName) return;
    try {
      setSending(true);
      const posted = await pinkChatApi.postMessage(activeRoomId, draft, token, displayName, userId);
      setMessages((prev) => [...prev, posted].slice(-200));
      setDraft('');
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Nachricht konnte nicht gesendet werden.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-2xl border border-pink-300/70 bg-black/45 p-3">
      <div className="mb-2">
        <h3 className="text-sm font-bold text-pink-100">{title}</h3>
        {subtitle && <p className="text-[11px] text-pink-200/75">{subtitle}</p>}
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {rooms.map((room) => (
          <button
            key={room.id}
            onClick={() => setActiveRoomId(room.id)}
            className={`rounded border px-2 py-1 text-[11px] ${
              activeRoomId === room.id
                ? 'border-pink-300 bg-pink-500/20 text-pink-100'
                : 'border-pink-300/40 bg-black/20 text-pink-200/80 hover:bg-pink-500/10'
            }`}
          >
            #{room.name}
          </button>
        ))}
      </div>

      <div className="h-60 overflow-y-auto rounded border border-pink-300/30 bg-black/35 p-2">
        {messages.length === 0 ? (
          <p className="text-xs text-pink-100/70">{emptyHint}</p>
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
          </div>
        )}
      </div>

      <div className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!canPost || sending}
          placeholder={canPost ? 'Nachricht schreiben...' : 'Nur lesen - bitte einloggen'}
          className="flex-1 rounded border border-pink-300/40 bg-black/30 px-2 py-1.5 text-xs text-pink-100 outline-none placeholder:text-pink-200/50"
        />
        <button
          onClick={send}
          disabled={!canPost || !draft.trim() || sending}
          className="rounded border border-black bg-[#ff4fcf] px-3 py-1.5 text-xs font-bold text-black shadow-[2px_2px_0_#000] disabled:opacity-50"
        >
          Send
        </button>
      </div>
      {error && <p className="mt-2 text-[11px] text-red-300">{error}</p>}
    </section>
  );
};

