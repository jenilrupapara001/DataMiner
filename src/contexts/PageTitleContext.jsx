import React, { createContext, useContext, useState, useCallback } from 'react';

const PageTitleContext = createContext({
    pageTitle: '',
    setPageTitle: () => { },
});

export const PageTitleProvider = ({ children }) => {
    const [pageTitle, setPageTitle] = useState('');

    const updatePageTitle = useCallback((title) => {
        setPageTitle(title);
    }, []);

    return (
        <PageTitleContext.Provider value={{ pageTitle, setPageTitle: updatePageTitle }}>
            {children}
        </PageTitleContext.Provider>
    );
};

export const usePageTitle = () => useContext(PageTitleContext);
