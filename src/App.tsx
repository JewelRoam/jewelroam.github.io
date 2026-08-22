import { Navigate, Route, Routes } from "react-router-dom";
import { JewelRoamPage } from "./pages/JewelRoamPage";
import { DestinationDetailPage } from "./pages/DestinationDetailPage";
import { DestinationsPage } from "./pages/DestinationsPage";
import { EditorPage } from "./pages/EditorPage";
import { JournalPage } from "./pages/JournalPage";
import { JournalsPage } from "./pages/JournalsPage";
import { PhotoPage } from "./pages/PhotoPage";
import { RightsPage } from "./pages/RightsPage";

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
      <Route path="/rights" element={<RightsPage />} />
      <Route path="/editor" element={<EditorPage />} />
      <Route path="*" element={<Navigate to="/jewelroam" replace />} />
    </Routes>
  );
}
