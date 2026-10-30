'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Conversation, Message, Profile, MessageReaction } from '@/types/database.types';
import { formatPHTime } from '@/lib/ph-time';
import { Send, Image, Megaphone, Users, User, ArrowLeft, ShieldAlert, Smile, Heart, ThumbsUp } from 'lucide-react';

interface Props {
  currentUser: Profile;
}

export default function ChatWindow({ currentUser }: Props) {
  const supabase = createClient();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [colleagues, setColleagues] = useState<Profile[]>([]);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [activeReactionPickerMsgId, setActiveReactionPickerMsgId] = useState<string | null>(null);

  const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏'];

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load conversations
  const loadConversations = async () => {
    try {
      const res = await fetch('/api/chat/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
        if (!selectedConversation && data.conversations?.length > 0) {
          setSelectedConversation(data.conversations[0]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Load messages for active conversation
  const loadMessages = async (convId: string) => {
    try {
      const res = await fetch(`/api/chat/conversations/${convId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        scrollToBottom();

        // Mark as read
        await fetch(`/api/chat/conversations/${convId}/read`, { method: 'POST' });
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch colleague directory for starting chats
  const loadColleagues = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .neq('id', currentUser.id);
    if (data) setColleagues(data as Profile[]);
  };

  useEffect(() => {
    loadConversations();
    loadColleagues();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation?.id]);

  // Supabase Realtime channel subscription for live chat & reactions
  useEffect(() => {
    if (!selectedConversation) return;

    // Listen to messages table events
    const channel = supabase
      .channel(`chat-room-${selectedConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversation.id}`,
        },
        async () => {
          // Immediately reload messages for accurate order, profile joins, and relations
          loadMessages(selectedConversation.id);
          loadConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        () => {
          // Instantly refresh reactions when anyone reacts
          loadMessages(selectedConversation.id);
        }
      )
      .subscribe();

    // Fast backup polling (every 3 seconds) in case WebSocket is suspended or reconnecting
    const pollInterval = setInterval(() => {
      loadMessages(selectedConversation.id);
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [selectedConversation?.id]);

  // Handle Emoji Reaction
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    setActiveReactionPickerMsgId(null);
    try {
      const res = await fetch(`/api/chat/messages/${messageId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });

      if (res.ok && selectedConversation) {
        loadMessages(selectedConversation.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConversation || (!inputText.trim() && !mediaUrl)) return;

    const content = inputText;
    const media = mediaUrl;
    setInputText('');
    setMediaUrl('');

    // 1. Optimistic instant message render (0-millisecond UI feedback)
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      conversation_id: selectedConversation.id,
      sender_id: currentUser.id,
      content: content || null,
      media_url: media || null,
      created_at: new Date().toISOString(),
      sender: currentUser,
      reactions: [],
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    scrollToBottom();

    try {
      const res = await fetch(`/api/chat/conversations/${selectedConversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, media_url: media }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to send message');
        // Rollback optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      } else {
        const data = await res.json();
        // Replace temp message with server confirmed message
        if (data.message) {
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...data.message, reactions: [] } : m))
          );
        }
        loadConversations();
      }
    } catch (e) {
      console.error(e);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  };

  // Start new 1-on-1 chat
  const handleStartDirectChat = async (colleague: Profile) => {
    setShowNewChatModal(false);
    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: colleague.full_name,
          participant_ids: [colleague.id],
          is_group: false,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        await loadConversations();
        setSelectedConversation(data.conversation);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const isAnnouncement = selectedConversation?.is_announcement;
  const canPostInCurrent = !isAnnouncement || currentUser.role === 'admin';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm flex flex-col md:flex-row h-[600px]">
      {/* Conversations list sidebar */}
      <div
        className={`w-full md:w-80 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50/50 dark:bg-slate-900/50 ${
          selectedConversation ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white">Messages</h3>
          <button
            onClick={() => setShowNewChatModal(true)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm"
          >
            + New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
          {conversations.map((c) => {
            const isSelected = selectedConversation?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedConversation(c)}
                className={`w-full p-4 text-left transition flex items-start gap-3 ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/40'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    c.is_announcement
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                      : c.is_group
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                  }`}
                >
                  {c.is_announcement ? (
                    <Megaphone className="w-5 h-5" />
                  ) : c.is_group ? (
                    <Users className="w-5 h-5" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold truncate text-slate-900 dark:text-white">
                      {c.title || (c.is_announcement ? 'Announcements' : 'Direct Message')}
                    </h4>
                    {c.unreadCount ? (
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
                        {c.unreadCount}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {c.lastMessage ? c.lastMessage.content : 'No messages yet'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Conversation Messages */}
      <div
        className={`flex-1 flex flex-col bg-white dark:bg-slate-900 ${
          !selectedConversation ? 'hidden md:flex' : 'flex'
        }`}
      >
        {selectedConversation ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="md:hidden p-1 text-slate-500 hover:text-slate-800"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {selectedConversation.is_announcement && <Megaphone className="w-4 h-4 text-amber-500" />}
                    {selectedConversation.title || 'Conversation'}
                  </h4>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {selectedConversation.is_announcement
                      ? 'Company-wide Announcement Channel (Broadcast)'
                      : 'Supabase Realtime Secured'}
                  </span>
                </div>
              </div>
            </div>

            {/* Message history */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {messages.map((m) => {
                const isMe = m.sender_id === currentUser.id;
                const isAdminMsg = m.sender?.role === 'admin';
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    {!isMe && (
                      <div className="flex items-center gap-1.5 mb-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        <span>{m.sender?.full_name || 'Colleague'}</span>
                        {isAdminMsg && (
                          <span className="px-1.5 py-0.5 text-[9px] bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded font-bold uppercase">
                            Admin
                          </span>
                        )}
                      </div>
                    )}

                    <div className="relative group">
                      <div
                        className={`max-w-[80%] min-w-[76px] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                          isMe
                            ? 'bg-blue-600 text-white rounded-br-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-sm'
                        }`}
                      >
                        {m.content && <p className="whitespace-pre-wrap">{m.content}</p>}
                        {m.media_url && (
                          <div className="mt-2 rounded-xl overflow-hidden max-w-xs">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={m.media_url} alt="Shared media" className="w-full h-auto" />
                          </div>
                        )}
                        <span
                          className={`block text-[10px] mt-1 text-right whitespace-nowrap shrink-0 tabular-nums select-none ${
                            isMe ? 'text-blue-200' : 'text-slate-400'
                          }`}
                        >
                          {formatPHTime(m.created_at)}
                        </span>
                      </div>

                      {/* Display active reactions */}
                      {m.reactions && m.reactions.length > 0 && (
                        <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                          {/* Group reactions by emoji */}
                          {Object.entries(
                            m.reactions.reduce((acc: Record<string, number>, r) => {
                              acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                              return acc;
                            }, {})
                          ).map(([emoji, count]) => {
                            const userReacted = m.reactions?.some(
                              (r) => r.emoji === emoji && r.user_id === currentUser.id
                            );
                            return (
                              <button
                                key={emoji}
                                onClick={() => handleToggleReaction(m.id, emoji)}
                                className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 border shadow-xs transition ${
                                  userReacted
                                    ? 'bg-blue-100 border-blue-400 text-blue-900 dark:bg-blue-950 dark:border-blue-700 dark:text-blue-300 font-bold'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <span>{emoji}</span>
                                {count > 1 && <span className="text-[10px]">{count}</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Reaction trigger hover button */}
                      <div className={`absolute top-0 ${isMe ? '-left-8' : '-right-8'} hidden group-hover:flex items-center`}>
                        <button
                          type="button"
                          onClick={() => setActiveReactionPickerMsgId(activeReactionPickerMsgId === m.id ? null : m.id)}
                          className="p-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-amber-500 shadow-sm transition"
                          title="React to message"
                        >
                          <Smile className="w-3.5 h-3.5" />
                        </button>

                        {/* Messenger-style Emoji Picker Popup */}
                        {activeReactionPickerMsgId === m.id && (
                          <div className={`absolute z-30 -top-9 ${isMe ? 'right-0' : 'left-0'} flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1.5 rounded-full shadow-xl animate-in fade-in zoom-in-95 duration-100`}>
                            {EMOJI_LIST.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleToggleReaction(m.id, emoji)}
                                className="w-7 h-7 flex items-center justify-center text-base hover:scale-130 transition-transform active:scale-95"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            {canPostInCurrent ? (
              <form
                onSubmit={handleSendMessage}
                className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <button
                  type="button"
                  onClick={() => {
                    const url = prompt('Enter image URL to share:');
                    if (url) setMediaUrl(url);
                  }}
                  className="p-2.5 text-slate-500 hover:text-blue-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  title="Share Image"
                >
                  <Image className="w-5 h-5" />
                </button>

                <button
                  type="submit"
                  disabled={loading || (!inputText.trim() && !mediaUrl)}
                  className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl shadow-md transition"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            ) : (
              <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                Only administrators can post in the Announcements channel.
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 text-sm">
            Select a conversation or start a new chat.
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-bold text-base text-slate-900 dark:text-white mb-3">
              Start Direct Chat
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Select an active colleague to begin messaging:
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
              {colleagues.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => handleStartDirectChat(emp)}
                  className="w-full p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left flex items-center gap-3 transition"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                    {emp.full_name[0]}
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold text-slate-900 dark:text-white">{emp.full_name}</h5>
                    <p className="text-[11px] text-slate-400">{emp.email}</p>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowNewChatModal(false)}
              className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

