import express from 'express';
import fetch from 'node-fetch';
import { Readable } from 'stream';

const app = express();
const PORT = process.env.PORT || 3000;

const AUTH_HEADERS = {
    'User-Agent': 'Mozilla/5.0',
    'Accept': '*/*',
    'Origin': 'https://popcornmovies.org',
    'Referer': 'https://popcornmovies.org/'
};

// =========================
// GLOBAL CORS
// =========================

app.use((req, res, next) => {

    res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*'
    });

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();

});

// =========================
// MAIN PROXY
// =========================

app.get('/proxy', async (req, res) => {

    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).send('Missing url');
    }

    try {

        const headers = { ...AUTH_HEADERS };

        // support video seeking
        if (req.headers.range) {
            headers['Range'] = req.headers.range;
        }

        const response = await fetch(targetUrl, {
            headers,
            redirect: 'follow'
        });

        const contentType =
            response.headers.get('content-type') || '';

        // =========================
        // HLS / DASH MANIFEST REWRITE
        // =========================

        if (
            contentType.includes('mpegurl') ||
            contentType.includes('dash+xml') ||
            targetUrl.includes('.m3u8') ||
            targetUrl.includes('.mpd')
        ) {

            let body = await response.text();

            const proxyBase =
                `https://${req.get('host')}/proxy?url=`;

            // rewrite playlist URLs
            body = body.replace(
                /(https?:\/\/[^\s"']+|[^#\s]+?\.(m3u8|ts|m4s|mp4|key))/g,
                (match) => {

                    // ignore comments
                    if (match.startsWith('#')) {
                        return match;
                    }

                    const absolute = new URL(
                        match,
                        targetUrl
                    ).toString();

                    return proxyBase +
                        encodeURIComponent(absolute);

                }
            );

            // force proper content type
            if (
                contentType.includes('mpegurl') ||
                targetUrl.includes('.m3u8')
            ) {

                res.set(
                    'Content-Type',
                    'application/vnd.apple.mpegurl'
                );

            } else {

                res.set(
                    'Content-Type',
                    'application/dash+xml'
                );

            }

            // force clean CORS
            res.set({
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': '*'
            });

            return res.send(body);

        }

        // =========================
        // NORMAL FILES / SEGMENTS
        // =========================

        res.status(response.status);

        // copy headers EXCEPT bad upstream CORS
        response.headers.forEach((value, key) => {

            const blockedHeaders = [

                'content-encoding',
                'transfer-encoding',

                // prevent upstream CORS overwrite
                'access-control-allow-origin',
                'access-control-allow-methods',
                'access-control-allow-headers',
                'access-control-expose-headers',

                // browser isolation policies
                'cross-origin-resource-policy',
                'cross-origin-opener-policy',
                'cross-origin-embedder-policy'

            ];

            if (
                !blockedHeaders.includes(
                    key.toLowerCase()
                )
            ) {

                res.set(key, value);

            }

        });

        // re-apply OUR CORS
        res.set({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': '*'
        });

        // stream video
        Readable.fromWeb(response.body).pipe(res);

    } catch (err) {

        console.error(err);

        res.status(500).send('Proxy failure');

    }

});

// =========================
// BASE64 PLAYLIST DECODER
// =========================

app.get('/decode', (req, res) => {

    try {

        const encoded = req.query.data;

        if (!encoded) {
            return res
                .status(400)
                .send('Missing data');
        }

        const playlist = Buffer.from(
            encoded.split(',')[1],
            'base64'
        ).toString('utf8');

        res.set({
            'Content-Type':
                'application/vnd.apple.mpegurl',

            'Access-Control-Allow-Origin': '*'
        });

        res.send(playlist);

    } catch (err) {

        console.error(err);

        res.status(500).send('Decode failed');

    }

});

// =========================
// STATUS
// =========================

app.get('/_status', (req, res) => {

    res.json({
        status: 'running'
    });

});

// =========================
// START
// =========================

app.listen(PORT, () => {

    console.log(
        `Proxy running on ${PORT}`
    );

});
