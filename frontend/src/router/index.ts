import { createRouter, createWebHistory } from "vue-router";
import type { Router, RouteComponent, RouteRecordRaw } from "vue-router";

export type RouteRecordRawCustom = RouteRecordRaw & {
  meta?: { myProperty?: string };
};

export const getRoutes = (): RouteRecordRawCustom[] => {
  return [
    {
      path: "/",
      name: "Home",
      component: (): Promise<RouteComponent> => import("@/views/HomeView.vue"),
      props: true
    },
    {
      path: "/connectivity",
      name: "Connectivity",
      component: (): Promise<RouteComponent> => import("@/views/ConnectivityView.vue"),
      props: true
    },
    { path: "/:pathMatch(.*)*", redirect: "/" }
  ];
};

let router: Router;

export const getRouter = (): Router => {
  if (!router) {
    router = createRouter({
      history: createWebHistory("/"),
      scrollBehavior(_to, _from, savedPosition) {
        return savedPosition || { left: 0, top: 0 };
      },
      routes: getRoutes(),
      linkActiveClass: "nav-active"
    });
  }
  return router;
};
