import { createServer } from 'http';
import { ethers } from 'ethers';
import { normalizePathname, parseEthereumAddress } from './utils';
import {
    readJsonBody,
    validateClaimBody,
    validateGetWalletBalanceBody,
    validateWalletAddressBody,
    validateWithdrawBody,
    validateWithdrawToBinanceBody
} from './validators';
import { executeClaim, executeGetWalletBalance, executeRelayerWithdraw, executeWithdrawToBinance } from './services';
import { resolveClaimConfig, resolveWithdrawConfigFromBody } from './config';
import { buildOpenApiSpec } from './openapi';

async function getClaimableValue(user: string): Promise<number | null> {
    const response = await fetch(`https://data-api.polymarket.com/value?user=${encodeURIComponent(user)}`);
    if (!response.ok) throw new Error(`Failed to fetch claimable value: HTTP ${response.status}`);
    const data = (await response.json()) as Array<{ user: string; value: number }>;
    if (!Array.isArray(data) || data.length === 0) return null;
    return typeof data[0].value === 'number' ? data[0].value : null;
}

export function buildServer() {
    const openapi = buildOpenApiSpec();
    const docsHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Spike Polymarket API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger-ui'
      });
    </script>
  </body>
</html>`;

    return createServer((req, res) => {
        const url = new URL(req.url || '/', 'http://localhost');
        const pathname = normalizePathname(url.pathname);

        if (req.method === 'GET' && pathname === '/openapi.json') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(openapi, null, 2));
            return;
        }

        if (req.method === 'GET' && pathname === '/docs') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(docsHtml);
            return;
        }

        if (req.method === 'GET' && pathname === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return;
        }

        if (req.method === 'POST' && pathname === '/wallet-address') {
            (async () => {
                try {
                    const { walletPrivateKey } = validateWalletAddressBody(await readJsonBody(req));
                    const walletAddress = new ethers.Wallet(walletPrivateKey).address;
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ walletAddress }));
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Internal error';
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: message }));
                }
            })();
            return;
        }

        if (req.method === 'GET' && pathname === '/claimable') {
            (async () => {
                try {
                    const user = url.searchParams.get('user');
                    if (!user?.trim()) throw new Error('Required query: ?user=0x...');
                    const userAddr = parseEthereumAddress('user', user.trim());
                    const value = await getClaimableValue(userAddr);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, user: userAddr, value }));
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Internal error';
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: message }));
                }
            })();
            return;
        }

        if (req.method === 'GET' && pathname === '/get_wallet_balance') {
            (async () => {
                try {
                    const alchemyUrl = url.searchParams.get('alchemyUrl');
                    const address = url.searchParams.get('address');
                    const usdcContract = url.searchParams.get('usdcContract') || undefined;
                    if (!alchemyUrl || !address) {
                        throw new Error('GET requires query: ?alchemyUrl=...&address=0x... (optional usdcContract).');
                    }
                    const result = await executeGetWalletBalance({
                        alchemyUrl: alchemyUrl.trim(),
                        address: parseEthereumAddress('address', address.trim()),
                        usdcContract
                    });
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Internal error';
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: message }));
                }
            })();
            return;
        }

        if (req.method === 'POST' && pathname === '/claim') {
            (async () => {
                try {
                    const payload = validateClaimBody(await readJsonBody(req));
                    const result = await executeClaim(resolveClaimConfig(payload));
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Internal error';
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: message }));
                }
            })();
            return;
        }

        if (req.method === 'POST' && pathname === '/withdraw') {
            (async () => {
                try {
                    const parsed = validateWithdrawBody(await readJsonBody(req));
                    const { config, recipient, amountRaw, tokenAddress } = resolveWithdrawConfigFromBody(parsed);
                    const result = await executeRelayerWithdraw(config, recipient, amountRaw, tokenAddress);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Internal error';
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: message }));
                }
            })();
            return;
        }

        if (req.method === 'POST' && pathname === '/withdraw_to_binance') {
            (async () => {
                try {
                    const parsed = validateWithdrawToBinanceBody(await readJsonBody(req));
                    const result = await executeWithdrawToBinance(parsed);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Internal error';
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: message }));
                }
            })();
            return;
        }

        if (req.method === 'POST' && pathname === '/get_wallet_balance') {
            (async () => {
                try {
                    const parsed = validateGetWalletBalanceBody(await readJsonBody(req));
                    const result = await executeGetWalletBalance(parsed);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Internal error';
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: message }));
                }
            })();
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
    });
}
