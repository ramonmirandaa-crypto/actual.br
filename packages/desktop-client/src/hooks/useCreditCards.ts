import { useCallback, useMemo } from 'react';

import { v4 as uuidv4 } from 'uuid';

import { type CreditCardPref } from 'loot-core/types/prefs';

import { useLocalPref } from './useLocalPref';

type StoredCreditCard = NonNullable<CreditCardPref>;

type CreditCardDraft = Omit<
  StoredCreditCard,
  'id' | 'createdAt' | 'updatedAt'
> & {
  id?: string;
};

type CreditCardInput = CreditCardDraft & {
  createdAt?: string | null;
  updatedAt?: string | null;
};

type UseCreditCardsResult = {
  cards: StoredCreditCard[];
  addCard: (card: CreditCardDraft) => StoredCreditCard;
  updateCard: (id: string, updates: Partial<CreditCardDraft>) => void;
  removeCard: (id: string) => void;
  clearAll: () => void;
};

function normalizeCard(card: CreditCardInput): StoredCreditCard {
  const now = new Date().toISOString();
  return {
    id: card.id ?? uuidv4(),
    name: card.name?.trim() ?? '',
    accountId: card.accountId ?? null,
    color: card.color ?? null,
    issuer: card.issuer?.trim() ?? null,
    lastFour: card.lastFour?.trim() ?? null,
    limit: card.limit ?? null,
    notes: card.notes?.trim() ?? null,
    createdAt: card.createdAt ?? now,
    updatedAt: card.updatedAt ?? now,
  };
}

export function useCreditCards(): UseCreditCardsResult {
  const [storedCards, setStoredCards, clearStoredCards] =
    useLocalPref('ui.creditCards');

  const cards = useMemo(() => {
    const normalized = (storedCards ?? []).map(card => normalizeCard(card));
    return normalized.sort((a, b) => {
      const left = a.createdAt ?? a.updatedAt ?? '';
      const right = b.createdAt ?? b.updatedAt ?? '';
      return right.localeCompare(left);
    });
  }, [storedCards]);

  const setCards = useCallback(
    (updater: (current: StoredCreditCard[]) => StoredCreditCard[]) => {
      setStoredCards(prevCards => {
        const current = (prevCards ?? []).map(card => normalizeCard(card));
        return updater(current);
      });
    },
    [setStoredCards],
  );

  const addCard = useCallback(
    (card: CreditCardDraft) => {
      const normalized = normalizeCard(card);
      setCards(cards => [normalized, ...cards]);
      return normalized;
    },
    [setCards],
  );

  const updateCard = useCallback(
    (id: string, updates: Partial<CreditCardDraft>) => {
      setCards(cards =>
        cards.map(card =>
          card.id === id
            ? normalizeCard({
                ...card,
                ...updates,
                id,
                createdAt: card.createdAt,
                updatedAt: new Date().toISOString(),
              })
            : card,
        ),
      );
    },
    [setCards],
  );

  const removeCard = useCallback(
    (id: string) => {
      setCards(cards => cards.filter(card => card.id !== id));
    },
    [setCards],
  );

  const clearAll = useCallback(() => {
    clearStoredCards();
  }, [clearStoredCards]);

  return {
    cards,
    addCard,
    updateCard,
    removeCard,
    clearAll,
  };
}
