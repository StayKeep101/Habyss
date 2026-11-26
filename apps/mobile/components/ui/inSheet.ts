import { createContext, useContext } from 'react';

/**
 * Whether a piece sits inside a sheet (VoidSheet provides it). A sheet is
 * already a surface, so what would draw its own card there (a settings group)
 * draws none, instead of a card floating on a card.
 */
export const InSheet = createContext(false);
export const useInSheet = (): boolean => useContext(InSheet);
