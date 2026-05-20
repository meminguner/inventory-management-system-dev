import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { Link, useLocation } from "react-router-dom";
import { FaChevronDown } from "react-icons/fa";

export const Header = () => {
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
    const [userRole, setUserRole] = useState<string>("");
    const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
    const location = useLocation();

    const parseJwt = (token: string) => {
        try {
            return JSON.parse(atob(token.split('.')[1]));
        } catch {
            return null;
        }
    };

    useEffect(() => {
        const token = Cookies.get("token");
        if (token) {
            setIsLoggedIn(true);
            const decoded = parseJwt(token);
            if (decoded?.role) {
                setUserRole(decoded.role);
            }
        } else {
            setIsLoggedIn(false);
            setUserRole("");
        }
    }, [location]);

    const handleLogout = async () => {
        try {
            const response = await fetch("/api/logout", {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            });
            if (response.ok) {
                Cookies.remove("token");
                window.location.href = "/";
            }
        } catch (error) {
            console.error("Error:", error);
        }
    };

    return (
        <header className="w-full border-b border-gray-200 bg-white px-6 py-4 flex flex-row items-center justify-between">
            <Link
                to="/"
                className="text-2xl font-semibold text-gray-900 border border-transparent hover:opacity-70 transition-opacity"
            >
                Inventory Management System
            </Link>

            {isLoggedIn ? (
                <div className="flex items-center gap-4">
                    {(userRole === "admin" || userRole === "super_user") && (
                        <>
                            <Link
                                to="/users"
                                className="rounded-lg px-4 transition-all bg-green-600 py-[0.55rem] text-white hover:bg-green-700"
                            >
                                Kullanıcı Yönetimi
                            </Link>
                            <Link
                                to="/create-table"
                                className="rounded-lg px-4 transition-all bg-indigo-600 py-[0.55rem] text-white hover:bg-indigo-700"
                            >
                                Tablo Oluştur
                            </Link>
                        </>
                    )}
                    <div className="relative">
                        <button
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                            className="flex items-center gap-2 rounded-lg px-4 transition-all bg-black py-[0.55rem] text-white hover:bg-[#434343]"
                        >
                            Profile <FaChevronDown size={12} />
                        </button>
                        {dropdownOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-10">
                                <Link
                                    to="/profile"
                                    onClick={() => setDropdownOpen(false)}
                                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                >
                                    Profil Düzenle
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                >
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex flex-row items-center md:space-x-6">
                    <Link
                        to="/signup"
                        className="rounded-lg border-2 border-solid bg-transparent px-4 py-2 transition-all border-black text-black hover:bg-[#dedede]"
                    >
                        Sign Up
                    </Link>
                    <Link
                        to="/login"
                        className="rounded-lg px-4 transition-all bg-black py-[0.55rem] text-white hover:bg-[#434343]"
                    >
                        Login
                    </Link>
                </div>
            )}
        </header>
    );
};
