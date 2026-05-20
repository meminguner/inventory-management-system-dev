import './App.css';
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Header } from "./components/Header.tsx";
import { Root } from "./components/Root.tsx";
import { SignUp } from "./components/SignUp.tsx";
import { Login } from "./components/Login.tsx";
import { Dashboard } from "./components/Dashboard.tsx";
import { Add } from "./components/Add.tsx";
import { Update } from "./components/Update.tsx";
import { CreateTable } from "./components/CreateTable.tsx";
import { CreateTableAI } from "./components/CreateTableAI.tsx";
import { UserManagement } from "./components/UserManagement.tsx";
import { Profile } from "./components/Profile.tsx";

function App() {
    return (
        <BrowserRouter>
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex flex-col">
                    <Routes>
                        <Route path="/" element={<Root />} />
                        <Route path="login" element={<Login />} />
                        <Route path="/signup" element={<SignUp />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/create-table" element={<CreateTable />} />
                        <Route path="/create-table-ai" element={<CreateTableAI />} />
                        <Route path="/add-product" element={<Add />} />
                        <Route path="/update-product" element={<Update />} />
                        <Route path="/users" element={<UserManagement />} />
                        <Route path="/profile" element={<Profile />} />
                    </Routes>
                </main>
            </div>
        </BrowserRouter>
    );
}

export default App;
