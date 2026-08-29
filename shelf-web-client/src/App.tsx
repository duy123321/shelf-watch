import { Route, Routes } from "react-router";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Shelf from "./pages/Shelf";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/shelf/:username" element={<Shelf />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
