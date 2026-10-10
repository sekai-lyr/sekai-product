import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import WorldsView from '../views/WorldsView.vue'
import OverviewView from '../views/OverviewView.vue'
import MapView from '../views/MapView.vue'
import ActorsView from '../views/ActorsView.vue'
import ActorDetailView from '../views/ActorDetailView.vue'
import TimelineView from '../views/TimelineView.vue'
import EventView from '../views/EventView.vue'
import BranchesView from '../views/BranchesView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView },
    { path: '/', redirect: '/worlds' },
    { path: '/worlds', component: WorldsView },
    { path: '/worlds/:worldId', component: OverviewView },
    { path: '/worlds/:worldId/map', component: MapView },
    { path: '/worlds/:worldId/actors', component: ActorsView },
    { path: '/worlds/:worldId/actors/:actorId', component: ActorDetailView },
    { path: '/worlds/:worldId/timeline', component: TimelineView },
    { path: '/worlds/:worldId/events/:eventId', component: EventView },
    { path: '/worlds/:worldId/branches', component: BranchesView }
  ]
})

router.beforeEach((to) => {
  if (to.path !== '/login' && !localStorage.getItem('sekai.token')) return '/login'
})

export default router
