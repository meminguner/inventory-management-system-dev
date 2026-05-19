import './App.css';
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Root } from "./components/Root.tsx";
import { SignUp } from "./components/SignUp.tsx";
import { Login } from "./components/Login.tsx";
import { Dashboard } from "./components/Dashboard.tsx";
import { Add } from "./components/Add.tsx";
import { Update } from "./components/Update.tsx";
import { CreateTable } from "./components/CreateTable.tsx";
import { UserManagement } from "./components/UserManagement.tsx";
import { Profile } from "./components/Profile.tsx";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Root/>}/>
                <Route path="login" element={<Login/>}/>
                <Route path="/signup" element={<SignUp/>}/>
                <Route path="/dashboard" element={<Dashboard/>}/>
                <Route path="/create-table" element={<CreateTable/>}/>
                <Route path="/add-product" element={<Add/>}/>
                <Route path="/update-product" element={<Update/>}/>
                <Route path="/users" element={<UserManagement/>}/>
                <Route path="/profile" element={<Profile/>}/>
            </Routes>
        </BrowserRouter>
    );
}

export default App;
