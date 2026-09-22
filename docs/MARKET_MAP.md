# MARKET MAP — `config/markets.json` → underlying (source: HL `allPerpMetas` + exchange symbol lists)

Seed covers 30 HIP-3 markets. Validate at indexer boot against live `allPerpMetas`; unmapped coins show grey on the board, never dropped.
Stale/missing coins logged as errors.

| HL coin | Underlying | Venue | Calendar |
|---|---|---|---|
| xyz:SKHX | SK hynix 000660 | KRX | krx-nxt |
| xyz:SAMS | Samsung Electronics 005930 | KRX | krx-nxt |
| xyz:KOSP | KOSPI | KRX | krx-nxt |
| xyz:TOYT | Toyota 7203 | TSE | tse |
| xyz:SONY | Sony 6758 | TSE | tse |
| xyz:NIKK | Nikkei 225 | TSE | tse |
| xyz:JPY | TOPIX proxy | TSE | tse |
| xyz:TSMC | TSMC 2330 | TWSE | twse |
| xyz:RELI | Reliance | NSE | nse |
| xyz:NIFT | Nifty 50 | NSE | nse |
| xyz:TSLA/NVDA/AAPL/MSFT/AMZN/META/GOOGL/AMD/NFLX/COIN/PLTR/BABA/CRM | US names | NASDAQ/NYSE | us-equities |
| xyz:SPX/NDX/DJI | US indices | CBOE/NASDAQ/NYSE | us-equities |
| xyz:WTI/BRENT/GOLD/SILV | Commodities | CME/ICE | cme-commodities |
