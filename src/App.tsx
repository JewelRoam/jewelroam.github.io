import { Navigate, Route, Routes } from "react-router-dom";
import { AboutPage } from "./pages/AboutPage";
import { DestinationDetailPage } from "./pages/DestinationDetailPage";
import { DestinationsPage } from "./pages/DestinationsPage";
import { EditorPage } from "./pages/EditorPage";
import { JournalPage } from "./pages/JournalPage";
import { JournalsPage } from "./pages/JournalsPage";
import { PhotoPage } from "./pages/PhotoPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/about" replace />} />
      <Route path="/destinations" element={<DestinationsPage />} />
      <Route path="/destinations/:slug" element={<DestinationDetailPage />} />
      <Route path="/photos/:id" element={<PhotoPage />} />
      <Route path="/journals" element={<JournalsPage />} />
      <Route path="/journals/:slug" element={<JournalPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/editor" element={<EditorPage />} />
      <Route path="*" element={<Navigate to="/about" replace />} />
    </Routes>
  );
}
