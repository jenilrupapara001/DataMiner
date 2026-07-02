/**
 * RetailOps Partner — Seller Context
 *
 * Manages the currently selected seller/brand across the app.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SELECTED_SELLER_KEY = 'retailops_selected_seller';

export interface Seller {
  Id: string;
  Name: string;
  Marketplace: string;
  SellerId: string;
  IsActive: boolean;
  Plan: string;
  PartnerTag: string;
  CreatedAt: string;
}

interface SellerContextType {
  sellers: Seller[];
  selectedSeller: Seller | null;
  isLoading: boolean;
  setSellers: (sellers: Seller[]) => void;
  selectSeller: (seller: Seller) => Promise<void>;
  clearSelection: () => Promise<void>;
}

const SellerContext = createContext<SellerContextType>({
  sellers: [],
  selectedSeller: null,
  isLoading: true,
  setSellers: () => {},
  selectSeller: async () => {},
  clearSelection: async () => {},
});

export function SellerProvider({ children }: { children: React.ReactNode }) {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved selection on mount
  useEffect(() => {
    const loadSelection = async () => {
      try {
        const saved = await AsyncStorage.getItem(SELECTED_SELLER_KEY);
        if (saved) {
          setSelectedSeller(JSON.parse(saved));
        }
      } catch {}
      setIsLoading(false);
    };
    loadSelection();
  }, []);

  const selectSeller = useCallback(async (seller: Seller) => {
    setSelectedSeller(seller);
    await AsyncStorage.setItem(SELECTED_SELLER_KEY, JSON.stringify(seller));
  }, []);

  const clearSelection = useCallback(async () => {
    setSelectedSeller(null);
    await AsyncStorage.removeItem(SELECTED_SELLER_KEY);
  }, []);

  return (
    <SellerContext.Provider
      value={{
        sellers,
        selectedSeller,
        isLoading,
        setSellers,
        selectSeller,
        clearSelection,
      }}
    >
      {children}
    </SellerContext.Provider>
  );
}

export function useSeller() {
  return useContext(SellerContext);
}
