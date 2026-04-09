import React from 'react';
import { usePinkChatAuth } from '../../contexts/PinkChatAuthContext';
import { pinkChatApi } from '../../services/pinkChatService';
import { PinkChatMessage, PinkChatRoom } from '../../types/pinkChat';

const GUEST_NAME_KEY = 'pinkchat_guest_name';

const EMOJI_MAP: Record<string, string> = {
  fire: '🔥',
  heart: '❤️',
  laugh: '😂',
  thumbsup: '👍',
  skull: '💀',
  '100': '💯',
};
const EMOJI_KEYS = Object.keys(EMOJI_MAP);

const canAccessRoom = (room: PinkChatRoom, level: string, role: string) => {
  if (role === 'admin') return true;
  if (room.visibility === 'open') return true;
  if (room.visibility === 'public') return true;
  if (room.visibility === 'dm') return false;
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
  dm: 'DM',
};

const LevelBadge: React.FC<{ level?: string; role?: string; userId?: string }> = ({ level, role, userId }) => {
  if (role === 'admin') return <span className="ml-1 inline-block rounded bg-red-500/70 px-1 py-px text-[8px] font-bold text-white leading-none">ADMIN</span>;
  if (level === 'level2') return <span className="ml-1 inline-block rounded bg-yellow-500/70 px-1 py-px text-[8px] font-bold text-black leading-none">L2</span>;
  if (level === 'level1') return <span className="ml-1 inline-block rounded bg-pink-500/50 px-1 py-px text-[8px] font-bold text-pink-100 leading-none">L1</span>;
  if (level === 'public' || (userId && userId.startsWith('guest-'))) return <span className="ml-1 inline-block rounded bg-gray-500/50 px-1 py-px text-[8px] font-bold text-gray-200 leading-none">Guest</span>;
  return null;
};

const PuppetAvatar: React.FC<{ avatarInscriptionId?: string; displayName: string; userId?: string }> = ({ avatarInscriptionId, displayName, userId }) => {
  const isGuest = !userId || userId.startsWith('guest-');

  if (!isGuest && avatarInscriptionId) {
    return (
      <img
        src={`https://ordinals.com/content/${avatarInscriptionId}`}
        alt=""
        className="h-5 w-5 rounded-full object-cover shrink-0"
      />
    );
  }

  const letter = (displayName || '?')[0].toUpperCase();
  const hue = displayName.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: `hsl(${hue}, 60%, 40%)` }}>
      {letter}
    </span>
  );
};

