import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { Link } from "react-router-dom";

export const Root = () => {
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
    const [dashboards, setDashboards] = useState<{id: number, name: string}[]>([]);

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
            fetchDashboards(token);
        } else {
            setIsLoggedIn(false);
        }
    }, []);

    const fetchDashboards = async (token: string) => {
        try {
            const response = await fetch("/api/dashboards", {
                headers: { Authorization: `Bearer ${token}` }
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
        <div className="w-full flex-1 flex flex-col justify-center">
            {isLoggedIn ? (
                <div className="w-full flex-1 flex items-center justify-center p-8">
                    <div className="w-full max-w-4xl bg-gray-50 rounded-3xl p-8 border border-gray-200 shadow-sm flex flex-wrap gap-6 items-start content-start min-h-[350px]">
                        {dashboards.map((dashboard) => (
                            <Link
                                key={dashboard.id}
                                to={`/dashboard?id=${dashboard.id}&name=${encodeURIComponent(dashboard.name)}`}
                                className="flex flex-col items-center justify-center bg-white border-2 border-transparent hover:border-indigo-100 rounded-2xl w-32 h-32 shadow-sm hover:shadow-md transition-all cursor-pointer"
                            >
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
                    <div className="flex flex-col items-center justify-center max-w-4xl text-center px-4">
                        <h1 className="text-3xl font-semibold mb-6 italic">A modern inventory system</h1>
                        <h3 className="opacity-70">An inventory management system is a software application designed to
                            optimize the tracking, organization, and control of warehouse products by providing users with
                            a platform to record and monitor product quantities, prices, and other relevant data.</h3>
                    </div>
                </div>
            )}
        </div>
    );
};
