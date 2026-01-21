module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/util [external] (util, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("util", () => require("util"));

module.exports = mod;
}),
"[externals]/url [external] (url, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("url", () => require("url"));

module.exports = mod;
}),
"[externals]/http [external] (http, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("http", () => require("http"));

module.exports = mod;
}),
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[externals]/assert [external] (assert, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("assert", () => require("assert"));

module.exports = mod;
}),
"[externals]/querystring [external] (querystring, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("querystring", () => require("querystring"));

module.exports = mod;
}),
"[externals]/buffer [external] (buffer, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("buffer", () => require("buffer"));

module.exports = mod;
}),
"[externals]/zlib [external] (zlib, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("zlib", () => require("zlib"));

module.exports = mod;
}),
"[externals]/https [external] (https, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("https", () => require("https"));

module.exports = mod;
}),
"[externals]/events [external] (events, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("events", () => require("events"));

module.exports = mod;
}),
"[project]/app/api/auth/[...nextauth]/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>handler,
    "POST",
    ()=>handler,
    "authOptions",
    ()=>authOptions
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$auth$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next-auth/index.js [app-route] (ecmascript)");
;
const authOptions = {
    providers: [
        {
            id: "atlassian",
            name: "Atlassian",
            type: "oauth",
            authorization: {
                url: "https://auth.atlassian.com/authorize",
                params: {
                    audience: "api.atlassian.com",
                    prompt: "consent",
                    scope: "read:me read:account offline_access read:jira-work read:jira-user read:confluence-content.all read:confluence-user"
                }
            },
            token: "https://auth.atlassian.com/oauth/token",
            userinfo: {
                url: "https://api.atlassian.com/me",
                async request ({ tokens }) {
                    console.log('Fetching user info with token:', tokens.access_token?.substring(0, 20) + '...');
                    const res = await fetch("https://api.atlassian.com/me", {
                        headers: {
                            Authorization: `Bearer ${tokens.access_token}`
                        }
                    });
                    const data = await res.json();
                    console.log('User info response:', data);
                    return data;
                }
            },
            profile (profile) {
                return {
                    id: profile.account_id,
                    name: profile.name,
                    email: profile.email,
                    image: profile.picture
                };
            },
            clientId: process.env.ATLASSIAN_CLIENT_ID,
            clientSecret: process.env.ATLASSIAN_CLIENT_SECRET
        }
    ],
    callbacks: {
        async jwt ({ token, account, profile }) {
            console.log('JWT Callback - Account:', account);
            console.log('JWT Callback - Profile:', profile);
            console.log('JWT Callback - Token before:', token);
            if (account) {
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
                token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : Date.now() + 10 * 60 * 60 * 1000; // 10 hours
            }
            if (profile) {
                token.name = profile.name;
                token.email = profile.email;
                token.picture = profile.picture;
            }
            console.log('JWT Callback - Token after:', token);
            return token;
        },
        async session ({ session, token }) {
            console.log('Session Callback - Token:', token);
            console.log('Session Callback - Session before:', session);
            session.accessToken = token.accessToken;
            session.user = {
                name: token.name,
                email: token.email,
                image: token.picture
            };
            console.log('Session Callback - Session after:', session);
            return session;
        }
    },
    pages: {
        signIn: '/login',
        signOut: '/signout',
        error: '/login'
    },
    session: {
        strategy: "jwt",
        maxAge: 10 * 60 * 60
    },
    debug: true
};
const handler = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$auth$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"])(authOptions);
;
}),
"[project]/app/api/jira/user-suggestions/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$auth$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next-auth/index.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$api$2f$auth$2f5b2e2e2e$nextauth$5d2f$route$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/api/auth/[...nextauth]/route.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$openai$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/openai/index.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$openai$2f$client$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__OpenAI__as__default$3e$__ = __turbopack_context__.i("[project]/node_modules/openai/client.mjs [app-route] (ecmascript) <export OpenAI as default>");
;
;
;
;
const openai = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$openai$2f$client$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__OpenAI__as__default$3e$__["default"]({
    apiKey: process.env.OPENAI_API_KEY
});
async function GET() {
    try {
        const session = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$auth$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getServerSession"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$api$2f$auth$2f5b2e2e2e$nextauth$5d2f$route$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authOptions"]);
        if (!session?.accessToken) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'Unauthorized'
            }, {
                status: 401
            });
        }
        if (!process.env.OPENAI_API_KEY) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'OpenAI API key not configured'
            }, {
                status: 500
            });
        }
        // Get accessible Jira resources
        const resourcesRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
            headers: {
                'Authorization': `Bearer ${session.accessToken}`,
                'Accept': 'application/json'
            }
        });
        if (!resourcesRes.ok) {
            if (resourcesRes.status === 401) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: 'Session expired',
                    logout: true
                }, {
                    status: 401
                });
            }
            throw new Error('Failed to fetch accessible resources');
        }
        const resources = await resourcesRes.json();
        if (!resources || resources.length === 0) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'No Jira sites found'
            }, {
                status: 404
            });
        }
        const cloudId = resources[0].id;
        // Fetch user's current tickets (assigned to them)
        const userTicketsRes = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.accessToken}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jql: `project = SA AND assignee = currentUser() AND status != Done ORDER BY updated DESC`,
                maxResults: 50,
                fields: [
                    'summary',
                    'description',
                    'status',
                    'issuetype',
                    'sprint'
                ]
            })
        });
        if (!userTicketsRes.ok) {
            throw new Error('Failed to fetch user tickets');
        }
        const userTicketsData = await userTicketsRes.json();
        const userTickets = userTicketsData.issues || [];
        console.log(`\n=== Finding suggestions for ${userTickets.length} user tickets ===`);
        // Fetch unassigned tickets from current sprint and backlog
        const unassignedTicketsRes = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.accessToken}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jql: `project = SA AND assignee is EMPTY AND status != Done ORDER BY updated DESC`,
                maxResults: 100,
                fields: [
                    'summary',
                    'description',
                    'status',
                    'issuetype',
                    'sprint',
                    'created'
                ]
            })
        });
        const unassignedTicketsData = unassignedTicketsRes.ok ? (await unassignedTicketsRes.json()).issues || [] : [];
        console.log(`Found ${unassignedTicketsData.length} unassigned tickets`);
        // Helper function to extract description text from Jira's ADF format or plain text
        const extractDescription = (descriptionField)=>{
            if (!descriptionField) return '';
            // Handle Atlassian Document Format (ADF)
            if (descriptionField.content && Array.isArray(descriptionField.content)) {
                return descriptionField.content.map((node)=>{
                    if (node.type === 'paragraph' && node.content) {
                        return node.content.map((c)=>c.text || '').join(' ');
                    }
                    return '';
                }).join(' ');
            }
            // Handle plain text
            return String(descriptionField);
        };
        // Process each user ticket to find relevant unassigned tickets
        const suggestions = await Promise.all(userTickets.map(async (userTicket)=>{
            const currentTicketSummary = userTicket.fields.summary || '';
            const currentTicketDescription = extractDescription(userTicket.fields.description) || 'No description';
            console.log(`\n--- Analyzing ${userTicket.key}: "${currentTicketSummary}" ---`);
            // Categorize unassigned tickets
            const categorizedTickets = unassignedTicketsData.map((ticket)=>{
                const hasSprint = ticket.fields.sprint && ticket.fields.sprint.length > 0;
                const status = ticket.fields.status?.name?.toLowerCase() || '';
                let category = 'backlog';
                if (hasSprint && !status.includes('backlog')) {
                    category = 'current-sprint';
                }
                return {
                    ...ticket,
                    category
                };
            });
            // Prepare tickets for LLM analysis
            const ticketsForAnalysis = categorizedTickets.map((ticket)=>({
                    key: ticket.key,
                    summary: ticket.fields.summary,
                    description: extractDescription(ticket.fields.description) || 'No description',
                    category: ticket.category,
                    status: ticket.fields.status?.name
                }));
            if (ticketsForAnalysis.length === 0) {
                return {
                    ticketKey: userTicket.key,
                    title: currentTicketSummary,
                    suggestions: [],
                    confidence: 0,
                    lastUpdated: new Date().toISOString()
                };
            }
            // Use OpenAI to analyze relevance
            const prompt = `You are an expert software development project manager analyzing Jira tickets for relevance.

CURRENT TICKET (that the developer is working on):
Key: ${userTicket.key}
Summary: ${currentTicketSummary}
Description: ${currentTicketDescription}

TASK: Analyze the following unassigned tickets and identify which ones are HIGHLY relevant to the current ticket. Look for:
1. Similar technical components (e.g., same database tables, UI components, APIs)
2. Related features or functionality
3. Shared domain concepts or business logic
4. Dependencies or prerequisite work
5. Common technical challenges

Only return tickets with 70% or higher relevance.

UNASSIGNED TICKETS TO ANALYZE:
${ticketsForAnalysis.map((t, i)=>`
${i + 1}. ${t.key} [${t.category === 'current-sprint' ? 'CURRENT SPRINT' : 'BACKLOG'}]
   Summary: ${t.summary}
   Description: ${t.description}
   Status: ${t.status}
`).join('\n')}

RESPONSE FORMAT (JSON only, no markdown):
{
  "relevant_tickets": [
    {
      "key": "ticket-key",
      "relevance_score": 85,
      "reasoning": "brief explanation of why this ticket is relevant",
      "category": "current-sprint" or "backlog"
    }
  ]
}

Only include tickets with relevance_score >= 70. Return empty array if no tickets meet the threshold.`;
            try {
                console.log(`Calling OpenAI for ${userTicket.key}...`);
                const completion = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "system",
                            content: "You are a technical project manager expert at analyzing software development tickets. Respond only with valid JSON."
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    temperature: 0,
                    max_tokens: 2000
                });
                const responseText = completion.choices[0]?.message?.content || '{}';
                console.log(`OpenAI response for ${userTicket.key}:`, responseText);
                // Parse the response
                const llmResponse = JSON.parse(responseText.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
                const relevantTickets = llmResponse.relevant_tickets || [];
                console.log(`Found ${relevantTickets.length} relevant tickets from LLM`);
                // Map the results
                const mappedTickets = relevantTickets.map((item)=>{
                    const originalTicket = categorizedTickets.find((t)=>t.key === item.key);
                    return {
                        key: item.key,
                        summary: originalTicket?.fields.summary || '',
                        status: originalTicket?.fields.status?.name || 'Unknown',
                        relevance: item.relevance_score,
                        category: item.category,
                        assignee: 'Unassigned',
                        reasoning: item.reasoning
                    };
                });
                return {
                    ticketKey: userTicket.key,
                    title: currentTicketSummary,
                    suggestions: mappedTickets,
                    confidence: mappedTickets.length > 0 ? Math.min(mappedTickets[0].relevance / 100, 0.95) : 0,
                    lastUpdated: new Date().toISOString()
                };
            } catch (error) {
                console.error(`Error calling OpenAI for ${userTicket.key}:`, error.message);
                return {
                    ticketKey: userTicket.key,
                    title: currentTicketSummary,
                    suggestions: [],
                    confidence: 0,
                    lastUpdated: new Date().toISOString()
                };
            }
        }));
        // Filter out tickets with no suggestions
        const validSuggestions = suggestions.filter((s)=>s.suggestions.length > 0);
        console.log(`\n=== Total suggestions generated: ${validSuggestions.length} ===\n`);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            suggestions: validSuggestions
        });
    } catch (error) {
        console.error('Error in user-suggestions:', error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: error.message || 'Failed to fetch suggestions'
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__fdc1af2a._.js.map