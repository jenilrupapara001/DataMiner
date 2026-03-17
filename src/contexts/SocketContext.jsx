import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const { user } = useAuth();
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
    }, []);

    useEffect(() => {
        if (user) {
            // DEBUG: Log socket connection attempt
            console.log('[DEBUG] SocketContext: User logged in, attempting socket connection', {
                userId: user._id || user.id,
                hasEmail: !!user.email,
                envUrl: import.meta.env.VITE_API_URL
            });

            const socketUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '');
            console.log('[DEBUG] Socket URL:', socketUrl);

            const newSocket = io(socketUrl, {
                transports: ['websocket'],
                autoConnect: true
            });
            setSocket(newSocket);

            newSocket.emit('join', user._id || user.id);

            // Notification handling
            newSocket.on('receive_message', (message) => {
                if (document.hidden && Notification.permission === "granted") {
                    new Notification(`New message from ${message.sender?.firstName || 'User'}`, {
                        body: message.content,
                        icon: message.sender?.avatar || '/favicon.ico'
                    });
                }
            });

            newSocket.on('incoming_call', (call) => {
                if (document.hidden && Notification.permission === "granted") {
                    new Notification(`Incoming ${call.type} Call`, {
                        body: `${call.callerId?.firstName} is calling you...`,
                        icon: call.callerId?.avatar || '/favicon.ico'
                    });
                }
            });

            return () => {
                newSocket.off('receive_message');
                newSocket.off('incoming_call');
                newSocket.close();
            };
        } else if (socket) {
            socket.close();
            setSocket(null);
        }
    }, [user]);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};
