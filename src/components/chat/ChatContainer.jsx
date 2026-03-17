import React, { useEffect, useState } from 'react';
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatUIKitLoginListener } from "@cometchat/chat-uikit-react";
import { CometChatHome } from "CometChat/components/CometChatHome/CometChatHome";
import CometChatLogin from "CometChat/components/CometChatLogin/CometChatLogin";
import { AppContextProvider } from "CometChat/context/AppContext";
import { useCometChatContext } from "CometChat/context/CometChatContext";
import useSystemColorScheme from "CometChat/customHooks";
import useThemeStyles from "CometChat/customHook/useThemeStyles";
import "@cometchat/chat-uikit-react/css-variables.css";

import { useAuth } from "../../contexts/AuthContext";
import { CometChatUIKit } from "@cometchat/chat-uikit-react";

const ChatContainer = () => {
    const { user } = useAuth();
    const [loggedInUser, setLoggedInUser] = useState(null);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const { styleFeatures, setStyleFeatures } = useCometChatContext();
    const systemTheme = useSystemColorScheme();
    const getLoggedInUser = CometChatUIKitLoginListener?.getLoggedInUser();

    useEffect(() => {
        setLoggedInUser(getLoggedInUser);
    }, [getLoggedInUser]);

    useEffect(() => {
        if (user && !loggedInUser && !isLoggingIn) {
            // DEBUG: Validate user object has required fields
            console.log('[DEBUG] ChatContainer login attempt:', {
                hasUser: !!user,
                hasEmail: !!user?.email,
                email: user?.email,
                userId: user?._id || user?.id
            });

            if (!user.email) {
                console.error('[ERROR] Cannot login to CometChat: user.email is undefined');
                return;
            }

            const uid = user.email.replace(/[@.]/g, '_').toLowerCase();
            setIsLoggingIn(true);
            CometChatUIKit.login(uid)
                .then(ccUser => {
                    setLoggedInUser(ccUser);
                    setIsLoggingIn(false);
                })
                .catch(error => {
                    console.error("CometChat auto-login failed:", error);
                    setIsLoggingIn(false);
                });
        }
    }, [user, loggedInUser, isLoggingIn]);

    useEffect(() => {
        document.body.classList.add('chat-page-active');

        CometChat.addLoginListener(
            "gms-dashboard-chat",
            new CometChat.LoginListener({
                loginSuccess: (user) => {
                    setLoggedInUser(user);
                },
                logoutSuccess: () => {
                    setLoggedInUser(null);
                },
            })
        );

        return () => {
            document.body.classList.remove('chat-page-active');
            CometChat.removeLoginListener("gms-dashboard-chat");
        };
    }, []);

    // Apply theme styles based on CometChat settings
    useThemeStyles(styleFeatures, systemTheme, setStyleFeatures, loggedInUser);

    return (
        <div className="h-100 w-100 overflow-hidden">
            <AppContextProvider>
                {loggedInUser ? (
                    <CometChatHome />
                ) : isLoggingIn ? (
                    <div className="h-100 d-flex flex-column align-items-center justify-content-center bg-light">
                        <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
                            <span className="visually-hidden">Loading...</span>
                        </div>
                        <h4 className="text-dark mb-1">Initializing Chat</h4>
                        <p className="text-muted">Please wait while we connect you...</p>
                    </div>
                ) : (
                    <CometChatLogin />
                )}
            </AppContextProvider>
        </div>
    );
};

export default ChatContainer;