export const UnifiedChatPanel: React.FC = () => {
  const { user, token } = usePinkChatAuth();
  const [allRooms, setAllRooms] = React.useState<PinkChatRoom[]>([]);
  const [dmRooms, setDmRooms] = React.useState<PinkChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = React.useState('');
  const [messages, setMessages] = React.useState<PinkChatMessage[]>([]);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState('');
  const [guestName, setGuestName] = React.useState(() => localStorage.getItem(GUEST_NAME_KEY) || '');
  const [guestNameConfirmed, setGuestNameConfirmed] = React.useState(() => !!localStorage.getItem(GUEST_NAME_KEY));
  const [replyingTo, setReplyingTo] = React.useState<PinkChatMessage | null>(null);
  const [tab, setTab] = React.useState<'rooms' | 'dms'>('rooms');
  const [hoveredMsgId, setHoveredMsgId] = React.useState<string | null>(null);
  const [emojiPickerMsgId, setEmojiPickerMsgId] = React.useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);

  const loadRooms = React.useCallback(async () => {
    const rooms = await pinkChatApi.getRooms(token || undefined);
    setAllRooms(rooms.filter((r) => !r.archived && r.visibility !== 'dm'));
  }, [token]);

  const loadDmRooms = React.useCallback(async () => {
    if (!token) { setDmRooms([]); return; }
    try {
      const rooms = await pinkChatApi.getDmRooms(token);
      setDmRooms(rooms);
    } catch { setDmRooms([]); }
  }, [token]);

  React.useEffect(() => { void loadRooms(); }, [loadRooms]);
  React.useEffect(() => { void loadDmRooms(); }, [loadDmRooms]);

  const visibleRooms = React.useMemo(() => {
    if (!user) return allRooms.filter((r) => r.visibility === 'open' || r.visibility === 'public');
    return allRooms.filter((r) => canAccessRoom(r, user.level, user.role));
  }, [allRooms, user]);

  const displayedRooms = tab === 'dms' ? dmRooms : visibleRooms;

  React.useEffect(() => {
    if (!displayedRooms.length) { setActiveRoomId(''); return; }
    if (!activeRoomId || !displayedRooms.some((r) => r.id === activeRoomId)) {
      const openRoom = displayedRooms.find((r) => r.visibility === 'open');
      setActiveRoomId(openRoom ? openRoom.id : displayedRooms[0].id);
    }
  }, [displayedRooms, activeRoomId]);

  const activeRoom = [...visibleRooms, ...dmRooms].find((r) => r.id === activeRoomId);
  const isOpenRoom = activeRoom?.visibility === 'open' || activeRoom?.visibility === 'public';
  const isDmRoom = activeRoom?.visibility === 'dm';
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
    const reply = replyingTo ? { id: replyingTo.id, displayName: replyingTo.displayName, content: replyingTo.content } : undefined;

    try {
      setSending(true);
      const posted = await pinkChatApi.postMessage(activeRoomId, draft, senderToken, senderName, senderId, reply);
      setMessages((prev) => [...prev, posted].slice(-200));
      setDraft('');
      setReplyingTo(null);
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (msgId: string) => {
    if (!token || !activeRoomId) return;
    try {
      await pinkChatApi.deleteMessage(activeRoomId, msgId, token);
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, deleted: true, content: '' } : m));
      setConfirmDeleteId(null);
    } catch (err: any) {
      setError(err?.message || 'Delete failed.');
    }
  };

  const handleReaction = async (msgId: string, emoji: string) => {
    if (!activeRoomId) return;
    const senderToken = token || null;
    const gName = !token ? guestName.trim() : undefined;
    try {
      const updated = await pinkChatApi.toggleReaction(activeRoomId, msgId, emoji, senderToken, gName);
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, reactions: updated.reactions } : m));
    } catch { /* silent */ }
    setEmojiPickerMsgId(null);
  };

  const startDm = async (targetUserId: string) => {
    if (!token || !user || targetUserId === user.id) return;
    try {
      const room = await pinkChatApi.getOrCreateDm(targetUserId, token);
      await loadDmRooms();
      setTab('dms');
      setActiveRoomId(room.id);
    } catch (err: any) {
      setError(err?.message || 'DM failed.');
    }
  };

  const getDmPartnerName = (room: PinkChatRoom) => {
    if (!user || !room.name) return room.name;
    const parts = room.name.split(' & ');
    return parts.find((p) => p !== user.displayName) || room.name;
  };

  const msgEndRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const showGuestPrompt = !user && isOpenRoom && !guestNameConfirmed;
  const currentUserId = user?.id || (guestNameConfirmed ? `guest-${guestName.trim().toLowerCase().replace(/\s+/g, '-')}` : '');

  return (
    <section className="rounded-2xl border border-pink-300/70 bg-black/45 p-3 flex flex-col h-full">
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-xs font-bold text-pink-100">PinkPuppets Chat</h3>
        {user && (
          <div className="flex gap-1">
            <button onClick={() => setTab('rooms')} className={`rounded px-2 py-0.5 text-[10px] ${tab === 'rooms' ? 'bg-pink-500/20 text-pink-100 border border-pink-300/50' : 'text-pink-200/70 hover:text-pink-100'}`}>Rooms</button>
            <button onClick={() => { setTab('dms'); void loadDmRooms(); }} className={`rounded px-2 py-0.5 text-[10px] ${tab === 'dms' ? 'bg-pink-500/20 text-pink-100 border border-pink-300/50' : 'text-pink-200/70 hover:text-pink-100'}`}>
              DMs{dmRooms.length > 0 && <span className="ml-1 rounded-full bg-pink-500/40 px-1 text-[8px]">{dmRooms.length}</span>}
            </button>
          </div>
        )}
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {displayedRooms.map((room) => {
          const badge = isDmRoom ? '' : (VISIBILITY_LABEL[room.visibility] || '');
          const label = room.visibility === 'dm' ? getDmPartnerName(room) : room.name;
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
              {room.visibility === 'dm' ? '💬' : '#'}{label}
              {badge && <span className="rounded bg-pink-500/30 px-1 py-px text-[9px] text-pink-200">{badge}</span>}
            </button>
          );
        })}
        {tab === 'dms' && dmRooms.length === 0 && (
          <span className="text-[10px] text-pink-200/60 py-1">No DMs yet. Click a username to start one.</span>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto rounded border border-pink-300/30 bg-black/35 p-2">
        {messages.length === 0 ? (
          <p className="text-xs text-pink-100/70">
            {activeRoom ? 'No messages yet.' : 'No room selected.'}
          </p>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => {
              const isOwn = msg.userId === currentUserId;
              const canDelete = user && (user.role === 'admin' || isOwn);
              const isDeleted = msg.deleted;

              return (
                <div
                  key={msg.id}
                  className="group relative rounded border border-pink-300/20 bg-black/30 px-2 py-1"
                  onMouseEnter={() => setHoveredMsgId(msg.id)}
                  onMouseLeave={() => { setHoveredMsgId(null); if (emojiPickerMsgId === msg.id) setEmojiPickerMsgId(null); }}
                >
                  {isDeleted ? (
                    <p className="text-[10px] text-pink-200/40 italic">Message deleted</p>
                  ) : (
                    <>
                      {msg.replyTo && (
                        <div className="mb-1 rounded border-l-2 border-pink-400/40 bg-pink-900/20 px-2 py-0.5 text-[10px] text-pink-200/60">
                          <span className="font-semibold">{msg.replyTo.displayName}:</span> {msg.replyTo.content.slice(0, 100)}{msg.replyTo.content.length > 100 ? '…' : ''}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-[10px] text-pink-200/70">
                        <PuppetAvatar avatarInscriptionId={msg.avatarInscriptionId || (user && msg.userId === user.id ? user.avatarInscriptionId : undefined)} displayName={msg.displayName} userId={msg.userId} />
                        <button
                          className="font-semibold hover:underline hover:text-pink-100"
                          onClick={() => { if (user && msg.userId !== user.id && !msg.userId.startsWith('guest-')) void startDm(msg.userId); }}
                          title={user && !msg.userId.startsWith('guest-') && msg.userId !== user?.id ? 'Start DM' : ''}
                        >
                          {msg.displayName}
                        </button>
                        <LevelBadge level={msg.level} role={msg.role} userId={msg.userId} />
                        <span className="ml-auto">{new Date(msg.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-xs text-pink-50">{msg.content}</p>

                      {/* Reactions display */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {Object.entries(msg.reactions).map(([emoji, users]) => (
                            <button
                              key={emoji}
                              onClick={() => void handleReaction(msg.id, emoji)}
                              className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] transition-colors ${
                                users.includes(currentUserId) ? 'border-pink-400 bg-pink-500/20 text-pink-100' : 'border-pink-300/20 bg-black/20 text-pink-200/70 hover:bg-pink-500/10'
                              }`}
                            >
                              <span>{EMOJI_MAP[emoji] || emoji}</span>
                              <span>{users.length}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Action buttons on hover */}
                      {hoveredMsgId === msg.id && (
                        <div className="absolute -top-2 right-1 flex gap-0.5 rounded border border-pink-300/30 bg-black/80 px-1 py-0.5 shadow-lg">
                          <button onClick={() => setReplyingTo(msg)} title="Reply" className="text-[10px] text-pink-200/70 hover:text-pink-100 px-0.5">↩</button>
                          <button onClick={() => setEmojiPickerMsgId(emojiPickerMsgId === msg.id ? null : msg.id)} title="React" className="text-[10px] text-pink-200/70 hover:text-pink-100 px-0.5">😀</button>
                          {canDelete && (
                            confirmDeleteId === msg.id ? (
                              <>
                                <button onClick={() => void handleDelete(msg.id)} className="text-[10px] text-red-400 hover:text-red-300 px-0.5 font-bold">✓</button>
                                <button onClick={() => setConfirmDeleteId(null)} className="text-[10px] text-pink-200/70 hover:text-pink-100 px-0.5">✕</button>
                              </>
                            ) : (
                              <button onClick={() => setConfirmDeleteId(msg.id)} title="Delete" className="text-[10px] text-pink-200/70 hover:text-red-300 px-0.5">🗑</button>
                            )
                          )}
                        </div>
                      )}

                      {/* Emoji picker */}
                      {emojiPickerMsgId === msg.id && (
                        <div className="absolute -top-8 right-1 flex gap-0.5 rounded border border-pink-300/30 bg-black/90 px-1 py-0.5 shadow-lg z-10">
                          {EMOJI_KEYS.map((ek) => (
                            <button key={ek} onClick={() => void handleReaction(msg.id, ek)} className="text-sm hover:scale-125 transition-transform px-0.5">{EMOJI_MAP[ek]}</button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
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

          {/* Reply preview */}
          {replyingTo && (
            <div className="flex items-center gap-2 rounded border border-pink-400/30 bg-pink-900/20 px-2 py-1 text-[10px] text-pink-200/80">
              <span className="flex-1 truncate">↩ <strong>{replyingTo.displayName}:</strong> {replyingTo.content.slice(0, 80)}</span>
              <button onClick={() => setReplyingTo(null)} className="text-pink-300 hover:text-pink-100 shrink-0">✕</button>
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
