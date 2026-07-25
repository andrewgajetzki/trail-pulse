import { Route, Routes } from "react-router-dom";

import TripDetailPage from "./pages/TripDetailPage";
import TripListPage from "./pages/TripListPage";

function App() {
    return (
        <Routes>
            <Route path="/" element={<TripListPage />} />
            <Route
                path="/trips/:tripId"
                element={<TripDetailPage />}
            />
        </Routes>
    );
}

export default App;