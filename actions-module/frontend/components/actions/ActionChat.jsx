import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Clock, CheckSquare, Check, X, Hash, AtSign } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import api from '../../services/api';
import './ActionChatWhatsApp.css';

const ActionChat = ({ actionId, messages: initialMessages = [], onSendMessage, users: propUsers = [], tasks = [], onNavigateToAction }) => {
    const [messages, setMessages] = useState(initialMessages);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [mentionState, setMentionState] = useState({
        isActive: false,
        type: null, // 'USER' or 'TASK'
        query: '',
        index: -1 // Cursor position where mention started
    });
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const { user: currentUser } = useAuth();
    const socket = useSocket();

    useEffect(() => {
        setMessages(initialMessages);
    }, [initialMessages]);

    useEffect(() => {
        if (!socket || !actionId) return;

        const handleNewMessage = (message) => {
            setMessages(prev => {
                const exists = prev.some(m => (m._id || m.id) === (message._id || message.id));
                if (exists) return prev;
                return [...prev, message];
            });
        };

        socket.on(`action-message-${actionId}`, handleNewMessage);

        return () => {
            socket.off(`action-message-${actionId}`, handleNewMessage);
        };
    }, [socket, actionId]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const [users, setUsers] = useState(propUsers || []);

    useEffect(() => {
        if (propUsers && propUsers.length > 0) {
            setUsers(propUsers);
        } else {
            const fetchUsers = async () => {
                try {
                    const response = await api.get('/users');
                    if (response.data) {
                        setUsers(response.data);
                    }
                } catch (error) {
                    console.error('Failed to fetch users for chat:', error);
                }
            };
            fetchUsers();
        }
    }, [propUsers]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleInputChange = (e) => {
        const val = e.target.value;
        const cursorSafe = e.target.selectionStart || val.length;
        setNewMessage(val);

        const textBeforeCursor = val.slice(0, cursorSafe);
        const lastWord = textBeforeCursor.split(' ').pop();

        if (lastWord.startsWith('@')) {
            setMentionState({
                isActive: true,
                type: 'USER',
                query: lastWord.slice(1),
                index: cursorSafe - lastWord.length
            });
        } else if (lastWord.startsWith('#')) {
            setMentionState({
                isActive: true,
                type: 'TASK',
                query: lastWord.slice(1),
                index: cursorSafe - lastWord.length
            });
        } else {
            setMentionState({ isActive: false, type: null, query: '', index: -1 });
        }
    };

    const handleSelectMention = (item) => {
        if (!mentionState.isActive) return;

        const val = newMessage;
        const beforeMention = val.slice(0, mentionState.index);
        const restOfString = val.slice(mentionState.index + mentionState.query.length + 1);

        let insertText = '';
        if (mentionState.type === 'USER') {
            insertText = `@${item.name} `;
        } else {
            insertText = `#[${item.title.substring(0, 30)}...](task:${item._id || item.id}) `;
        }

        setNewMessage(beforeMention + insertText + restOfString);
        setMentionState({ isActive: false, type: null, query: '', index: -1 });
        inputRef.current?.focus();
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!newMessage.trim() || isSending) return;

        setIsSending(true);
        try {
            await onSendMessage(newMessage);
            setNewMessage('');
            setMentionState({ isActive: false, type: null, query: '', index: -1 });
        } catch (error) {
            console.error('Failed to send message:', error);
        } finally {
            setIsSending(false);
        }
    };

    const formatTime = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        }
        return date.toLocaleDateString();
    };

    // Filter Items for Mention
    const filteredUsers = mentionState.isActive && mentionState.type === 'USER' && Array.isArray(users)
        ? users.filter(u => {
            const name = u.firstName ? `${u.firstName} ${u.lastName}` : (u.name || u.email);
            return name.toLowerCase().includes(mentionState.query.toLowerCase());
        })
        : [];

    const filteredTasks = mentionState.isActive && mentionState.type === 'TASK' && Array.isArray(tasks)
        ? tasks.filter(t => t.title?.toLowerCase().includes(mentionState.query.toLowerCase()) && (t._id || t.id) !== actionId)
        : [];

    const groupedMessages = messages.reduce((groups, message) => {
        const date = formatDate(message.createdAt);
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(message);
        return groups;
    }, {});

    const parseMessageContent = (content) => {
        const parts = [];
        let lastIndex = 0;
        const taskRegex = /#\[(.*?)\]\(task:(.*?)\)/g;
        let match;

        while ((match = taskRegex.exec(content)) !== null) {
            if (match.index > lastIndex) {
                const text = content.substring(lastIndex, match.index);
                parts.push(...parseSimpleMentions(text));
            }
            const taskId = match[2];
            parts.push(
                <button
                    key={`task-${match.index}`}
                    className="btn btn-link p-0 text-info fw-bold text-decoration-none align-baseline"
                    style={{ fontSize: 'inherit' }}
                    onClick={() => onNavigateToAction && onNavigateToAction(taskId)}
                >
                    #{match[1]}
                </button>
            );
            lastIndex = taskRegex.lastIndex;
        }

        if (lastIndex < content.length) {
            parts.push(...parseSimpleMentions(content.substring(lastIndex)));
        }

        return parts;
    };

    const parseSimpleMentions = (text) => {
        return text.split(/(@\w+|#\w+)(?=\s|$|[.,!])/g).map((part, i) => {
            if (part.startsWith('@')) return <span key={i} style={{ color: '#007aff', fontWeight: 'bold' }}>{part}</span>;
            if (part.startsWith('#')) return <span key={i} style={{ color: '#0366d6', fontWeight: 'bold' }}>{part}</span>;
            return part;
        });
    };

    return (
        <div className="chat-container">
            <div className="chat-messages-area">
                {messages.length === 0 ? (
                    <div className="text-center text-muted py-5 mt-5">
                        <div className="mb-3">
                            <i className="bi bi-chat-dots" style={{ fontSize: '3rem', color: 'rgba(0,0,0,0.1)' }}></i>
                        </div>
                        <p className="fw-medium">No messages yet</p>
                        <p className="small">Send a message to start the discussion</p>
                    </div>
                ) : (
                    Object.entries(groupedMessages).map(([date, dateMessages]) => (
                        <div key={date} className="d-flex flex-column">
                            <div className="chat-date-separator">
                                <span>{date}</span>
                            </div>
                            {dateMessages.map((msg, index) => {
                                const isMe = (msg.sender?._id || msg.sender?.id) === (currentUser?._id || currentUser?.id);
                                const senderName = msg.sender?.firstName ? `${msg.sender.firstName} ${msg.sender.lastName}` : (msg.sender?.name || 'User');

                                return (
                                    <div
                                        key={msg._id || index}
                                        className={`message-bubble ${isMe ? 'sent' : 'received'}`}
                                    >
                                        {!isMe && (
                                            <div className="chat-sender-name">
                                                {senderName}
                                            </div>
                                        )}
                                        <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                                            {parseMessageContent(msg.content)}
                                        </div>

                                        {msg.actionId && (
                                            <div className="mt-2 p-2 bg-white bg-opacity-50 border rounded d-flex align-items-center gap-2 cursor-pointer"
                                                onClick={() => {
                                                    const taskId = typeof msg.actionId === 'object' ? msg.actionId._id : msg.actionId;
                                                    onNavigateToAction && onNavigateToAction(taskId);
                                                }}
                                                style={{ borderLeft: '3px solid #128c7e' }}
                                            >
                                                <div className="small fw-bold text-dark text-truncate">
                                                    {tasks?.find(t => (t._id || t.id) === (msg.actionId._id || msg.actionId))?.title || 'Linked Task'}
                                                </div>
                                            </div>
                                        )}

                                        <div className="message-info">
                                            {formatTime(msg.createdAt)}
                                            {isMe && (
                                                <div className="chat-checkmarks">
                                                    <Check size={12} strokeWidth={3} />
                                                    <Check size={12} strokeWidth={3} style={{ marginLeft: '-8px' }} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {mentionState.isActive && (
                <div className="mention-popup-whatsapp position-absolute shadow">
                    <div className="p-2 border-bottom bg-light d-flex justify-content-between align-items-center">
                        <span className="small fw-bold text-muted text-uppercase">Mention {mentionState.type}</span>
                        <X size={14} className="cursor-pointer" onClick={() => setMentionState({ isActive: false, type: null, query: '', index: -1 })} />
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {mentionState.type === 'USER' && filteredUsers.map(user => {
                            const displayName = user.firstName ? `${user.firstName} ${user.lastName}` : (user.name || user.email);
                            return (
                                <div
                                    key={user._id || user.id}
                                    className="p-2 d-flex align-items-center gap-3 cursor-pointer hover-bg-light border-bottom"
                                    onClick={() => handleSelectMention({ ...user, name: displayName })}
                                >
                                    <div className="chat-avatar-container">
                                        {user.avatar ? <img src={user.avatar} className="w-100 h-100 object-fit-cover" /> : <User size={14} className="text-secondary" />}
                                    </div>
                                    <span className="small fw-medium">{displayName}</span>
                                </div>
                            );
                        })}
                        {mentionState.type === 'TASK' && filteredTasks.map(task => (
                            <div
                                key={task._id || task.id}
                                className="p-2 d-flex align-items-center gap-3 cursor-pointer hover-bg-light border-bottom"
                                onClick={() => handleSelectMention(task)}
                            >
                                <div className="chat-avatar-container bg-info-subtle text-info">
                                    <Hash size={14} />
                                </div>
                                <span className="small fw-medium text-truncate">{task.title}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="chat-input-area">
                <div className="chat-suggestion-bar">
                    <div className="chat-suggestion-chip" onClick={() => {
                        setNewMessage(prev => prev + (prev.endsWith(' ') ? '@' : ' @'));
                        setMentionState({ isActive: true, type: 'USER', query: '', index: newMessage.length + (newMessage.endsWith(' ') ? 1 : 2) });
                        inputRef.current?.focus();
                    }}>
                        <AtSign size={12} className="me-1" /> Mention
                    </div>
                    <div className="chat-suggestion-chip" onClick={() => {
                        setNewMessage(prev => prev + (prev.endsWith(' ') ? '#' : ' #'));
                        setMentionState({ isActive: true, type: 'TASK', query: '', index: newMessage.length + (newMessage.endsWith(' ') ? 1 : 2) });
                        inputRef.current?.focus();
                    }}>
                        <Hash size={12} className="me-1" /> Task
                    </div>
                </div>
                <div className="chat-input-row">
                    <input
                        ref={inputRef}
                        type="text"
                        className="form-control-whatsapp"
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={handleInputChange}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                handleSubmit(e);
                            }
                        }}
                        disabled={isSending}
                    />
                    <button
                        className="btn-whatsapp-send"
                        disabled={!newMessage.trim() || isSending}
                        onClick={handleSubmit}
                    >
                        {isSending ? (
                            <div className="spinner-border spinner-border-sm" role="status"></div>
                        ) : (
                            <Send size={18} fill="currentColor" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ActionChat;
