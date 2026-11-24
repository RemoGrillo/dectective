import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation, useParams } from "react-router";

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

const Perspectives = lazy(() => import("./pages/Perspectives"));
const Deductions = lazy(() => import("./pages/Deductions"));
const Dossiers = lazy(() => import("./pages/Dossiers"));
const DossierPage = lazy(() => import("./pages/Dossier"));
const Identikit = lazy(() => import("./pages/Identikit"));
const Interrogation = lazy(() => import("./pages/SparqlLab"));
const Method = lazy(() => import("./pages/Method"));

function Root() {
  return <AppState><Outlet /></AppState>;
}
const S = (el: React.ReactNode) => <Suspense fallback={<Loading />}>{el}</Suspense>;
/** Old addresses (Kaleidoscope, Worlds, Cast, SPARQL Lab) keep working: same query string, hash and state, new path. */
function Moved({ to }: { to: string }) {
  const loc = useLocation();
  const { id } = useParams();
  return <Navigate replace to={`${to}${id ? `/${id}` : ""}${loc.search}${loc.hash}`} state={loc.state} />;
}

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: "/", element: <Cover /> },
      {
        element: <Layout />,
        children: [
          { path: "/read", element: <Reader /> },
          { path: "/perspectives", element: S(<Perspectives />) },
          { path: "/kaleidoscope/:sid", element: S(<Perspectives />) },
          { path: "/kaleidoscope", element: <Moved to="/perspectives" /> },
          { path: "/worlds", element: <Moved to="/perspectives" /> },
          { path: "/deductions", element: S(<Deductions />) },
          { path: "/dossiers", element: S(<Dossiers />) },
          { path: "/dossiers/:id", element: S(<DossierPage />) },
          { path: "/identikit", element: S(<Identikit />) },
          { path: "/identikit/:id", element: S(<Identikit />) },
          { path: "/cast", element: <Moved to="/identikit" /> },
          { path: "/cast/:id", element: <Moved to="/identikit" /> },
          { path: "/interrogation", element: S(<Interrogation />) },
          { path: "/lab", element: <Moved to="/interrogation" /> },
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
