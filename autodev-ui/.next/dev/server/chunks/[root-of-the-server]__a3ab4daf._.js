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
"[project]/app/api/jira/user-tickets/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$auth$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next-auth/index.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$api$2f$auth$2f5b2e2e2e$nextauth$5d2f$route$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/api/auth/[...nextauth]/route.ts [app-route] (ecmascript)");
;
;
;
async function GET() {
    try {
        const session = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$auth$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getServerSession"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$api$2f$auth$2f5b2e2e2e$nextauth$5d2f$route$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authOptions"]);
        console.log('Session:', session ? 'exists' : 'null');
        console.log('Access Token:', session?.accessToken ? 'exists' : 'missing');
        if (!session?.accessToken) {
            console.error('No access token in session');
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'Unauthorized - Please sign in again',
                columns: [
                    {
                        id: 'todo',
                        name: 'To Do',
                        tickets: []
                    },
                    {
                        id: 'inprogress',
                        name: 'In Progress',
                        tickets: []
                    },
                    {
                        id: 'review',
                        name: 'Review',
                        tickets: []
                    },
                    {
                        id: 'done',
                        name: 'Done',
                        tickets: []
                    }
                ]
            }, {
                status: 401
            });
        }
        // First, get accessible Jira resources
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
                    logout: true,
                    columns: [
                        {
                            id: 'todo',
                            name: 'To Do',
                            tickets: []
                        },
                        {
                            id: 'inprogress',
                            name: 'In Progress',
                            tickets: []
                        },
                        {
                            id: 'review',
                            name: 'Review',
                            tickets: []
                        },
                        {
                            id: 'done',
                            name: 'Done',
                            tickets: []
                        }
                    ]
                }, {
                    status: 401
                });
            }
            console.error('Failed to fetch accessible resources:', resourcesRes.status);
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'Failed to fetch Jira resources',
                columns: [
                    {
                        id: 'todo',
                        name: 'To Do',
                        tickets: []
                    },
                    {
                        id: 'inprogress',
                        name: 'In Progress',
                        tickets: []
                    },
                    {
                        id: 'review',
                        name: 'Review',
                        tickets: []
                    },
                    {
                        id: 'done',
                        name: 'Done',
                        tickets: []
                    }
                ]
            }, {
                status: resourcesRes.status
            });
        }
        if (!resourcesRes.ok) {
            console.error('Failed to fetch resources:', resourcesRes.status, resourcesRes.statusText);
            throw new Error(`Failed to fetch accessible resources: ${resourcesRes.status}`);
        }
        const resources = await resourcesRes.json();
        console.log('Found resources:', resources.length);
        if (!resources || resources.length === 0) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'No Jira sites found for your account',
                columns: [
                    {
                        id: 'todo',
                        name: 'To Do',
                        tickets: []
                    },
                    {
                        id: 'inprogress',
                        name: 'In Progress',
                        tickets: []
                    },
                    {
                        id: 'review',
                        name: 'Review',
                        tickets: []
                    },
                    {
                        id: 'done',
                        name: 'Done',
                        tickets: []
                    }
                ]
            }, {
                status: 404
            });
        }
        const cloudId = resources[0].id;
        // Get current user info
        const userRes = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/myself`, {
            headers: {
                'Authorization': `Bearer ${session.accessToken}`,
                'Accept': 'application/json'
            }
        });
        if (!userRes.ok) {
            throw new Error('Failed to fetch user info');
        }
        const currentUser = await userRes.json();
        // Fetch all tickets from the SA project (ScrumAutoDev board)
        const jql = `project = SA ORDER BY updated DESC`;
        console.log('Fetching tickets with JQL:', jql);
        const ticketsRes = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.accessToken}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jql: jql,
                maxResults: 100,
                fields: [
                    'summary',
                    'status',
                    'assignee',
                    'priority',
                    'issuetype',
                    'updated',
                    'created'
                ]
            })
        });
        console.log('Tickets response status:', ticketsRes.status);
        if (!ticketsRes.ok) {
            const errorText = await ticketsRes.text();
            console.error('Tickets API error:', errorText);
            throw new Error(`Failed to fetch tickets: ${ticketsRes.status} - ${errorText}`);
        }
        const ticketsData = await ticketsRes.json();
        console.log('Tickets fetched:', ticketsData.issues?.length || 0);
        // Transform Jira issues to our format
        const tickets = (ticketsData.issues || []).map((issue)=>({
                id: issue.id,
                key: issue.key,
                summary: issue.fields.summary,
                status: issue.fields.status.name,
                assignee: issue.fields.assignee?.displayName || 'Unassigned',
                priority: issue.fields.priority?.name || 'Medium',
                type: issue.fields.issuetype?.name || 'Task',
                updated: issue.fields.updated,
                created: issue.fields.created
            }));
        // Organize tickets by status
        const columns = [
            {
                id: 'todo',
                name: 'To Do',
                tickets: []
            },
            {
                id: 'inprogress',
                name: 'In Progress',
                tickets: []
            },
            {
                id: 'review',
                name: 'Review',
                tickets: []
            },
            {
                id: 'done',
                name: 'Done',
                tickets: []
            }
        ];
        tickets.forEach((ticket)=>{
            const status = ticket.status?.toLowerCase() || '';
            if (status.includes('to do') || status.includes('todo') || status.includes('backlog')) {
                columns[0].tickets.push(ticket);
            } else if (status.includes('in progress') || status.includes('progress')) {
                columns[1].tickets.push(ticket);
            } else if (status.includes('review') || status.includes('code review')) {
                columns[2].tickets.push(ticket);
            } else if (status.includes('done') || status.includes('closed') || status.includes('resolved')) {
                columns[3].tickets.push(ticket);
            } else {
                columns[0].tickets.push(ticket);
            }
        });
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            columns,
            user: {
                accountId: currentUser.accountId,
                displayName: currentUser.displayName,
                emailAddress: currentUser.emailAddress
            },
            site: {
                name: resources[0].name,
                url: resources[0].url
            },
            jiraBaseUrl: resources[0].url
        });
    } catch (error) {
        console.error('Error fetching user Jira tickets:', error);
        console.error('Error details:', error.message);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: `Failed to fetch Jira tickets: ${error.message}`,
            columns: [
                {
                    id: 'todo',
                    name: 'To Do',
                    tickets: []
                },
                {
                    id: 'inprogress',
                    name: 'In Progress',
                    tickets: []
                },
                {
                    id: 'review',
                    name: 'Review',
                    tickets: []
                },
                {
                    id: 'done',
                    name: 'Done',
                    tickets: []
                }
            ]
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__a3ab4daf._.js.map