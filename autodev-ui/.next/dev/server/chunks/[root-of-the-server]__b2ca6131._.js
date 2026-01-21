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
"[externals]/child_process [external] (child_process, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("child_process", () => require("child_process"));

module.exports = mod;
}),
"[externals]/util [external] (util, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("util", () => require("util"));

module.exports = mod;
}),
"[project]/app/api/jira/board/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$child_process__$5b$external$5d$__$28$child_process$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/child_process [external] (child_process, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$util__$5b$external$5d$__$28$util$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/util [external] (util, cjs)");
;
;
;
const execAsync = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$util__$5b$external$5d$__$28$util$2c$__cjs$29$__["promisify"])(__TURBOPACK__imported__module__$5b$externals$5d2f$child_process__$5b$external$5d$__$28$child_process$2c$__cjs$29$__["exec"]);
async function GET() {
    try {
        // Call the Python script to get Jira board data
        const workspaceRoot = process.cwd().replace('/autodev-ui', '');
        const { stdout, stderr } = await execAsync(`cd "${workspaceRoot}" && python3 -c "from jira_ticket_manager import JiraTicketManager; import json; manager = JiraTicketManager(); tickets = manager.get_all_open_tickets(); print(json.dumps({'tickets': tickets}))"`, {
            shell: '/bin/zsh',
            env: {
                ...process.env
            },
            timeout: 10000 // 10 second timeout
        });
        if (stderr && !stderr.includes('✓')) {
            console.error('Python script error:', stderr);
        }
        const data = JSON.parse(stdout.trim());
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
        // Distribute tickets into columns based on status
        if (data.tickets && Array.isArray(data.tickets)) {
            data.tickets.forEach((ticket)=>{
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
                    columns[0].tickets.push(ticket); // Default to To Do
                }
            });
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            columns
        });
    } catch (error) {
        console.error('Error fetching Jira board:', error);
        // Return empty columns with error message
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Failed to fetch Jira tickets. Please check your Jira credentials in .env.local',
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
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__b2ca6131._.js.map