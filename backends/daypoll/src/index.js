const JSON_HEADERS = {
    'Content-Type': 'application/json; charset=utf-8'
};

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const cors = corsHeaders(env);

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: cors });
        }

        try {
            if (request.method === 'POST' && url.pathname === '/api/votes') {
                return await saveVote(request, env, cors);
            }

            if (request.method === 'GET' && url.pathname === '/api/results') {
                return await getResults(url, env, cors);
            }

            return json({ error: 'Not found' }, 404, cors);
        } catch (error) {
            console.error(error);
            return json({ error: 'Internal server error' }, 500, cors);
        }
    }
};

async function saveVote(request, env, cors) {
    let body;

    try {
        body = await request.json();
    } catch {
        return json({ error: 'Expected a JSON body' }, 400, cors);
    }

    const poll = cleanString(body.poll);
    const name = cleanString(body.name);
    const votes = cleanString(body.votes);

    if (!poll || poll.length > 4096) {
        return json({ error: 'Invalid poll' }, 400, cors);
    }

    if (!name || name.length > 100) {
        return json({ error: 'Invalid name' }, 400, cors);
    }

    if (!votes || votes.length > 4096) {
        return json({ error: 'Invalid votes' }, 400, cors);
    }

    const pollId = await digest(poll);
    const updatedAt = new Date().toISOString();

    await env.DB.prepare(`
        INSERT INTO votes (poll_id, name, response_code, updated_at)
        VALUES (?1, ?2, ?3, ?4)
        ON CONFLICT (poll_id, name) DO UPDATE SET
            response_code = excluded.response_code,
            updated_at = excluded.updated_at
    `).bind(pollId, name, votes, updatedAt).run();

    return json({ ok: true }, 200, cors);
}

async function getResults(url, env, cors) {
    const poll = cleanString(url.searchParams.get('poll'));

    if (!poll || poll.length > 4096) {
        return json({ error: 'Invalid poll' }, 400, cors);
    }

    const result = await env.DB.prepare(`
        SELECT name, response_code AS votes, updated_at AS updatedAt
        FROM votes
        WHERE poll_id = ?1
        ORDER BY name COLLATE NOCASE
    `).bind(await digest(poll)).all();

    return json({ votes: result.results }, 200, cors);
}

function cleanString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

async function digest(value) {
    const bytes = new TextEncoder().encode(value);
    const hash = await crypto.subtle.digest('SHA-256', bytes);

    return [...new Uint8Array(hash)]
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}

function corsHeaders(env) {
    const allowed = env.ALLOWED_ORIGIN || '*';

    return {
        'Access-Control-Allow-Origin': allowed === '*' ? '*' : allowed,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };
}

function json(body, status, cors) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...JSON_HEADERS, ...cors }
    });
}
