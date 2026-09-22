# MARKET MAP — `config/markets.json` → underlying (source: HL `allPerpMetas` mainnet, fetched 22 Sep 2026)

35 HIP-3 markets on the `xyz` dex. Validated at indexer boot against live `meta {dex:"xyz"}`.
Unmapped coins show grey on the board, never dropped.

Reference sources: `yahoo` (US equities, live) · `last_close` (HL `prevDayPx`) · `pyth`/`hl_crossdex` (v1: pyth Hermes returns 401, crossdex has no pairs — single dex).

| HL coin | Underlying | Venue | Calendar | Ref |
|---|---|---|---|---|
| xyz:SKHX | SK hynix 000660 | KRX | krx-nxt | last_close |
| xyz:SMSN | Samsung 005930 | KRX | krx-nxt | last_close |
| xyz:SKHY | SK hynix (alt) | KRX | krx-nxt | last_close |
| xyz:KR200 | KOSPI 200 | KRX | krx-nxt | last_close |
| xyz:JP225 | Nikkei 225 | TSE | tse | last_close |
| xyz:NIFTY | Nifty 50 | NSE | nse | last_close |
| xyz:SP500 | S&P 500 | CBOE | us-equities | last_close |
| xyz:XYZ100 | XYZ 100 Index | CBOE | us-equities | last_close |
| xyz:DRAM | DRAM Index | CBOE | us-equities | last_close |
| xyz:CL | WTI Crude | CME | cme-commodities | last_close |
| xyz:BRENTOIL | Brent | ICE | cme-commodities | last_close |
| xyz:GOLD | Gold | CME | cme-commodities | last_close |
| xyz:SILVER | Silver | CME | cme-commodities | last_close |
| xyz:TSLA | Tesla | NASDAQ | us-equities | yahoo+last_close |
| xyz:NVDA | NVIDIA | NASDAQ | us-equities | yahoo+last_close |
| xyz:AAPL | Apple | NASDAQ | us-equities | yahoo+last_close |
| xyz:MSFT | Microsoft | NASDAQ | us-equities | yahoo+last_close |
| xyz:AMZN | Amazon | NASDAQ | us-equities | yahoo+last_close |
| xyz:META | Meta | NASDAQ | us-equities | yahoo+last_close |
| xyz:GOOGL | Alphabet | NASDAQ | us-equities | yahoo+last_close |
| xyz:AMD | AMD | NASDAQ | us-equities | yahoo+last_close |
| xyz:MU | Micron | NASDAQ | us-equities | yahoo+last_close |
| xyz:INTC | Intel | NASDAQ | us-equities | yahoo+last_close |
| xyz:AVGO | Broadcom | NASDAQ | us-equities | yahoo+last_close |
| xyz:COIN | Coinbase | NASDAQ | us-equities | yahoo+last_close |
| xyz:HOOD | Robinhood | NASDAQ | us-equities | yahoo+last_close |
| xyz:MSTR | MicroStrategy | NASDAQ | us-equities | yahoo+last_close |
| xyz:SNDK | SanDisk | NASDAQ | us-equities | yahoo+last_close |
| xyz:NBIS | Nebius | NASDAQ | us-equities | yahoo+last_close |
| xyz:CRCL | Circle | NASDAQ | us-equities | yahoo+last_close |
| xyz:TSM | TSMC | NYSE | us-equities | yahoo+last_close |
| xyz:SOXL | Semi 3x ETF | AMEX | us-equities | yahoo+last_close |
| xyz:EWY | iShares Korea ETF | AMEX | us-equities | yahoo+last_close |
| xyz:SPCX | SPCX | NASDAQ | us-equities | last_close |
| xyz:PURRDAT | PURRDAT | NASDAQ | us-equities | last_close |