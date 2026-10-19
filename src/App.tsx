import { Navigate, Route, Routes } from "react-router-dom";
import { JewelRoamPage } from "./pages/JewelRoamPage";
import { DestinationDetailPage } from "./pages/DestinationDetailPage";
import { DestinationsPage } from "./pages/DestinationsPage";
import { CapturePage } from "./pages/CapturePage";
import { JournalPage } from "./pages/JournalPage";
import { JournalsPage } from "./pages/JournalsPage";
import { PhotoPage } from "./pages/PhotoPage";
import { RightsPage } from "./pages/RightsPage";
import { EmbeddedProjectPage } from "./pages/EmbeddedProjectPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/jewelroam" replace />} />
      <Route path="/destinations" element={<DestinationsPage />} />
      <Route path="/destinations/:slug" element={<DestinationDetailPage />} />
      <Route path="/photos/:id" element={<PhotoPage />} />
      <Route path="/journals" element={<JournalsPage />} />
      <Route path="/journals/:slug" element={<JournalPage />} />
      <Route path="/jewelroam" element={<JewelRoamPage />} />
      <Route path="/zaichang" element={<EmbeddedProjectPage projectId="zaichang" />} />
      <Route path="/glyph-atlas" element={<EmbeddedProjectPage projectId="glyph-atlas" />} />
      <Route path="/nexus-pilot" element={<EmbeddedProjectPage projectId="nexus-pilot" />} />
      <Route path="/geekday" element={<EmbeddedProjectPage projectId="geekday" />} />
      <Route path="/rights" element={<RightsPage />} />
      <Route path="/capture" element={<CapturePage />} />
      <Route path="*" element={<Navigate to="/jewelroam" replace />} />
    </Routes>
  );
}
