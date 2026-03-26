import React, { createContext, useContext, useState, useEffect } from 'react';

const SidebarContext = createContext({
    collapsed: false,
    isOpen: true,
    toggle: () => { },
    toggleMobile: () => { },
    isMobile: false,
});

export const SidebarProvider = ({ children }) => {
    const [collapsed, setCollapsed] = useState(false);
    const [isOpen, setIsOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    // Check for mobile viewport
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) {
                setIsOpen(false);
            } else {
                setIsOpen(true);
            }
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const toggle = () => setCollapsed(c => !c);
    const toggleMobile = () => setIsOpen(o => !o);

    return (
        <SidebarContext.Provider value={{ collapsed, toggle, isOpen, toggleMobile, isMobile }}>
            {children}
        </SidebarContext.Provider>
    );
};

export const useSidebar = () => useContext(SidebarContext);
