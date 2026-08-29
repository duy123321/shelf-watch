import { Route, Routes } from "react-router";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Shelf from "./pages/Shelf";
import User from "./pages/User";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/user/:userId" element={<User />} />
      <Route path="/shelf/:username" element={<Shelf />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
