import { createRouter, createWebHistory } from 'vue-router';

const routes = [
    {
        path: '/',
        name: 'Status',
        component: () => import('../views/StatusPage.vue'),
    },
    {
        path: '/monitor/:id',
        name: 'MonitorDetail',
        component: () => import('../views/MonitorDetail.vue'),
    },
    {
        path: '/magic',
        name: 'MagicLink',
        component: () => import('../components/admin/MagicLinkHandler.vue'),
    },
    {
        path: '/overview',
        component: () => import('../edgepulse/EdgeShell.vue'),
        children: [{ path: '', component: () => import('../edgepulse/OverviewPage.vue') }],
    },
    {
        path: '/monitors',
        component: () => import('../edgepulse/EdgeShell.vue'),
        children: [
            { path: '', component: () => import('../edgepulse/MonitorsPage.vue') },
            { path: ':id', component: () => import('../edgepulse/MonitorDetailPage.vue') },
        ],
    },
    {
        path: '/incidents',
        component: () => import('../edgepulse/EdgeShell.vue'),
        children: [
            { path: '', component: () => import('../edgepulse/IncidentsPage.vue') },
            { path: ':id', component: () => import('../edgepulse/IncidentDetailPage.vue') },
        ],
    },
    {
        path: '/ssl',
        component: () => import('../edgepulse/EdgeShell.vue'),
        children: [{ path: '', component: () => import('../edgepulse/SslPage.vue') }],
    },
    {
        path: '/notifications',
        component: () => import('../edgepulse/EdgeShell.vue'),
        children: [{ path: '', component: () => import('../edgepulse/NotificationsPage.vue') }],
    },
    {
        path: '/status-pages',
        component: () => import('../edgepulse/EdgeShell.vue'),
        children: [{ path: '', component: () => import('../edgepulse/StatusPagesPage.vue') }],
    },
    {
        path: '/nodes',
        component: () => import('../edgepulse/EdgeShell.vue'),
        children: [{ path: '', component: () => import('../edgepulse/NodesPage.vue') }],
    },
    {
        path: '/analytics',
        component: () => import('../edgepulse/EdgeShell.vue'),
        children: [{ path: '', component: () => import('../edgepulse/AnalyticsPage.vue') }],
    },
    {
        path: '/settings',
        component: () => import('../edgepulse/EdgeShell.vue'),
        children: [{ path: '', component: () => import('../edgepulse/SettingsPage.vue') }],
    },
    { path: '/admin', redirect: '/overview' },
    {
        path: '/deploy',
        name: 'Deploy',
        component: () => import('../views/DeployPage.vue'),
    },
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

export default router;
