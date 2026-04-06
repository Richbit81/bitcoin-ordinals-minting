import React from 'react';
import { pinkChatApi } from '../../services/pinkChatService';
import { PinkChatRoom } from '../../types/pinkChat';

type Props = {
  token: string;
  onRoomCreated: (room: PinkChatRoom) => void;
};

export const AdminRoomManager: React.FC<Props> = ({ token, onRoomCreated }) => {
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [visibility, setVisibility] = React.useState<'public' | 'level1' | 'level2' | 'admin'>('level1');
  const [error, setError] = React.useState('');

  const create = async () => {
    if (!name.trim() || !slug.trim()) return;
    try {
      const room = await pinkChatApi.createRoom(token, { name: name.trim(), slug: slug.trim(), visibility, description: description.trim() });
      onRoomCreated(room);
      setName('');
      setSlug('');
      setDescription('');
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Failed to create room.');
    }
  };

  return (
    <div className="rounded-xl border border-pink-300/50 bg-black/35 p-3">
      <h4 className="text-xs font-bold text-pink-100">Admin: Create Room</h4>
      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Room name" className="rounded border border-pink-300/40 bg-black/30 px-2 py-1.5 text-xs text-pink-100" />
        <input value={slug} onChange={(e) => setSlug(e.target.value.replace(/\s+/g, '-').toLowerCase())} placeholder="room-slug" className="rounded border border-pink-300/40 bg-black/30 px-2 py-1.5 text-xs text-pink-100" />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="rounded border border-pink-300/40 bg-black/30 px-2 py-1.5 text-xs text-pink-100 md:col-span-2" />
        <select value={visibility} onChange={(e) => setVisibility(e.target.value as any)} className="rounded border border-pink-300/40 bg-black/30 px-2 py-1.5 text-xs text-pink-100">
          <option value="public">public</option>
          <option value="level1">level1</option>
          <option value="level2">level2</option>
          <option value="admin">admin</option>
        </select>
        <button onClick={() => void create()} className="rounded border border-black bg-[#ff4fcf] px-2 py-1.5 text-xs font-bold text-black">
          Create Room
        </button>
      </div>
      {error && <p className="mt-2 text-[11px] text-red-300">{error}</p>}
    </div>
  );
};

