import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { Link } from "react-router-dom";
import { FaChevronDown } from "react-icons/fa";

export const Root = () => {
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
    const [userRole, setUserRole] = useState<string>("");
    const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
    const [dashboards, setDashboards] = useState<{id: number, name: string}[]>([]);

    const parseJwt = (token: string) => {
        try {
            return JSON.parse(atob(token.split('.')[1]));
        } catch {
            return null;
        }
    };

    const handleLogout = async () => {
        try {
            const response = await fetch("/api/logout", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            if (response.ok) {
                Cookies.remove("token");
                setIsLoggedIn(false);
                setDropdownOpen(false);
            } else {
                console.error("Logout failed");
            }
        } catch (error) {
            console.error("Error:", error);
        }
    };

    useEffect(() => {
        const token = Cookies.get("token");
        if (token) {
            setIsLoggedIn(() => true);
            const decoded = parseJwt(token);
            if (decoded && decoded.role) {
                setUserRole(decoded.role);
            }
            fetchDashboards(token);
        } else {
            setIsLoggedIn(() => false);
            setUserRole("");
        }
    }, []);

    const fetchDashboards = async (token: string) => {
        try {
            const response = await fetch("/api/dashboards", {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setDashboards(data || []);
            }
        } catch (error) {
            console.error("Error fetching dashboards:", error);
        }
    };

    return (
        <div className="w-full h-[90vh] flex flex-col justify-between ">
            <div className="flex flex-row justify-between items-center">
                <h1 className="text-3xl font-semibold">Inventory Management System</h1>
                {isLoggedIn
                    ? <div className="flex items-center gap-4">
                        {(userRole === "admin" || userRole === "super_user") && (
                            <>
                                <Link to="/users" className="rounded-lg px-4 transition-all bg-green-600 py-[0.55rem] text-white hover:bg-green-700">
                                    Kullanıcı Yönetimi
                                </Link>
                                <Link to="/create-table" className="rounded-lg px-4 transition-all bg-indigo-600 py-[0.55rem] text-white hover:bg-indigo-700">
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
                                    <Link to="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left">Profil Düzenle</Link>
                                    <button onClick={handleLogout} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left">Logout</button>
                                </div>
                            )}
                        </div>
                    </div>
                    : <div className="flex flex-row items-center justify-between md:space-x-6 ">
                        <Link to="signup"
                              className="rounded-lg border-2 border-solid bg-transparent px-4 py-2 transition-all border-black text-black hover:bg-[#dedede]"
                        >Sign Up
                        </Link>
                        <Link to="login"
                              className="rounded-lg px-4 transition-all bg-black py-[0.55rem] text-white hover:bg-[#434343]">Login
                        </Link>
                    </div>
                }
            </div>
            {isLoggedIn ? (
                <div className="w-full flex-1 flex items-center justify-center p-8">
                    <div className="w-full max-w-4xl bg-gray-50 rounded-3xl p-8 border border-gray-200 shadow-sm flex flex-wrap gap-6 items-start content-start min-h-[350px]">
                        {dashboards.map((dashboard) => (
                            <Link key={dashboard.id} to={`/dashboard?id=${dashboard.id}&name=${encodeURIComponent(dashboard.name)}`} className="flex flex-col items-center justify-center bg-white border-2 border-transparent hover:border-indigo-100 rounded-2xl w-32 h-32 shadow-sm hover:shadow-md transition-all cursor-pointer">
                                <span className="text-base font-medium text-gray-700 text-center px-2">{dashboard.name}</span>
                            </Link>
                        ))}
                        {dashboards.length === 0 && (
                            <div className="w-full h-full flex items-center justify-center text-gray-500 italic">
                                Hiç tablo bulunamadı. Lütfen "Tablo Oluştur" butonunu kullanarak yeni bir tablo oluşturun.
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="w-full flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center justify-center max-h-full max-w-4xl text-center px-4">
                        <h1 className="text-3xl font-semibold mb-6 italic">A modern inventory system</h1>
                        <h3 className="opacity-70">An inventory management system is a software application designed to
                            optimize the
                            tracking, organization, and control of warehouse products by providing users with a platform to
                            record and monitor product quantities, prices, and other relevant data.</h3>
                    </div>
                </div>
            )}
        </div>
    );
};
