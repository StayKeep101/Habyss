import React, { useEffect, useMemo, useState } from 'react';
import { on } from '@/lib/appEvents';
import { marketFeed, type Market } from '@/lib/market';
import { OpenSheet } from './MarketSection';

/**
 * "Open a goal to bets", from the + on Community: your goals that can be,
 * one tap each. Mounted once over the app.
 */
export function OpenBetHost() {
    const [visible, setVisible] = useState(false);
    const [markets, setMarkets] = useState<Market[]>([]);
    useEffect(() => {
        const sub = on('show_open_bet', () => {
            setVisible(true);
            marketFeed().then(setMarkets).catch(() => setMarkets([]));
        });
        return () => sub.remove();
    }, []);
    const openKeys = useMemo(() => new Set(markets.filter(market => market.mine && market.status === 'open').map(market => market.goalKey)), [markets]);
    return <OpenSheet visible={visible} openKeys={openKeys} onClose={() => setVisible(false)} />;
}
