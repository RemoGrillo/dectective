import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Outlet, RouterProvider } from "react-router";

import "@fontsource/barlow/400.css";
import "@fontsource/barlow/400-italic.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800.css";
import "@fontsource-variable/literata/index.css";
import "@fontsource-variable/literata/wght-italic.css";
import "@fontsource/courier-prime/400.css";
import "@fontsource/courier-prime/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./theme/global.css";

import { AppState } from "./state";
import { Layout } from "./components/Layout";
import { Loading } from "./components/Bits";
import { Cover } from "./pages/Cover";
import { Reader } from "./pages/Reader";
import { NotFound } from "./pages/NotFound";

const KaleidoscopePage = lazy(() => import("./pages/Kaleidoscope"));
const Deductions = lazy(() => import("./pages/Deductions"));
const Dossiers = lazy(() => import("./pages/Dossiers"));
const DossierPage = lazy(() => import("./pages/Dossier"));
const Cast = lazy(() => import("./pages/Cast"));
const AgentPage = lazy(() => import("./pages/Agent"));
const Worlds = lazy(() => import("./pages/Worlds"));
const SparqlLab = lazy(() => import("./pages/SparqlLab"));
const Method = lazy(() => import("./pages/Method"));

function Root() {
  return <AppState><Outlet /></AppState>;
}
const S = (el: React.ReactNode) => <Suspense fallback={<Loading />}>{el}</Suspense>;

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: "/", element: <Cover /> },
      {
        element: <Layout />,
        children: [
          { path: "/read", element: <Reader /> },
          { path: "/kaleidoscope", element: S(<KaleidoscopePage />) },
          { path: "/kaleidoscope/:sid", element: S(<KaleidoscopePage />) },
          { path: "/deductions", element: S(<Deductions />) },
          { path: "/dossiers", element: S(<Dossiers />) },
          { path: "/dossiers/:id", element: S(<DossierPage />) },
          { path: "/cast", element: S(<Cast />) },
          { path: "/cast/:id", element: S(<AgentPage />) },
          { path: "/worlds", element: S(<Worlds />) },
          { path: "/lab", element: S(<SparqlLab />) },
          { path: "/method", element: S(<Method />) },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
